import { useContext, useCallback, useState, useEffect, memo } from "react";
import { GlobalContext } from "../../contexts/GlobalStates";
import {
  getFiles, getActiveFile, addFile as recordAddFile,
  switchFile as recordSwitchFile,
} from "../../functions/record";
import { FiPlus, FiX, FiFileText, FiCode, FiImage } from "react-icons/fi";

const tabIcon = (name) => {
  const ext = name.split(".").pop().toLowerCase();
  switch (ext) {
    case "js": case "jsx": case "ts": case "tsx":
    case "html": case "htm":
    case "css": case "scss": case "less":
      return <FiCode size={12} />;
    case "png": case "jpg": case "jpeg": case "gif": case "svg":
      return <FiImage size={12} />;
    default:
      return <FiFileText size={12} />;
  }
};

const sameArray = (a = [], b = []) => (
  a.length === b.length && a.every((item, index) => item === b[index])
);

const FileTabs = memo(() => {
  const { recording, playing, activeFile, files, setActiveFile, currentWorkspace } = useContext(GlobalContext);
  const [showNewFile, setShowNewFile] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [openTabs, setOpenTabs] = useState(() => files.map((f) => f.name));

  const currentActive = playing ? activeFile : (getActiveFile() || activeFile);
  const visibleTabs = openTabs
    .map((name) => files.find((f) => f.name === name))
    .filter(Boolean);

  useEffect(() => {
    const existingNames = new Set(files.map((f) => f.name));
    setOpenTabs((prev) => {
      let next = prev.filter((name) => existingNames.has(name));
      if (currentActive && existingNames.has(currentActive) && !next.includes(currentActive)) {
        next = [...next, currentActive];
      }
      if (next.length === 0 && files.length > 0) {
        const fallback = (currentActive && existingNames.has(currentActive)) ? currentActive : files[0].name;
        next = [fallback];
      }
      return sameArray(prev, next) ? prev : next;
    });
  }, [files, currentActive]);

  useEffect(() => {
    if (currentActive) {
      setOpenTabs((prev) => (prev.includes(currentActive) ? prev : [...prev, currentActive]));
    }
  }, [currentActive]);

  const createWorkspaceFile = useCallback(async (name, content = "") => {
    const f = window.electronAPI?.file;
    if (!window.electronAPI?.isElectron || !f || !currentWorkspace?.path) {
      return true;
    }

    try {
      const normalized = name.replace(/^\/+/, "");
      const fullPath = `${currentWorkspace.path}/${normalized}`;
      const parentDir = fullPath.split('/').slice(0, -1).join('/');
      if (parentDir) {
        await f.mkdir(parentDir);
      }
      const ok = await f.write(fullPath, content);
      return !!ok;
    } catch {
      return false;
    }
  }, [currentWorkspace?.path]);

  const handleTabClick = useCallback((name) => {
    if (playing || !currentWorkspace) return;
    setOpenTabs((prev) => (prev.includes(name) ? prev : [...prev, name]));
    recordSwitchFile(name);
    setActiveFile(name);
  }, [playing, currentWorkspace, setActiveFile]);

  const handleAddTab = useCallback(async () => {
    if (playing || !currentWorkspace) return;
    const existing = getFiles();
    const unnamedIdx = existing.filter(f => f.name.startsWith("untitled")).length;
    const name = `untitled${unnamedIdx > 0 ? unnamedIdx : ""}.txt`;

    const created = await createWorkspaceFile(name, "");
    if (!created) {
      return;
    }

    recordAddFile(name, "plaintext", "");
    setOpenTabs((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setActiveFile(name);
    if (recording) {
      recordSwitchFile(name);
    }
  }, [recording, playing, currentWorkspace, setActiveFile, createWorkspaceFile]);

  const handleNewFileSubmit = useCallback(async () => {
    let name = newFileName.trim();
    if (!name) {
      const count = files.filter(f => f.name.startsWith("untitled")).length;
      name = `untitled${count > 0 ? count : ""}.txt`;
    }
    if (!name.includes(".")) name += ".txt";

    const created = await createWorkspaceFile(name, "");
    if (!created) {
      return;
    }

    recordAddFile(name, "", "");
    setOpenTabs((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setActiveFile(name);
    if (recording) {
      recordSwitchFile(name);
    }
    setShowNewFile(false);
    setNewFileName("");
  }, [newFileName, recording, setActiveFile, files, createWorkspaceFile]);

  useEffect(() => {
    window.__createNewFile = async () => {
      await handleAddTab();
    };
    return () => {
      window.__createNewFile = undefined;
    };
  }, [handleAddTab]);

  const handleCloseTab = useCallback((e, name) => {
    e.stopPropagation();
    if (playing || !currentWorkspace) return;
    setOpenTabs((prev) => {
      if (!prev.includes(name)) return prev;
      let next = prev.filter((tabName) => tabName !== name);

      if (name === currentActive) {
        let nextActive = next[0] || null;
        if (!nextActive) {
          const fallback = files.map((f) => f.name).find((fileName) => fileName !== name) || null;
          if (fallback) {
            next = [fallback];
            nextActive = fallback;
          }
        }
        if (nextActive) {
          recordSwitchFile(nextActive);
          setActiveFile(nextActive);
        }
      }

      return next;
    });
  }, [playing, currentWorkspace, currentActive, files, setActiveFile]);

  return (
    <div className={"file-tabs" + (visibleTabs.length === 0 ? " file-tabs-empty" : "")}>
      <div className="file-tabs-list">
        {visibleTabs.map((f) => (
          <div
            key={f.name}
            className={"file-tab" + (f.name === currentActive ? " active" : "") + (playing ? " no-interact" : "")}
            onClick={() => handleTabClick(f.name)}
            title={f.name}
          >
            <span className="file-tab-icon">{tabIcon(f.name)}</span>
            <span className="file-tab-label">
              <span className="file-tab-name">{f.name.split("/").pop()}</span>
              {f.name.includes("/") && (
                <span className="file-tab-path">{f.name.slice(0, f.name.lastIndexOf("/"))}</span>
              )}
            </span>
            {!playing && (visibleTabs.length > 1 || files.length > 1) && (
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
