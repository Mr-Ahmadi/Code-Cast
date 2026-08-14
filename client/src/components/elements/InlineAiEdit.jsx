import { useState, useCallback, useRef, useEffect, useContext, memo } from 'react';
import { diffLines } from 'diff';
import { GlobalContext } from '../../contexts/GlobalStates';
import { streamAiEdit } from '../../services/aiEdit';
import {
  FiZap, FiX, FiCheck, FiRefreshCw, FiCornerDownLeft, FiLoader,
} from 'react-icons/fi';

const PROMPT_PRESETS = [
  'Add error handling',
  'Add JSDoc comments',
  'Simplify this',
  'Convert to async/await',
  'Extract into a function',
  'Add type annotations',
];

/** How much surrounding code is sent so the rewrite matches its neighbours. */
const CONTEXT_LINES = 40;

function buildDiff(original, revised) {
  const parts = diffLines(original, revised);
  const rows = [];
  for (const part of parts) {
    const kind = part.added ? 'added' : part.removed ? 'removed' : 'same';
    const lines = part.value.split('\n');
    // A trailing newline yields an empty final entry that is not a real line.
    if (lines[lines.length - 1] === '') lines.pop();
    for (const line of lines) rows.push({ kind, line });
  }
  return rows;
}

/** Collapses long runs of unchanged lines so the preview stays scannable. */
function collapseUnchanged(rows, keep = 2) {
  const out = [];
  let run = [];
  const flush = () => {
    if (!run.length) return;
    if (run.length <= keep * 2 + 1) {
      out.push(...run);
    } else {
      out.push(...run.slice(0, keep));
      out.push({ kind: 'gap', line: `⋯ ${run.length - keep * 2} unchanged lines` });
      out.push(...run.slice(-keep));
    }
    run = [];
  };
  for (const row of rows) {
    if (row.kind === 'same') run.push(row);
    else { flush(); out.push(row); }
  }
  flush();
  return out;
}

