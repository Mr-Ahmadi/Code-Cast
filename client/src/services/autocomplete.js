import { resolveProvider, complete, chat, isAbortError, stripThinking } from './llm';
import { buildFimPrompt, stripSentinels, supportsFim } from './fim';

const EMPTY = { items: [] };

let canceledHandlerAdded = false;
function suppressMonacoCanceled() {
  if (canceledHandlerAdded) return;
  canceledHandlerAdded = true;
  window.addEventListener('unhandledrejection', (e) => {
    if (e.reason?.name === 'Canceled') e.preventDefault();
  });
}

let currentSettings = null;
let providerDisposable = null;
let actionDisposable = null;

/**
 * The single in-flight suggestion attempt. Monaco calls the provider again on
 * every keystroke, so a superseded attempt must be *settled* (not just cleared)
 * or its promise hangs forever and Monaco keeps waiting on it.
 */
let inflight = null;

function settleInflight() {
  if (!inflight) return;
  const previous = inflight;
  inflight = null;
  clearTimeout(previous.timer);
  previous.cancelSub?.dispose();
  previous.controller?.abort();
  previous.resolve(EMPTY);
}

/* ------------------------------------------------------------------ status */

const statusListeners = new Set();
let status = 'idle';
let statusDetail = null;

/**
 * Subscribe to 'idle' | 'loading' | 'error'. The listener also receives the
 * error message while in the 'error' state. Returns an unsubscribe function.
 */
export function onAiStatusChange(listener) {
  statusListeners.add(listener);
  listener(status, statusDetail);
  return () => statusListeners.delete(listener);
}

export function getAiStatus() {
  return status;
}

function setStatus(next, detail = null) {
  if (status === next && statusDetail === detail) return;
  status = next;
  statusDetail = detail;
  for (const listener of statusListeners) listener(next, detail);
}

/* ------------------------------------------------------------------- cache */

const cache = new Map();

function lruPut(key, value) {
  const size = currentSettings?.aiAutocomplete?.cacheSize ?? 60;
  cache.delete(key);
  if (cache.size >= size) {
    cache.delete(cache.keys().next().value);
  }
  cache.set(key, value);
}

function lruGet(key) {
  const hit = cache.get(key);
  if (hit === undefined) return undefined;
  cache.delete(key);
  cache.set(key, hit);
  return hit;
}

function hashString(str) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(36) + (h1 >>> 0).toString(36);
}

export function updateAiSettings(settings) {
  currentSettings = settings;
}

/* ----------------------------------------------------------------- context */

/** Rough comment detection. Returns the delimiter when the cursor is inside a comment. */
function commentDelimiterAt(model, position) {
  const line = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
  const trimmed = line.trimStart();
  const delimiters = [
    ['//', 'javascript', 'typescript', 'javascriptreact', 'typescriptreact', 'c', 'cpp', 'java', 'go', 'rust', 'php', 'swift', 'kotlin', 'dart', 'scala'],
    ['#', 'python', 'ruby', 'r', 'shell', 'yaml', 'toml', 'dockerfile'],
    ['<!--', 'html', 'xml', 'vue'],
    ['/*', 'css', 'scss', 'less'],
    ['--', 'sql', 'lua', 'haskell'],
  ];
  const lang = model.getLanguageId();
  for (const [delim, ...langs] of delimiters) {
    if (langs.includes(lang) && trimmed.startsWith(delim)) return delim;
  }
  // Inside an unterminated block comment opened earlier on this line.
  const lastOpen = line.lastIndexOf('/*');
  if (lastOpen !== -1 && line.indexOf('*/', lastOpen) === -1) return '/*';
  return null;
}

/** model.uri is file:///<relative name>, matching the keys of __getAllModelContents. */
function fileNameOf(model) {
  return decodeURIComponent(model?.uri?.path || '').replace(/^\/+/, '');
}

