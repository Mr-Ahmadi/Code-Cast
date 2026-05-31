import { useContext, useCallback, useState, memo } from "react";
import { GlobalContext } from "../../contexts/GlobalStates";
import {
  getFiles, getActiveFile, addFile as recordAddFile,
  removeFile as recordRemoveFile, switchFile as recordSwitchFile,
} from "../../functions/record";
import { FiPlus, FiX } from "react-icons/fi";

const FileTabs = memo(() => {
  const { recording, playing, activeFile, setActiveFile, setToast, currentWorkspace } = useContext(GlobalContext);
  const [showNewFile, setShowNewFile] = useState(false);
  const [newFileName, setNewFileName] = useState("");

  const files = getFiles();
  const currentActive = playing ? activeFile : (getActiveFile() || activeFile);

  const handleTabClick = useCallback((name) => {
    if (playing || !currentWorkspace) return;
    recordSwitchFile(name);
    setActiveFile(name);
  }, [playing, currentWorkspace, setActiveFile]);

  const handleAddTab = useCallback(() => {
    if (playing || !currentWorkspace) return;
    const existing = getFiles();
    const unnamedIdx = existing.filter(f => f.name.startsWith("untitled")).length;
    const name = `untitled${unnamedIdx > 0 ? unnamedIdx : ""}.txt`;
    recordAddFile(name, "plaintext", "");
    setActiveFile(name);
    if (recording) {
      recordSwitchFile(name);
    }
  }, [recording, playing, currentWorkspace, setActiveFile]);

  const handleNewFileSubmit = useCallback(() => {
    let name = newFileName.trim();
    if (!name) {
      const files = getFiles();
      const count = files.filter(f => f.name.startsWith("untitled")).length;
      name = `untitled${count > 0 ? count : ""}.txt`;
    }
    if (!name.includes(".")) name += ".txt";
    recordAddFile(name, "", "");
    setActiveFile(name);
    if (recording) {
      recordSwitchFile(name);
    }
    setShowNewFile(false);
    setNewFileName("");
  }, [newFileName, recording, setActiveFile]);

  const handleCloseTab = useCallback((e, name) => {
    e.stopPropagation();
    if (playing || !currentWorkspace) return;
    const files = getFiles();
    if (files.length <= 1) {
      setToast({ type: "WARNING", message: "Cannot remove the last file" });
      return;
    }
    recordRemoveFile(name);
    const remaining = getFiles();
    if (remaining.length > 0) {
      if (name === currentActive) {
        setActiveFile(remaining[0].name);
      }
    }
  }, [playing, currentActive, setActiveFile, setToast, currentWorkspace]);

  return (
    <div className={"file-tabs" + (files.length === 0 ? " file-tabs-empty" : "")}>
      <div className="file-tabs-list">
        {files.map((f) => (
          <div
            key={f.name}
            className={"file-tab" + (f.name === currentActive ? " active" : "") + (playing ? " no-interact" : "")}
            onClick={() => handleTabClick(f.name)}
            title={f.name}
          >
            <span className="file-tab-icon" />
            <span className="file-tab-name">{f.name}</span>
            {files.length > 1 && !playing && (
              <button
                className="file-tab-close"
                onClick={(e) => handleCloseTab(e, f.name)}
                aria-label={`Close ${f.name}`}
                tabIndex={-1}
              >
                <FiX size={10} />
              </button>
            )}
          </div>
        ))}
        {!playing && (
          <button className="file-tab-add" onClick={handleAddTab} title="Add file" aria-label="Add file">
            <FiPlus size={12} />
          </button>
        )}
      </div>
      {showNewFile && (
        <div className="file-tab-new-input">
          <input
            autoFocus
            type="text"
            className="text-input"
            placeholder="filename.ext"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleNewFileSubmit();
              if (e.key === "Escape") setShowNewFile(false);
            }}
            onBlur={() => setTimeout(() => setShowNewFile(false), 200)}
          />
          <button className="btn btn-sm btn-primary" onClick={handleNewFileSubmit}>Add</button>
        </div>
      )}

    </div>
  );
});

FileTabs.displayName = "FileTabs";

export default FileTabs;
