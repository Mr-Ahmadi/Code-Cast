import { useContext, memo } from "react";
import { GlobalContext } from "../../contexts/GlobalStates";
import { FiFolder, FiTerminal, FiSettings, FiCodepen } from "react-icons/fi";
import { useMode, MODES } from "../../contexts/ModeContext";

const ActivityBar = memo(() => {
  const { sidebarOpen, setSidebarOpen } = useContext(GlobalContext);
  const { mode } = useMode();

  return (
    <div className="activity-bar" role="navigation" aria-label="Activity Bar">
      <div className="activity-bar-top">
        <button
          className={`activity-btn${sidebarOpen ? " active" : ""}`}
          onClick={() => setSidebarOpen(!sidebarOpen)}
          title="Explorer"
          aria-label="Toggle Explorer"
        >
          <FiFolder />
        </button>
        <button
          className="activity-btn"
          onClick={() => window.__setTerminalVisible?.(v => !v)}
          title="Terminal"
          aria-label="Toggle Terminal"
        >
          <FiTerminal />
        </button>
      </div>
      <div className="activity-bar-bottom">
        <button
          className="activity-btn"
          onClick={() => window.__openProjectDialog?.()}
          title="Open Project"
          aria-label="Open Project"
        >
          <FiCodepen />
        </button>
        <button
          className="activity-btn"
          title={`Mode: ${mode === MODES.LOCAL ? "Local" : "Online"}`}
          aria-label="Mode"
        >
          <FiSettings />
        </button>
      </div>
    </div>
  );
});

ActivityBar.displayName = "ActivityBar";

export default ActivityBar;
