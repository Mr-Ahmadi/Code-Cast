import { useContext, memo, useState, useEffect } from "react";
import { GlobalContext } from "../../contexts/GlobalStates";
import { useMode, MODES } from "../../contexts/ModeContext";
import { getFiles, getActiveFile } from "../../functions/record";
import { getFormatterForLanguage, getFormatterDisplayName } from "../../constants/settings";
import { getMonacoLanguage } from "../../services/formatter";
import { onAiStatusChange } from "../../services/autocomplete";
import { FiWifi, FiMonitor, FiCode, FiCheckCircle, FiCpu, FiAlertCircle } from "react-icons/fi";

const StatusBar = memo(() => {
  const { recording, playing, currentWorkspace, fontSize, settings } = useContext(GlobalContext);
  const { mode } = useMode();
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [selectionInfo, setSelectionInfo] = useState(null);
  const [aiStatus, setAiStatus] = useState('idle');

  const files = getFiles();
  const active = getActiveFile();
  const ext = active ? active.split(".").pop().toLowerCase() : "";
  const langMap = { js: "JavaScript", ts: "TypeScript", py: "Python", jsx: "JavaScript", tsx: "TypeScript", html: "HTML", css: "CSS", json: "JSON", md: "Markdown", txt: "Text" };
  const lang = langMap[ext] || ext || "";

  const monacoLang = active ? getMonacoLanguage(active) : null;
  const formatterId = monacoLang ? getFormatterForLanguage(monacoLang, settings) : null;
  const formatName = formatterId ? getFormatterDisplayName(formatterId) : null;
  const formatOnSave = settings?.formatter?.formatOnSave;
  const lspEnabled = settings?.lsp?.enabled;
  const aiEnabled = settings?.aiAutocomplete?.enabled;
  const aiModel = settings?.aiAutocomplete?.model || 'no model set';

  const isLocal = mode === MODES.LOCAL;

  // Monaco reports cursor moves directly, so the status bar does not need to
  // poll or watch the DOM for them.
  useEffect(() => {
    let sub = null;

    const attach = () => {
      const editor = window.__getEditor?.();
      if (!editor) return false;

      const sync = () => {
        const pos = editor.getPosition();
        if (pos) setCursorPos({ line: pos.lineNumber, col: pos.column });
        const sel = editor.getSelection();
        const model = editor.getModel();
        setSelectionInfo(
          sel && model && !sel.isEmpty()
            ? {
                chars: model.getValueInRange(sel).length,
                lines: sel.endLineNumber - sel.startLineNumber + 1,
              }
            : null
        );
      };

      sync();
      // A plain cursor move is a collapsed selection change, so this one event
      // covers both readouts.
      sub = editor.onDidChangeCursorSelection(sync);
      return true;
    };

    // The editor mounts after this component, so retry until it exists.
    if (attach()) return () => sub?.dispose();

    const retry = setInterval(() => {
      if (attach()) clearInterval(retry);
    }, 250);
    return () => {
      clearInterval(retry);
      sub?.dispose();
    };
  }, []);

  useEffect(() => onAiStatusChange(setAiStatus), []);

  return (
    <div className="status-bar" role="status" aria-label="Status Bar">
      <div className="status-bar-left">
        {isLocal ? (
          <span className="status-item status-item-interactive">
            <FiMonitor size={12} className="status-item-icon" />
            <span className="status-item-text">Local</span>
          </span>
        ) : (
          <span className="status-item status-item-interactive">
            <FiWifi size={12} className="status-item-icon" />
            <span className="status-item-text">Online</span>
          </span>
        )}
        {currentWorkspace && (
          <span className="status-item status-item-interactive">{currentWorkspace.name}</span>
        )}
        {recording && (
          <span className="status-item" style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)' }}>
            <span className="recording-dot" style={{ display: "inline-block", marginRight: 6 }} />
            Recording
          </span>
        )}
        {playing && (
          <span className="status-item" style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)' }}>
            <span className="playing-dot" style={{ display: "inline-block", marginRight: 6 }} />
            Playing
          </span>
        )}
      </div>
      <div className="status-bar-right">
        {aiEnabled && (
          <span
            className={`status-item status-item-interactive status-ai status-ai-${aiStatus}`}
            title={
              aiStatus === 'loading' ? 'AI autocomplete: generating a suggestion…'
                : aiStatus === 'error' ? 'AI autocomplete: could not reach Ollama'
                : `AI autocomplete: ready (${aiModel})`
            }
          >
            {aiStatus === 'error'
              ? <FiAlertCircle size={11} className="status-item-icon" />
              : <FiCpu size={11} className={`status-item-icon${aiStatus === 'loading' ? ' status-ai-spin' : ''}`} />}
            <span className="status-item-text">
              {aiStatus === 'loading' ? 'AI…' : aiStatus === 'error' ? 'AI offline' : 'AI'}
            </span>
          </span>
        )}
        {formatOnSave && (
          <span className="status-item status-item-interactive" title="Format on save enabled">
            <FiCheckCircle size={11} className="status-item-icon" />
            <span className="status-item-text">Format on Save</span>
          </span>
        )}
        {lspEnabled && (
          <span className="status-item status-item-interactive" title="Language Server features enabled">
            <FiCode size={11} className="status-item-icon" />
            <span className="status-item-text">LSP</span>
          </span>
        )}
        {lang && (
          <span className="status-item status-item-interactive" title={formatName ? `Language: ${lang}, Formatter: ${formatName}` : `Language: ${lang}`}>
            <FiCode size={12} className="status-item-icon" />
            <span className="status-item-text">{lang}</span>
            {formatName && <span className="status-item-text" style={{ fontSize: 10, opacity: 0.7, marginLeft: 4 }}>{formatName}</span>}
          </span>
        )}
        {files.length > 0 && (
          <span
            className="status-item status-item-interactive"
            title="Go to line"
            onClick={() => { window.__focusEditor?.(); window.__runEditorAction?.('editor.action.gotoLine'); }}
          >
            <span className="status-item-text">
              Ln {cursorPos.line}, Col {cursorPos.col}
              {selectionInfo && ` (${selectionInfo.chars} selected${selectionInfo.lines > 1 ? `, ${selectionInfo.lines} lines` : ''})`}
            </span>
          </span>
        )}
        <span className="status-item status-item-interactive">
          <span className="status-item-text">UTF-8</span>
        </span>
        {fontSize !== 14 && (
          <span className="status-item status-item-interactive">
            <span className="status-item-text">{fontSize}px</span>
          </span>
        )}
      </div>
    </div>
  );
});

StatusBar.displayName = "StatusBar";

export default StatusBar;