const InlineAiEdit = memo(() => {
  const { settings, setToast } = useContext(GlobalContext);
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [anchor, setAnchor] = useState({ top: 0, left: 0 });

  const inputRef = useRef(null);
  const abortRef = useRef(null);
  /** The exact region being rewritten, captured when the widget opens. */
  const targetRef = useRef(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const conf = settings?.aiEdit;

  const close = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setOpen(false);
    setStreaming(false);
    setResult(null);
    setError(null);
    setInstruction('');
    targetRef.current = null;
    window.__focusEditor?.();
  }, []);

  const positionAt = useCallback((editor, lineNumber) => {
    try {
      const visible = editor.getScrolledVisiblePosition({ lineNumber, column: 1 });
      if (visible) {
        setAnchor({ top: Math.max(4, visible.top + visible.height + 4), left: 0 });
        return;
      }
    } catch { /* editor not laid out yet */ }
    setAnchor({ top: 8, left: 0 });
  }, []);

  const openWidget = useCallback(() => {
    const editor = window.__getEditor?.();
    const model = editor?.getModel?.();
    if (!editor || !model) {
      setToast({ type: 'WARNING', message: 'Open a file before using AI edit.' });
      return;
    }
    if (conf?.enabled === false) {
      setToast({ type: 'WARNING', message: 'AI edit is disabled. Enable it in Settings.' });
      return;
    }

    const selection = editor.getSelection();
    if (!selection) return;
    const hasSelection = !selection.isEmpty();

    // With no selection the current line is the region, which makes Cmd+K on a
    // bare line behave like "rewrite this line" rather than silently doing nothing.
    const range = hasSelection
      ? {
          startLineNumber: selection.startLineNumber,
          startColumn: selection.startColumn,
          endLineNumber: selection.endLineNumber,
          endColumn: selection.endColumn,
        }
      : {
          startLineNumber: selection.startLineNumber,
          startColumn: 1,
          endLineNumber: selection.startLineNumber,
          endColumn: model.getLineMaxColumn(selection.startLineNumber),
        };

    targetRef.current = {
      range,
      code: model.getValueInRange(range),
      language: model.getLanguageId(),
      prefix: model.getValueInRange({
        startLineNumber: Math.max(1, range.startLineNumber - CONTEXT_LINES),
        startColumn: 1,
        endLineNumber: range.startLineNumber,
        endColumn: 1,
      }),
      suffix: model.getValueInRange({
        startLineNumber: range.endLineNumber,
        startColumn: model.getLineMaxColumn(range.endLineNumber),
        endLineNumber: Math.min(model.getLineCount(), range.endLineNumber + CONTEXT_LINES),
        endColumn: model.getLineMaxColumn(Math.min(model.getLineCount(), range.endLineNumber + CONTEXT_LINES)),
      }),
      versionId: model.getVersionId(),
    };

    positionAt(editor, range.endLineNumber);
    setResult(null);
    setError(null);
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [conf?.enabled, positionAt, setToast]);

  useEffect(() => {
    window.__openInlineAiEdit = openWidget;
    return () => { window.__openInlineAiEdit = undefined; };
  }, [openWidget]);

  const run = useCallback(async (rawInstruction) => {
    const text = rawInstruction?.trim();
    const target = targetRef.current;
    if (!text || !target || streaming) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setStreaming(true);
    setError(null);
    setResult('');

    try {
      const rewritten = await streamAiEdit({
        instruction: text,
        code: target.code,
        language: target.language,
        fileName: window.__activeFile,
        prefix: target.prefix,
        suffix: target.suffix,
        settings: settingsRef.current,
        signal: controller.signal,
        onProgress: (partial) => setResult(partial),
      });
      setResult(rewritten);
      if (!rewritten.trim()) setError('The model returned an empty result.');
    } catch (err) {
      if (err?.name !== 'AbortError') {
        setError(err?.message || 'Failed to reach the AI model.');
        setResult(null);
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [streaming]);

  const accept = useCallback(() => {
    const editor = window.__getEditor?.();
    const model = editor?.getModel?.();
    const target = targetRef.current;
    if (!editor || !model || !target || !result) return;

    // The file may have changed underneath us (file watcher, playback, undo).
    if (model.getVersionId() !== target.versionId) {
      setError('The file changed since this edit was generated. Run it again.');
      return;
    }

    editor.executeEdits('ai-inline-edit', [{
      range: target.range,
      text: result,
      forceMoveMarkers: true,
    }]);
    editor.pushUndoStop();
    setToast({ type: 'SUCCESS', message: 'AI edit applied' });
    close();
  }, [result, close, setToast]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (result && !streaming) accept();
      else run(instruction);
    }
  }, [close, run, instruction, result, streaming, accept]);

  // Keep the widget pinned to its region while the user scrolls.
  useEffect(() => {
    if (!open) return;
    const editor = window.__getEditor?.();
    if (!editor) return;
    const sub = editor.onDidScrollChange(() => {
      const line = targetRef.current?.range?.endLineNumber;
      if (line) positionAt(editor, line);
    });
    return () => sub.dispose();
  }, [open, positionAt]);

  if (!open) return null;

  const target = targetRef.current;
  // An empty result is the moment before the first token arrives; diffing it
  // would flash the whole region as deleted.
  const diffRows = result && target
    ? collapseUnchanged(buildDiff(target.code, result))
    : null;
  const unchanged = !!result && !!target && result === target.code;

  return (
    <div
      className="inline-ai-edit"
      style={{ top: anchor.top }}
      role="dialog"
      aria-label="AI edit"
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
    >
      <div className="inline-ai-edit-header">
        <span className="inline-ai-edit-title">
          <FiZap size={12} /> AI Edit
          {conf?.model && <span className="inline-ai-edit-model">{conf.model}</span>}
        </span>
        <span className="inline-ai-edit-scope">
          {target
            ? `${target.range.startLineNumber === target.range.endLineNumber
                ? `Line ${target.range.startLineNumber}`
                : `Lines ${target.range.startLineNumber}–${target.range.endLineNumber}`}`
            : ''}
        </span>
        <button className="inline-ai-edit-close" onClick={close} aria-label="Close">
          <FiX size={14} />
        </button>
      </div>

      <div className="inline-ai-edit-input-row">
        <input
          ref={inputRef}
          className="inline-ai-edit-input"
          value={instruction}
          onChange={(e) => {
            setInstruction(e.target.value);
            // Editing the prompt invalidates the preview, so Enter goes back to
            // meaning "generate" rather than accepting a stale result.
            if (result !== null) { setResult(null); setError(null); }
          }}
          onKeyDown={handleKeyDown}
          placeholder="Describe the change… (Enter to generate, Esc to cancel)"
          disabled={streaming}
        />
        {streaming ? (
          <button className="inline-ai-edit-btn" onClick={() => abortRef.current?.abort()}>
            <FiLoader size={11} className="inline-ai-spin" /> Stop
          </button>
        ) : (
          <button
            className="inline-ai-edit-btn inline-ai-edit-btn-primary"
            onClick={() => run(instruction)}
            disabled={!instruction.trim()}
          >
            <FiCornerDownLeft size={11} /> Generate
          </button>
        )}
      </div>

      {result === null && !streaming && (
        <div className="inline-ai-edit-presets">
          {PROMPT_PRESETS.map((preset) => (
            <button
              key={preset}
              className="inline-ai-edit-chip"
              onClick={() => { setInstruction(preset); run(preset); }}
            >
              {preset}
            </button>
          ))}
        </div>
      )}

      {error && <div className="inline-ai-edit-error">{error}</div>}

      {diffRows && (
        <>
          <div className="inline-ai-edit-diff">
            {unchanged ? (
              <div className="inline-ai-edit-diff-empty">No changes suggested.</div>
            ) : (
              diffRows.map((row, i) => (
                <div key={i} className={`inline-ai-diff-row inline-ai-diff-${row.kind}`}>
                  <span className="inline-ai-diff-marker">
                    {row.kind === 'added' ? '+' : row.kind === 'removed' ? '−' : ' '}
                  </span>
                  <span className="inline-ai-diff-text">{row.line || ' '}</span>
                </div>
              ))
            )}
          </div>

          {!streaming && (
            <div className="inline-ai-edit-actions">
              <button
                className="inline-ai-edit-btn inline-ai-edit-btn-primary"
                onClick={accept}
                disabled={unchanged || !result.trim()}
              >
                <FiCheck size={11} /> Accept
              </button>
              <button className="inline-ai-edit-btn" onClick={() => run(instruction)}>
                <FiRefreshCw size={11} /> Retry
              </button>
              <button className="inline-ai-edit-btn" onClick={close}>
                <FiX size={11} /> Discard
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
});

InlineAiEdit.displayName = 'InlineAiEdit';

export default InlineAiEdit;