function gatherContextFiles(model) {
  if (!currentSettings?.aiAutocomplete?.useOpenFileContext) return [];
  try {
    const all = typeof window.__getAllModelContents === 'function' ? (window.__getAllModelContents() || {}) : {};
    const entries = Object.entries(all);
    if (!entries.length) return [];

    const currentName = fileNameOf(model);
    const currentDir = currentName.slice(0, currentName.lastIndexOf('/'));

    const scored = entries
      // The current file already arrives as prefix/suffix; repeating it wastes context.
      .filter(([name, content]) => name !== currentName && content && content.trim())
      .map(([name, content]) => {
        const nameDir = name.slice(0, name.lastIndexOf('/'));
        let score = 1;
        if (nameDir === currentDir) score += 2;
        else if (currentDir && nameDir.startsWith(currentDir)) score += 1;
        return { name, content, score };
      })
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, 6).map(({ name, content }) => ({ name, content: String(content).slice(0, 4000) }));
  } catch {
    return [];
  }
}

/* ---------------------------------------------------------------- cleaning */

/** Languages where natural-language lines are the content, not a failure. */
const PROSE_LANGUAGES = new Set(['markdown', 'mdx', 'plaintext', 'restructuredtext', 'latex', 'tex', 'asciidoc']);

/** Languages with free text between tags, where only unmistakable chatter is cut. */
const MARKUP_LANGUAGES = new Set(['html', 'xml', 'vue', 'svelte', 'php', 'javascriptreact', 'typescriptreact', 'handlebars', 'razor']);

const HASH_COMMENT_LANGUAGES = new Set(['python', 'ruby', 'r', 'shell', 'yaml', 'toml', 'dockerfile', 'perl', 'powershell', 'makefile', 'elixir', 'julia', 'coffeescript']);

/** Openers of the explanations models append after (or put before) the code. */
const EXPLANATION_START = /^(?:explanation|notes?|output|usage|example usage|how it works|this (?:code|function|method|snippet|completion|will|adds|implements|creates|returns|defines)|in this (?:code|example|snippet)|the (?:above|code|function|completion)|here(?:'s| is| are)|i(?:'ve| have| added)|let me|sure|certainly)\b/i;

function isCommentLine(trimmed, language) {
  // A bare `*` continues a block comment; `**Bold**` is markdown, not a comment.
  if (/^(\/\/|\/\*|\*(?:\s|\/|$)|<!--|-->)/.test(trimmed)) return true;
  if (trimmed.startsWith('--') && ['sql', 'lua', 'haskell'].includes(language)) return true;
  return trimmed.startsWith('#') && HASH_COMMENT_LANGUAGES.has(language);
}

