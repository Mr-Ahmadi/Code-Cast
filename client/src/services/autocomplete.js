import { ollamaCompletion } from './ollama';
import { buildFimPrompt, stripSentinels } from './fim';

let canceledHandlerAdded = false;
function suppressMonacoCanceled() {
  if (canceledHandlerAdded) return;
  canceledHandlerAdded = true;
  window.addEventListener('unhandledrejection', (e) => {
    if (e.reason?.name === 'Canceled') e.preventDefault();
  });
}

let currentRequest = null;
let currentSettings = null;
let providerDisposable = null;
let debounceTimer = null;

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

/** Rough comment detection. Returns the delimiter when the cursor is inside a comment. */
function commentDelimiterAt(model, position) {
  const line = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
  const trimmed = line.trimStart();
  const delimiters = [
    ['//', 'js', 'ts', 'c', 'cpp', 'java', 'go', 'rust', 'php', 'swift', 'kt', 'dart', 'scala'],
    ['#', 'py', 'rb', 'r', 'sh', 'yaml', 'yml', 'toml'],
    ['<!--', 'html', 'xml', 'vue'],
    ['/*', 'css', 'scss', 'less'],
    ['*', 'md'],
    ['--', 'sql'],
  ];
  const lang = model.getLanguageId();
  for (const [delim, ...langs] of delimiters) {
    if (langs.includes(lang) && trimmed.startsWith(delim)) return delim;
  }
  if (line.includes('/*') && !line.slice(0, position.column - 1).split('*/').pop().includes('*/')) return '/*';
  return null;
}

function gatherContextFiles(editor, model) {
  const setting = currentSettings?.aiAutocomplete?.useOpenFileContext;
  if (!setting) return [];
  try {
    const all = typeof window.__getAllModelContents === 'function' ? (window.__getAllModelContents() || {}) : {};
    const entries = Object.entries(all);
    if (!entries.length) return [];
    const currentPath = model?.uri?.path || '';
    const currentDir = currentPath.slice(0, currentPath.lastIndexOf('/'));
    const scored = entries.map(([name, content]) => {
      let score = 0;
      const nameDir = name.slice(0, name.lastIndexOf('/'));
      if (nameDir === currentDir) score += 2;
      if (nameDir.startsWith(currentDir)) score += 1;
      if (nameDir) score += 0.5;
      if (content && content.trim()) score += 0.5;
      return { name, content, score };
    }).filter(e => e.score > 0).sort((a, b) => b.score - a.score);
    return scored.slice(0, 6).map(({ name, content }) => ({ name, content: String(content).slice(0, 4000) }));
  } catch {
    return [];
  }
}

function cleanCompletion(text, modelName) {
  let cleaned = stripSentinels(text, modelName);

  let lines = cleaned.split('\n');
  lines = lines.map(l => l.trimEnd());
  while (lines.length && lines[0].trim() === '') lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();

  const isProseLine = (l) => {
    const t = l.trimStart();
    return t.length > 50 && /^[A-Z][a-z]/.test(t) && !/[{}()[\];]/.test(l) && !/^(def |class |import |from |if |for |while |return |print\b)/.test(t);
  };
  for (let i = 1; i < lines.length; i++) {
    if (isProseLine(lines[i]) && isProseLine(lines[Math.min(i + 1, lines.length - 1)])) {
      lines = lines.slice(0, i);
      break;
    }
  }

  if (!currentSettings?.aiAutocomplete?.multiline) {
    let single = lines[0] || '';
    while (lines.length > 1 && lines[1] && !lines[1].trim()) {
      lines.shift();
    }
    lines = [single];
  }

  return lines.join('\n').trim();
}

