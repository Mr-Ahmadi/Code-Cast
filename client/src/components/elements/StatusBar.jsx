import { useContext, memo, useState, useEffect } from "react";
import { GlobalContext } from "../../contexts/GlobalStates";
import { useMode, MODES } from "../../contexts/ModeContext";
import { getFiles, getActiveFile } from "../../functions/record";
import { getFormatterForLanguage, getFormatterDisplayName } from "../../constants/settings";
import { getMonacoLanguage } from "../../services/formatter";
import { FiWifi, FiMonitor, FiCode, FiCheckCircle } from "react-icons/fi";

const StatusBar = memo(() => {
  const { recording, playing, currentWorkspace, fontSize, settings } = useContext(GlobalContext);
  const { mode } = useMode();
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });

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

  const isLocal = mode === MODES.LOCAL;

  useEffect(() => {
    const el = document.querySelector('.editor-monaco-wrapper');
    if (!el) return;
    const observer = new MutationObserver(() => {
      const lineCol = el.querySelector('.line-numbers');
      if (lineCol) {
        const match = lineCol.textContent?.match(/(\d+)/);
        if (match) setCursorPos({ line: parseInt(match[1]), col: 1 });
      }
    });
    observer.observe(el, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const editor = window.__getEditor?.();
        if (editor) {
          const pos = editor.getPosition();
          if (pos) setCursorPos({ line: pos.lineNumber, col: pos.column });
        }
      } catch {}
    }, 200);
    return () => clearInterval(interval);
  }, []);

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
          <span className="status-item status-item-interactive">
            <span className="status-item-text">Ln {cursorPos.line}, Col {cursorPos.col}</span>
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