/** A sentence: capitalised plain first word, several words, no statement punctuation. */
function isProseLine(trimmed) {
  return !/[{};=<>]/.test(trimmed)
    && /^[A-Z][a-z']*(?:\s+\S+){3,}/.test(trimmed)
    && (trimmed.length > 50 || /[.:!?]$/.test(trimmed));
}

const stripMarkdownDecoration = (trimmed) => trimmed.replace(/^(?:[*_>]+\s*|[-+]\s+|\d+\.\s+)+/, '');

/**
 * Tracks whether text sits inside a docstring or block comment, where prose is
 * legitimate. `open` is the pending closing delimiter. Approximate: string
 * literals that contain the delimiters can fool it.
 */
function advanceBlockText(open, text) {
  const re = /"""|'''|\/\*|\*\//g;
  let match;
  while ((match = re.exec(text))) {
    const token = match[0];
    if (open) {
      if (token === open) open = null;
    } else if (token !== '*/') {
      open = token === '/*' ? '*/' : token;
    }
  }
  return open;
}

/**
 * Index of the first line where the model stopped writing code and started
 * talking — a markdown fence or heading, "Explanation:", paragraphs of prose —
 * or -1. Comments, docstrings and block comments are never cut.
 */
function findChatterStart(lines, { language, prefix, linePrefix }) {
  if (PROSE_LANGUAGES.has(language)) return -1;
  const markup = MARKUP_LANGUAGES.has(language);
  let open = advanceBlockText(null, prefix);

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const wasOpen = open !== null;
    open = advanceBlockText(open, lines[i]);
    // The first line continues what is already typed; it is not a sentence of its own.
    if (!trimmed || wasOpen || open !== null || (i === 0 && linePrefix.trim())) continue;

    if (trimmed.startsWith('```')) return i;
    if (isCommentLine(trimmed, language)) continue;
    if (/^(?:#{1,6}\s+[A-Za-z].*|(?:\*\*|__)[^*_]+(?:\*\*|__):?)$/.test(trimmed)) return i;

    const text = stripMarkdownDecoration(trimmed);
    if (EXPLANATION_START.test(text) && /^[A-Z]/.test(text) && !/[{};=]/.test(text)
      && (!markup || text.endsWith(':'))) {
      return i;
    }
    if (markup || !isProseLine(text)) continue;

    const nextIndex = lines.findIndex((l, j) => j > i && l.trim());
    const next = nextIndex === -1 ? '' : lines[nextIndex].trim();
    if (text.endsWith(':') || next.startsWith('```') || isProseLine(stripMarkdownDecoration(next))) return i;
    // A lone closing remark, set off from the code by a blank line.
    if (!next && i > 0 && !lines[i - 1].trim() && /[.!]$/.test(text)) return i;
  }
  return -1;
}

/**
 * Models that run past the hole rewrite the code that already follows the
 * cursor. Returns the line where that echo starts, or -1.
 */
function findSuffixRepeat(lines, suffix) {
  const after = suffix.split('\n').slice(1).map((l) => l.trim()).filter(Boolean).slice(0, 5);
  if (!after.length) return -1;
  for (let i = 1; i < lines.length; i++) {
    let matched = 0;
    while (matched < after.length && i + matched < lines.length && lines[i + matched].trim() === after[matched]) {
      matched++;
    }
    if (!matched) continue;
    // A short line such as `}` only counts when it is where the completion ends.
    if (i + matched === lines.length || matched >= 2 || after[0].length >= 8) return i;
  }
  return -1;
}

/**
 * @param {string} text Raw model output.
 * @param {object} ctx
 * @param {string} ctx.modelName  Decides which sentinel tokens to strip.
 * @param {string} ctx.language   Monaco language id.
 * @param {string} ctx.prefix     Text before the cursor.
 * @param {string} ctx.suffix     Text after the cursor.
 * @param {string} ctx.linePrefix Current line up to the cursor.
 * @param {string} ctx.lineSuffix Current line after the cursor.
 */
export function cleanCompletion(text, {
  modelName = '', language = '', prefix = '', suffix = '', linePrefix = '', lineSuffix = '',
} = {}) {
  let lines = stripSentinels(text, modelName).replace(/\r\n/g, '\n').split('\n').map((l) => l.trimEnd());

  let leadingBreak = false;
  while (lines.length && lines[0].trim() === '') {
    lines.shift();
    leadingBreak = true;
  }
  if (!lines.length) return '';
  // After typed code (e.g. right after `{`) a leading newline is the point of
  // the suggestion; dropping it would glue the next line onto this one.
  if (leadingBreak && linePrefix.trim()) lines.unshift('');
  // On an indented blank line the indentation is already typed.
  else if (!leadingBreak && linePrefix && !linePrefix.trim() && lines[0].startsWith(linePrefix)) {
    lines[0] = lines[0].slice(linePrefix.length);
  }

  const chatter = findChatterStart(lines, { language, prefix, linePrefix });
  if (chatter !== -1) lines = lines.slice(0, chatter);

  const repeat = findSuffixRepeat(lines, suffix);
  if (repeat !== -1) lines = lines.slice(0, repeat);

  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();

  // In the middle of a line only a single-line insertion makes sense.
  if (!currentSettings?.aiAutocomplete?.multiline || lineSuffix.trim()) {
    lines = lines.length ? [lines[0]] : [];
  }

  // Only the trailing edge is safe to trim: leading indentation is meaningful.
  return lines.join('\n').replace(/\s+$/, '');
}

const CHAT_PREAMBLE = /^(?:sure|certainly|of course|okay|ok|here(?:'s| is| are)|the (?:completion|code|missing code|inserted code|code to insert)|to complete|completion|i (?:would|will|'ll)|this (?:completes|will))\b[^{};=]*[:!.]$/i;
const NOTHING_TO_INSERT = /^(?:nothing(?: to insert)?|no (?:completion|code|changes?|insertion)(?: (?:is )?(?:needed|required))?|n\/a|none)\.?$/i;

/**
 * Chat models often restate the code they were asked to continue — the line
 * being typed, or the whole file. Keeps only what follows the cursor.
 */
function dropRestatedPrefix(text, prefix) {
  const prefixLines = prefix.split('\n');
  // Trailing whitespace is part of what was typed (`return |`).
  const typed = prefixLines[prefixLines.length - 1].trimStart();
  const above = prefixLines.slice(0, -1).map((l) => l.trim()).filter(Boolean);
  const lines = text.split('\n');

  // Echo of the surrounding file: find the lines just above the cursor. Two
  // lines are a safer anchor; the echo may start at the nearer one, though.
  for (const anchor of [above.slice(-2), above.slice(-1)]) {
    if (anchor.join('').length < 6) continue;
    for (let i = anchor.length - 1; i < lines.length - 1; i++) {
      if (!anchor.every((a, j) => lines[i - anchor.length + 1 + j].trim() === a)) continue;
      let k = i + 1;
      if (typed) {
        while (k < lines.length && !lines[k].trim()) k++;
        if (k === lines.length || !lines[k].trimStart().startsWith(typed)) continue;
      }
      const rest = typed ? lines[k].trimStart().slice(typed.length) : lines[k];
      return [rest, ...lines.slice(k + 1)].join('\n');
    }
  }

  const trimmed = text.trimStart();
  if (typed && trimmed.startsWith(typed)) return trimmed.slice(typed.length);
  return text;
}

/** Pulls the insertion out of a chat reply, discarding the conversation around it. */
export function extractChatCompletion(reply, { language = '', prefix = '' } = {}) {
  let text = stripThinking(reply).replace(/\r\n/g, '\n');
  if (NOTHING_TO_INSERT.test(text.trim())) return '';

  // The fenced body is the answer, whatever chatter surrounds it. In prose
  // languages a fence can itself be the content, so it is left alone there.
  const fence = PROSE_LANGUAGES.has(language)
    ? null
    : /```[\w+#.-]*[^\S\n]*\n([\s\S]*?)(?:\n[^\S\n]*```|$)/.exec(text);
  const inline = /^\s*`([^`\n]+)`\s*$/.exec(text);
  if (fence) {
    text = fence[1];
  } else if (inline && !PROSE_LANGUAGES.has(language)) {
    text = inline[1];
  } else {
    const lines = text.split('\n');
    while (lines.length && CHAT_PREAMBLE.test(lines[0].trim())) {
      lines.shift();
      while (lines.length && !lines[0].trim()) lines.shift();
    }
    text = lines.join('\n');
  }

  return dropRestatedPrefix(text.replace(/<\/?CURSOR>/gi, ''), prefix);
}

/**
 * Models frequently re-emit text that already sits after the cursor. Dropping
 * the overlap keeps accepting a suggestion from duplicating that text.
 */
export function trimSuffixOverlap(completion, lineSuffix) {
  const tail = lineSuffix.trim();
  if (!tail) return completion;
  const max = Math.min(completion.length, tail.length);
  for (let len = max; len > 0; len--) {
    if (completion.endsWith(tail.slice(0, len))) {
      return completion.slice(0, completion.length - len);
    }
  }
  return completion;
}

/**
 * Builds the range the suggestion replaces.
 *
 * Replacing through end-of-line is only correct when nothing but whitespace
 * follows the cursor; otherwise the accepted suggestion would delete real code.
 */
function buildRange(model, position, lineSuffix) {
  const endColumn = lineSuffix.trim() === ''
    ? model.getLineMaxColumn(position.lineNumber)
    : position.column;
  return {
    startLineNumber: position.lineNumber,
    startColumn: position.column,
    endLineNumber: position.lineNumber,
    endColumn,
  };
}

function positionUnchanged(editor, position) {
  const now = editor.getPosition();
  return !!now && now.lineNumber === position.lineNumber && now.column === position.column;
}

/* ---------------------------------------------------------------- request */

const CHAT_COMPLETION_PROMPT = [
  'You are a code completion engine inside an IDE, not a chat assistant.',
  'The user sends a source file containing a <CURSOR> marker.',
  'Reply with exactly the code to insert at <CURSOR> and nothing else:',
  '- no explanations, greetings, notes or markdown fences;',
  '- never repeat code that already appears before or after <CURSOR>;',
  '- match the language, indentation and style of the file;',
  '- finish the current line or statement; add more lines only when they clearly belong there.',
  'If nothing should be inserted, reply with an empty message.',
].join('\n');

/** A worked example: small chat models follow a demonstration far better than rules. */
const CHAT_EXAMPLE = [
  {
    role: 'user',
    content: 'Language: python\nFile: shapes.py\n\nimport math\n\ndef circle_area(radius):\n    return <CURSOR>\n\nprint(circle_area(2))\n',
  },
  { role: 'assistant', content: 'math.pi * radius ** 2' },
];

function chatUserMessage({ prefix, suffix, language, fileName, contextFiles }) {
  const related = contextFiles.slice(0, 3)
    .map((f) => `--- ${f.name}\n${f.content.slice(0, 1500)}`)
    .join('\n');
  return `${related ? `Related files:\n${related}\n\n` : ''}Language: ${language}\n`
    + `${fileName ? `File: ${fileName}\n` : ''}\n${prefix}<CURSOR>${suffix}`;
}

/** provider|model pairs whose endpoint turned out to have no raw-completions route. */
const chatOnlyModels = new Set();

function usesChatPrompt(conf, provider, modelName) {
  if (conf.promptMode === 'chat') return true;
  if (conf.promptMode === 'fim') return false;
  return !supportsFim(modelName) || chatOnlyModels.has(`${provider.id}|${modelName}`);
}

async function requestCompletion({ provider, modelName, prefix, suffix, language, fileName, contextFiles, conf, signal }) {
  const common = {
    provider,
    model: modelName,
    signal,
    temperature: conf.temperature ?? 0.1,
    maxTokens: conf.maxTokens ?? 128,
    timeout: conf.requestTimeoutMs ?? 12000,
  };

  if (!usesChatPrompt(conf, provider, modelName)) {
    try {
      const { prompt, stop } = buildFimPrompt({ model: modelName, prefix, suffix, contextFiles, fileName });
      return await complete({ ...common, prompt, stop });
    } catch (err) {
      // Hosted chat-only APIs (OpenAI, Groq, …) have no /completions route.
      const noCompletionsRoute = provider.id === 'openai' && [400, 404, 405, 501].includes(err?.status);
      if (!noCompletionsRoute || conf.promptMode === 'fim') throw err;
      chatOnlyModels.add(`${provider.id}|${modelName}`);
    }
  }

  const reply = await chat({
    ...common,
    messages: [
      { role: 'system', content: CHAT_COMPLETION_PROMPT },
      ...CHAT_EXAMPLE,
      { role: 'user', content: chatUserMessage({ prefix, suffix, language, fileName, contextFiles }) },
    ],
  });

  return extractChatCompletion(reply, { language, prefix });
}

/* --------------------------------------------------------------- provider */

export function registerAiAutocomplete(editor, monaco, settings) {
  currentSettings = settings;
  suppressMonacoCanceled();

  if (!settings?.aiAutocomplete?.enabled) {
    setStatus('idle');
    return;
  }

  editor.updateOptions({ inlineSuggest: { enabled: true } });

  providerDisposable = monaco.languages.registerInlineCompletionsProvider(
    [{ pattern: '**' }],
    {
      provideInlineCompletions: (model, position, context, token) => {
        const conf = currentSettings?.aiAutocomplete;
        if (!conf?.enabled) return EMPTY;

        // In manual mode only an explicit trigger (Ctrl/Cmd+Shift+Space or the
        // command palette entry) should reach the model.
        const explicitKind = monaco.languages.InlineCompletionTriggerKind?.Explicit ?? 1;
        const isExplicit = context?.triggerKind === explicitKind;
        if (conf.triggerMode === 'manual' && !isExplicit) return EMPTY;

        const language = model.getLanguageId();
        if (!language || language === 'plaintext') return EMPTY;

        const fullLine = model.getLineContent(position.lineNumber);
        const linePrefix = fullLine.slice(0, position.column - 1);
        const lineSuffix = fullLine.slice(position.column - 1);
        if (!linePrefix.trim() && !isExplicit) return EMPTY;

        if (conf.skipInComments && commentDelimiterAt(model, position)) return EMPTY;

        // Supersede whatever attempt was already running.
        settleInflight();

        return new Promise((resolve) => {
          if (token.isCancellationRequested) {
            resolve(EMPTY);
            return;
          }

          const controller = new AbortController();
          const attempt = { resolve, controller, timer: null, cancelSub: null };
          inflight = attempt;

          /** Settles this attempt exactly once and clears it from the slot. */
          const finish = (result) => {
            if (inflight === attempt) inflight = null;
            clearTimeout(attempt.timer);
            attempt.cancelSub?.dispose();
            resolve(result);
          };

          attempt.cancelSub = token.onCancellationRequested(() => {
            controller.abort();
            finish(EMPTY);
          });

          const debounceMs = isExplicit ? 0 : (conf.debounceMs ?? 350);

          attempt.timer = setTimeout(async () => {
            if (token.isCancellationRequested || inflight !== attempt) {
              finish(EMPTY);
              return;
            }

            const text = model.getValue();
            const offset = model.getOffsetAt(position);
            const maxPrefix = conf.maxPrefixChars ?? 4000;
            const maxSuffix = conf.maxSuffixChars ?? 1500;
            const prefix = text.slice(Math.max(0, offset - maxPrefix), offset);
            const suffix = text.slice(offset, offset + maxSuffix);
            const modelName = conf.model || 'qwen2.5-coder:1.5b';
            const provider = resolveProvider(currentSettings, conf.provider);

            const emit = (completion) => {
              const trimmed = trimSuffixOverlap(completion, lineSuffix);
              if (!trimmed) {
                finish(EMPTY);
                return;
              }
              finish({
                items: [{
                  insertText: trimmed,
                  range: buildRange(model, position, lineSuffix),
                }],
              });
            };

            const cacheKey = `${provider.id}|${modelName}|${hashString(prefix.slice(-600))}|${hashString(suffix.slice(0, 600))}|${language}`;
            const cached = lruGet(cacheKey);
            if (cached !== undefined) {
              if (positionUnchanged(editor, position)) emit(cached);
              else finish(EMPTY);
              return;
            }

            setStatus('loading');
            try {
              const completion = await requestCompletion({
                provider,
                modelName,
                prefix,
                suffix,
                language,
                fileName: fileNameOf(model),
                contextFiles: gatherContextFiles(model),
                conf,
                signal: controller.signal,
              });

              setStatus('idle');

              if (!completion || controller.signal.aborted || token.isCancellationRequested) {
                finish(EMPTY);
                return;
              }

              const cleaned = cleanCompletion(completion, {
                modelName, language, prefix, suffix, linePrefix, lineSuffix,
              });
              if (!cleaned) {
                finish(EMPTY);
                return;
              }

              lruPut(cacheKey, cleaned);

              if (!positionUnchanged(editor, position)) {
                finish(EMPTY);
                return;
              }
              emit(cleaned);
            } catch (err) {
              // An aborted request is a normal supersede, not a failure.
              if (isAbortError(err)) setStatus('idle');
              else setStatus('error', err?.message || 'Autocomplete request failed');
              finish(EMPTY);
            }
          }, debounceMs);
        });
      },
      freeInlineCompletions: () => {},
    }
  );

  actionDisposable = editor.addAction({
    id: 'codecast.aiAutocomplete',
    label: 'AI: Trigger Inline Suggestion',
    keybindings: [
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Space,
    ],
    contextMenuGroupId: 'navigation',
    contextMenuOrder: 1,
    run: (ed) => {
      ed.trigger('keyboard', 'editor.action.inlineSuggest.trigger', {});
    },
  });
}

export function disposeAiAutocomplete() {
  settleInflight();
  providerDisposable?.dispose();
  providerDisposable = null;
  actionDisposable?.dispose();
  actionDisposable = null;
  cache.clear();
  setStatus('idle');
}
