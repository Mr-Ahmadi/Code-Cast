import { useContext, memo } from "react";
import { GlobalContext } from "../../contexts/GlobalStates";
import { FiFolder, FiTerminal, FiSettings, FiCodepen, FiGitBranch } from "react-icons/fi";
import PropTypes from "prop-types";

const ActivityBar = memo(({ activeSidebarPanel, setActiveSidebarPanel }) => {
  const { sidebarOpen, setSidebarOpen, settingsOpen, setSettingsOpen } = useContext(GlobalContext);

  const handleExplorer = () => {
    if (sidebarOpen && activeSidebarPanel === "explorer") {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
      setActiveSidebarPanel("explorer");
    }
  };

  const handleSourceControl = () => {
    if (sidebarOpen && activeSidebarPanel === "git") {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
      setActiveSidebarPanel("git");
    }
  };

  return (
    <div className="activity-bar" role="navigation" aria-label="Activity Bar">
      <div className="activity-bar-top">
        <button
          className={`activity-btn${sidebarOpen && activeSidebarPanel === "explorer" ? " active" : ""}`}
          onClick={handleExplorer}
          title="Explorer"
          aria-label="Toggle Explorer"
        >
          <FiFolder />
        </button>
        <button
          className={`activity-btn${sidebarOpen && activeSidebarPanel === "git" ? " active" : ""}`}
          onClick={handleSourceControl}
          title="Source Control"
          aria-label="Toggle Source Control"
        >
          <FiGitBranch />
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
          className={`activity-btn${settingsOpen ? " active" : ""}`}
          onClick={() => setSettingsOpen(!settingsOpen)}
          title="Settings"
          aria-label="Toggle Settings"
        >
          <FiSettings />
        </button>
      </div>
    </div>
  );
});

ActivityBar.displayName = "ActivityBar";

export default ActivityBar;
