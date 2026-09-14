import { resolveProvider, complete, chat, isAbortError, stripCodeFences, stripThinking } from './llm';
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

function gatherContextFiles(model) {
  if (!currentSettings?.aiAutocomplete?.useOpenFileContext) return [];
  try {
    const all = typeof window.__getAllModelContents === 'function' ? (window.__getAllModelContents() || {}) : {};
    const entries = Object.entries(all);
    if (!entries.length) return [];

    // model.uri is file:///<relative name>, matching the keys above.
    const currentName = decodeURIComponent(model?.uri?.path || '').replace(/^\/+/, '');
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

export function cleanCompletion(text, modelName) {
  let cleaned = stripSentinels(text, modelName);

  let lines = cleaned.split('\n').map(l => l.trimEnd());
  while (lines.length && lines[0].trim() === '') lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();

  // Small models like to append an English explanation after the code. Cut at
  // the first run of two consecutive prose-looking lines.
  const isProseLine = (l) => {
    const t = l.trimStart();
    return t.length > 50 && /^[A-Z][a-z]/.test(t) && !/[{}()[\];]/.test(l)
      && !/^(def |class |import |from |if |for |while |return |print\b)/.test(t);
  };
  for (let i = 1; i < lines.length - 1; i++) {
    if (isProseLine(lines[i]) && isProseLine(lines[i + 1])) {
      lines = lines.slice(0, i);
      break;
    }
  }

  if (!currentSettings?.aiAutocomplete?.multiline) {
    lines = lines.length ? [lines[0]] : [];
  }

  // Only the trailing edge is safe to trim: leading indentation is meaningful.
  return lines.join('\n').replace(/\s+$/, '');
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
  'You are a code completion engine inside an IDE.',
  'The user sends source code containing a <CURSOR> marker.',
  'Reply with ONLY the text to insert at <CURSOR> so the code continues naturally.',
  'Never repeat code that already appears before or after the cursor.',
  'No explanations, no markdown fences. If nothing should be inserted, reply with nothing.',
].join('\n');

/** provider|model pairs whose endpoint turned out to have no raw-completions route. */
const chatOnlyModels = new Set();

function usesChatPrompt(conf, provider, modelName) {
  if (conf.promptMode === 'chat') return true;
  if (conf.promptMode === 'fim') return false;
  return !supportsFim(modelName) || chatOnlyModels.has(`${provider.id}|${modelName}`);
}

async function requestCompletion({ provider, modelName, prefix, suffix, linePrefix, language, contextFiles, conf, signal }) {
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
      const { prompt, stop } = buildFimPrompt({ model: modelName, prefix, suffix, contextFiles });
      return await complete({ ...common, prompt, stop });
    } catch (err) {
      // Hosted chat-only APIs (OpenAI, Groq, …) have no /completions route.
      const noCompletionsRoute = provider.id === 'openai' && [400, 404, 405, 501].includes(err?.status);
      if (!noCompletionsRoute || conf.promptMode === 'fim') throw err;
      chatOnlyModels.add(`${provider.id}|${modelName}`);
    }
  }

  const related = contextFiles.slice(0, 3)
    .map((f) => `--- ${f.name}\n${f.content.slice(0, 1500)}`)
    .join('\n');
  const reply = await chat({
    ...common,
    messages: [
      { role: 'system', content: CHAT_COMPLETION_PROMPT },
      {
        role: 'user',
        content: `${related ? `Related files:\n${related}\n\n` : ''}Language: ${language}\n\n${prefix}<CURSOR>${suffix}`,
      },
    ],
  });

  let text = stripCodeFences(stripThinking(reply)).replace(/<CURSOR>/g, '');
  // Chat models often restate the line they were asked to continue.
  const typed = linePrefix.trimStart();
  if (typed && text.trimStart().startsWith(typed)) {
    text = text.trimStart().slice(typed.length);
  }
  return text;
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
                linePrefix,
                language,
                contextFiles: gatherContextFiles(model),
                conf,
                signal: controller.signal,
              });

              setStatus('idle');

              if (!completion || controller.signal.aborted || token.isCancellationRequested) {
                finish(EMPTY);
                return;
              }

              const cleaned = cleanCompletion(completion, modelName);
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
