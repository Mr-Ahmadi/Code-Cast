import { useContext, memo } from "react";
import { GlobalContext } from "../../contexts/GlobalStates";
import { useMode, MODES } from "../../contexts/ModeContext";
import { getFiles, getActiveFile } from "../../functions/record";
import { FiWifi, FiWifiOff, FiMonitor, FiCode } from "react-icons/fi";

const StatusBar = memo(() => {
  const { recording, playing, currentWorkspace, fontSize, audioEnabled } = useContext(GlobalContext);
  const { mode } = useMode();

  const files = getFiles();
  const active = getActiveFile();
  const ext = active ? active.split(".").pop().toLowerCase() : "";
  const langMap = { js: "JavaScript", ts: "TypeScript", py: "Python", jsx: "JavaScript", tsx: "TypeScript", html: "HTML", css: "CSS", json: "JSON", md: "Markdown", txt: "Text" };
  const lang = langMap[ext] || ext || "";

  const isLocal = mode === MODES.LOCAL;

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
        {lang && (
          <span className="status-item status-item-interactive" title="Language">
            <FiCode size={12} className="status-item-icon" />
            <span className="status-item-text">{lang}</span>
          </span>
        )}
        {files.length > 0 && (
          <span className="status-item status-item-interactive">
            <span className="status-item-text">Ln 1, Col 1</span>
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