export function registerAiAutocomplete(editor, monaco, settings) {
  currentSettings = settings;
  suppressMonacoCanceled();

  if (!settings?.aiAutocomplete?.enabled) return;

  editor.updateOptions({ inlineSuggest: { enabled: true } });

  providerDisposable = monaco.languages.registerInlineCompletionsProvider(
    [{ pattern: '**' }],
    {
      provideInlineCompletions: (model, position, context, token) => {
        const conf = currentSettings?.aiAutocomplete;
        if (!conf?.enabled) return { items: [] };
        const language = model.getLanguageId();
        if (!language || language === 'plaintext') return { items: [] };

        const lineContent = model.getLineContent(position.lineNumber).slice(0, position.column - 1).trim();
        if (!lineContent) return { items: [] };

        if (conf.skipInComments && commentDelimiterAt(model, position)) {
          return { items: [] };
        }

        return new Promise((resolve) => {
          if (token.isCancellationRequested) {
            resolve({ items: [] });
            return;
          }

          if (debounceTimer) clearTimeout(debounceTimer);

          const debounceMs = conf.debounceMs ?? 350;
          debounceTimer = setTimeout(async () => {
            if (token.isCancellationRequested) { resolve({ items: [] }); return; }

            if (currentRequest) currentRequest.abort();
            const controller = new AbortController();
            currentRequest = controller;

            const text = model.getValue();
            const offset = model.getOffsetAt(position);
            const maxPrefix = conf.maxPrefixChars ?? 4000;
            const maxSuffix = conf.maxSuffixChars ?? 1500;
            const prefix = text.slice(Math.max(0, offset - maxPrefix), offset);
            const suffix = text.slice(offset, offset + maxSuffix);
            const modelName = conf.model || 'qwen2.5-coder:1.5b';

            const contextFiles = gatherContextFiles(editor, model);
            const { prompt, stop } = buildFimPrompt({ model: modelName, prefix, suffix, contextFiles });

            const cacheKey = `${modelName}|${hashString(prefix.slice(-600))}|${hashString(suffix.slice(0, 600))}|${language}`;
            const cached = lruGet(cacheKey);
            if (cached !== undefined) {
              const currentPos = editor.getPosition();
              if (currentPos && currentPos.lineNumber === position.lineNumber && currentPos.column === position.column) {
                resolve({
                  items: [{
                    insertText: cached + '\n',
                    range: {
                      startLineNumber: position.lineNumber,
                      startColumn: position.column,
                      endLineNumber: position.lineNumber,
                      endColumn: model.getLineMaxColumn(position.lineNumber),
                    },
                  }],
                });
                return;
              }
            }

            const dispose = token.onCancellationRequested(() => {
              controller.abort();
              resolve({ items: [] });
            });

            try {
              const completion = await ollamaCompletion({
                model: modelName,
                prompt,
                ollamaUrl: conf.ollamaUrl,
                signal: controller.signal,
                stop,
                temperature: conf.temperature ?? 0.1,
                numPredict: conf.maxTokens ?? 128,
                timeout: conf.requestTimeoutMs ?? 12000,
              });

              dispose.dispose();

              if (!completion || controller.signal.aborted || token.isCancellationRequested) {
                resolve({ items: [] }); return;
              }

              let cleaned = cleanCompletion(completion, modelName);
              if (!cleaned) { resolve({ items: [] }); return; }

              lruPut(cacheKey, cleaned);

              const currentPos = editor.getPosition();
              if (!currentPos || currentPos.lineNumber !== position.lineNumber || currentPos.column !== position.column) {
                resolve({ items: [] }); return;
              }

              resolve({
                items: [{
                  insertText: cleaned + '\n',
                  range: {
                    startLineNumber: position.lineNumber,
                    startColumn: position.column,
                    endLineNumber: position.lineNumber,
                    endColumn: model.getLineMaxColumn(position.lineNumber),
                  },
                }],
              });
            } catch (err) {
              dispose.dispose();
              if (err?.name === 'AbortError') { resolve({ items: [] }); return; }
              resolve({ items: [] });
            }
          }, debounceMs);

          token.onCancellationRequested(() => {
            clearTimeout(debounceTimer);
            if (currentRequest) currentRequest.abort();
            resolve({ items: [] });
          });
        });
      },
      freeInlineCompletions: () => {},
    }
  );

  editor.addAction({
    id: 'codecast.aiAutocomplete',
    label: 'AI Autocomplete (Ollama)',
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
  if (currentRequest) { currentRequest.abort(); currentRequest = null; }
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
  if (providerDisposable) { providerDisposable.dispose(); providerDisposable = null; }
  cache.clear();
}
