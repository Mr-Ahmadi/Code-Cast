import { ollamaCompletion } from './ollama';

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

function buildPrompt(language, prefix, suffix) {
  return `<|fim_prefix|>${prefix}<|fim_suffix|>${suffix}<|fim_middle|>`;
}

export function updateAiSettings(settings) {
  currentSettings = settings;
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
        if (!currentSettings?.aiAutocomplete?.enabled) return { items: [] };
        const language = model.getLanguageId();
        if (!language || language === 'plaintext') return { items: [] };
        const lineContent = model.getLineContent(position.lineNumber).slice(0, position.column - 1).trim();
        if (!lineContent) return { items: [] };

        return new Promise((resolve) => {
          if (token.isCancellationRequested) {
            resolve({ items: [] });
            return;
          }

          if (debounceTimer) clearTimeout(debounceTimer);

          debounceTimer = setTimeout(async () => {
            if (token.isCancellationRequested) { resolve({ items: [] }); return; }

            if (currentRequest) currentRequest.abort();
            const controller = new AbortController();
            currentRequest = controller;

            const text = model.getValue();
            const offset = model.getOffsetAt(position);
            const maxPrefix = 2048;
            const maxSuffix = 512;
            const prefix = text.slice(Math.max(0, offset - maxPrefix), offset);
            const suffix = text.slice(offset, offset + maxSuffix);
            const prompt = buildPrompt(language, prefix, suffix);

            const dispose = token.onCancellationRequested(() => {
              controller.abort();
              resolve({ items: [] });
            });

            try {
              const { model: modelName, ollamaUrl } = currentSettings.aiAutocomplete;
              const completion = await ollamaCompletion({
                model: modelName, prompt, ollamaUrl, signal: controller.signal,
              });

              dispose.dispose();

              if (!completion || controller.signal.aborted || token.isCancellationRequested) {
                resolve({ items: [] }); return;
              }

              let cleaned = completion;

              if (modelName.includes('qwen')) {
                const fimEnd = cleaned.indexOf('<|fim_middle|>');
                if (fimEnd !== -1) cleaned = cleaned.slice(fimEnd + '<|fim_middle|>'.length);
                const endTok = cleaned.indexOf('<|endoftext|>');
                if (endTok !== -1) cleaned = cleaned.slice(0, endTok);
              }

              let lines = cleaned.split('\n');
              lines = lines.map(l => l.trimEnd());
              while (lines.length && lines[0].trim() === '') lines.shift();
              while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();

              // Truncate at explanatory prose (model sometimes continues with docs after code)
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

              if (lines.length > 10) lines = lines.slice(0, 10);
              cleaned = lines.join('\n');

              if (!cleaned.trim()) { resolve({ items: [] }); return; }

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
          }, 800);

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
}
