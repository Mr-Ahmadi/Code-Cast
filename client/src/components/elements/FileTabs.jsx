import { useContext, useCallback, useState, useEffect, memo } from "react";
import { GlobalContext } from "../../contexts/GlobalStates";
import {
  getFiles, getActiveFile, addFile as recordAddFile,
  switchFile as recordSwitchFile,
} from "../../functions/record";
import { getIconType } from "../../functions/fileTypes";
import { FiPlus, FiX, FiFileText, FiCode, FiImage } from "react-icons/fi";

const tabIcon = (name) => {
  const type = getIconType(name);
  switch (type) {
    case "code": return <FiCode size={12} />;
    case "image": return <FiImage size={12} />;
    default: return <FiFileText size={12} />;
  }
};

const sameArray = (a = [], b = []) => (
  a.length === b.length && a.every((item, index) => item === b[index])
);

const FileTabs = memo(() => {
  const { recording, playing, paused, activeFile, previewFile, setPreviewFile, files, setFiles, setActiveFile, currentWorkspace } = useContext(GlobalContext);
  const [showNewFile, setShowNewFile] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [openTabs, setOpenTabs] = useState(() => files.map((f) => f.name));

  const currentActive = (playing || recording) ? activeFile : (getActiveFile() || activeFile);
  const visibleTabs = openTabs
    .map((name) => {
      const f = files.find((f) => f.name === name);
      if (f) return { ...f, isPreview: false };
      return null;
    })
    .filter(Boolean);

  if (previewFile && !visibleTabs.some(t => t.name === previewFile)) {
    visibleTabs.push({ name: previewFile, isPreview: true });
  }

  useEffect(() => {
    const existingNames = new Set(files.map((f) => f.name));
    setOpenTabs((prev) => {
      let next = prev.filter((name) => existingNames.has(name));
      if (activeFile && currentActive && existingNames.has(currentActive) && !next.includes(currentActive)) {
        next = [...next, currentActive];
      }
      return sameArray(prev, next) ? prev : next;
    });
  }, [files, currentActive, activeFile]);

  useEffect(() => {
    if (activeFile && currentActive && !previewFile) {
      setOpenTabs((prev) => (prev.includes(currentActive) ? prev : [...prev, currentActive]));
    }
  }, [currentActive, previewFile, activeFile]);

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

  const promotePreview = useCallback(async (name) => {
    if (name !== previewFile) return;
    const f = window.electronAPI?.file;
    if (!f || !currentWorkspace?.path) return;
    
    try {
      const fullPath = window.electronAPI.path.join(currentWorkspace.path, name);
      const content = await f.read(fullPath);
      recordAddFile(name, extLang(name), content);
      setFiles(getFiles());
      setPreviewFile(null);
      setOpenTabs(prev => prev.includes(name) ? prev : [...prev, name]);
    } catch (err) {
      console.error("Failed to promote preview", err);
    }
  }, [previewFile, currentWorkspace, setFiles, setPreviewFile]);

  const handleTabClick = useCallback((name) => {
    if (playing && !paused) return;
    
    if (name === previewFile && name === currentActive) {
      promotePreview(name);
      return;
    }

    setOpenTabs((prev) => (prev.includes(name) ? prev : [...prev, name]));
    recordSwitchFile(name);
    setActiveFile(name);
  }, [playing, paused, setActiveFile, previewFile, currentActive, promotePreview]);

  const handleAddTab = useCallback(async () => {
    if ((playing && !paused) || (!currentWorkspace && !recording)) return;
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
  }, [recording, playing, paused, currentWorkspace, setActiveFile, createWorkspaceFile]);

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
    if (playing && !paused) return;
    
    if (name === previewFile) {
      setPreviewFile(null);
      if (name === currentActive) {
        const nextActive = openTabs[0] || null;
        recordSwitchFile(nextActive);
        setActiveFile(nextActive);
      }
      return;
    }

    if (!openTabs.includes(name)) return;
    const next = openTabs.filter((tabName) => tabName !== name);

    if (name === currentActive) {
      const nextActive = next[0] || null;
      recordSwitchFile(nextActive);
      setActiveFile(nextActive);
    }

    setOpenTabs(next);
  }, [playing, paused, currentActive, setActiveFile, previewFile, setPreviewFile, openTabs]);

  return (
    <div className={"file-tabs" + (visibleTabs.length === 0 ? " file-tabs-empty" : "")}>
      <div className="file-tabs-list">
        {visibleTabs.map((f) => (
          <div
            key={f.name}
            className={"file-tab" + (f.name === currentActive ? " active" : "") + (f.isPreview ? " preview" : "") + (playing && !paused ? " no-interact" : "")}
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
            {(!playing || paused) && (
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
        {(!playing || paused) && (currentWorkspace || recording) && (
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
