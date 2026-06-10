import { useContext, useCallback, useRef, useState, memo, useEffect } from "react";
import { GlobalContext } from "../../contexts/GlobalStates";
import {
  getActiveFile, switchFile as recordSwitchFile,
  getFiles, exportRecord, importFromFile, isTypistLoaded, stopPlay,
  addFile, getFileFirstValue,
  renameFile as recordRenameFile, removeFile as recordRemoveFile,
  init as initRecord,
} from "../../functions/record";
import { FiFileText, FiCode, FiImage, FiChevronRight, FiChevronDown, FiFolder, FiDownload, FiUpload, FiEdit2, FiTrash2, FiX } from "react-icons/fi";

const TEXT_EXTS = new Set([
  "js", "jsx", "ts", "tsx", "mjs", "cjs",
  "html", "htm", "css", "scss", "less", "sass",
  "py", "rb", "go", "rs", "java", "kt", "swift", "c", "cpp", "h", "hpp",
  "json", "xml", "yaml", "yml", "toml", "ini", "cfg",
  "md", "txt", "sh", "bash", "zsh", "fish",
  "sql", "graphql", "r", "lua", "php", "pl", "pm",
  "env", "gitignore", "dockerfile", "makefile",
  "conf", "log", "lock",
]);

function isTextFile(name) {
  const ext = name.split(".").pop().toLowerCase();
  return TEXT_EXTS.has(ext);
}

function extLang(name) {
  const ext = name.split(".").pop().toLowerCase();
  const map = {
    html: "html", htm: "html",
    css: "css",
    js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
    ts: "typescript", tsx: "typescript",
    py: "python",
    json: "json",
    md: "markdown",
    xml: "xml", svg: "xml",
    sql: "sql",
    sh: "shell", bash: "shell", zsh: "shell",
  };
  return map[ext] || "plaintext";
}

function extIcon(name) {
  const ext = name.split(".").pop().toLowerCase();
  switch (ext) {
    case "js": case "jsx": case "ts": case "tsx": case "mjs": case "cjs":
    case "html": case "htm":
    case "css": case "scss": case "less":
      return <FiCode size={14} />;
    case "png": case "jpg": case "jpeg": case "gif": case "svg": case "ico":
      return <FiImage size={14} />;
    default:
      return <FiFileText size={14} />;
  }
}

function sortFsEntries(entries) {
  const dirs = entries.filter(e => e.isDirectory).sort((a, b) => a.name.localeCompare(b.name));
  const files = entries.filter(e => !e.isDirectory).sort((a, b) => a.name.localeCompare(b.name));
  return { dirs, files };
}

const FileTree = memo(() => {
  const { activeFile, setActiveFile, setFiles, playing, currentWorkspace, setToast, setRecordName, currentRecord, setCurrentRecord, setPlaying, recording } = useContext(GlobalContext);
  const importInputRef = useRef(null);
  const f = window.electronAPI?.file;
  const pathUtil = window.electronAPI?.path;
  const workspacePath = currentWorkspace?.path;

  const [expanded, setExpanded] = useState({});
  const [dirContents, setDirContents] = useState({});
  const [loading, setLoading] = useState({});
  const [ctxMenu, setCtxMenu] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [missingFiles, setMissingFiles] = useState([]);

  const expandedRef = useRef(expanded);
  const dirContentsRef = useRef(dirContents);
  const loadingRef = useRef(loading);
  useEffect(() => { expandedRef.current = expanded; }, [expanded]);
  useEffect(() => { dirContentsRef.current = dirContents; }, [dirContents]);
  useEffect(() => { loadingRef.current = loading; }, [loading]);

  const getAbsPath = useCallback((relativePath) => {
    if (!workspacePath || !pathUtil) return null;
    return pathUtil.join(workspacePath, relativePath);
  }, [workspacePath, pathUtil]);

  const loadDir = useCallback(async (absPath, loadKey) => {
    if (!f) return;
    if (dirContentsRef.current[loadKey]) return;
    if (loadingRef.current[loadKey]) return;
    setLoading(prev => ({ ...prev, [loadKey]: true }));
    try {
      const entries = await f.list(absPath);
      if (dirContentsRef.current[loadKey]) return;
      setDirContents(prev => ({ ...prev, [loadKey]: entries }));
    } catch (err) {
      console.warn("Failed to list directory:", absPath, err);
    }
    setLoading(prev => ({ ...prev, [loadKey]: false }));
  }, [f]);

  useEffect(() => {
    if (!workspacePath || !f) return;
    setExpanded({});
    setDirContents({});
    loadDir(workspacePath, workspacePath);
  }, [workspacePath, f, loadDir]);

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => { setCtxMenu(null); setConfirmDelete(null); };
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
    };
  }, [ctxMenu]);

  useEffect(() => {
    if (!isTypistLoaded() || !getFiles().length) {
      setMissingFiles([]);
      return;
    }
    const recordFiles = getFiles();
    if (!workspacePath || !f) {
      setMissingFiles(recordFiles.map(x => x.name));
      return;
    }
    const check = async () => {
      const results = [];
      for (const rf of recordFiles) {
        const absPath = pathUtil.join(workspacePath, rf.name);
        try {
          const exists = await f.exists(absPath);
          if (!exists) results.push(rf.name);
        } catch {
          results.push(rf.name);
        }
      }
      setMissingFiles(results);
    };
    check();
  }, [workspacePath, currentRecord, f, pathUtil]);

  const forceRefresh = useCallback(async () => {
    if (!workspacePath || !f) return;
    dirContentsRef.current = {};
    loadingRef.current = {};
    setDirContents({});
    setExpanded({});
    await loadDir(workspacePath, workspacePath);
  }, [workspacePath, f, loadDir]);

  const restoreMissingFile = useCallback(async (name) => {
    if (!workspacePath || !f || !pathUtil) {
      recordSwitchFile(name);
      setActiveFile(name);
      return;
    }
    const content = getFileFirstValue(name) || "";
    const absPath = pathUtil.join(workspacePath, name);
    const parentDir = name.includes('/') ? pathUtil.join(workspacePath, name.split('/').slice(0, -1).join('/')) : workspacePath;
    try {
      if (name.includes('/')) await f.mkdir(parentDir);
      await f.write(absPath, content);
      recordSwitchFile(name);
      setActiveFile(name);
      await forceRefresh();
    } catch (err) {
      setToast({ type: "ERROR", message: err.message || "Failed to restore file" });
    }
  }, [workspacePath, f, pathUtil, setToast, setActiveFile, forceRefresh]);

  const closeRecord = useCallback(() => {
    initRecord();
    setCurrentRecord(null);
    setRecordName("Untitled");
    setFiles([]);
    setActiveFile(null);
  }, [setCurrentRecord, setRecordName, setFiles, setActiveFile]);

  const handleContextMenu = useCallback((e, relPath, isDir) => {
    if (playing) return;
    e.preventDefault();
    e.stopPropagation();
    const container = e.currentTarget.closest('.file-tree-items');
    const rect = container?.getBoundingClientRect();
    const menuWidth = 220;
    let x = e.clientX - (rect?.left || 0);
    let y = e.clientY - (rect?.top || 0);
    if (rect && x + menuWidth > rect.width) {
      x = Math.max(0, rect.width - menuWidth);
    }
    const menuHeight = 100;
    if (rect && y + menuHeight > rect.height) {
      y = Math.max(0, rect.height - menuHeight);
    }
    setCtxMenu({ x, y, relPath, isDir });
    setRenaming(null);
  }, [playing]);

  const startRename = useCallback((relPath) => {
    const name = relPath.split('/').pop();
    setRenaming(relPath);
    setRenameValue(name);
    setCtxMenu(null);
    setConfirmDelete(null);
  }, []);

  const submitRename = useCallback(async (oldRelPath) => {
    const newName = renameValue.trim();
    if (!newName) {
      setRenaming(null);
      return;
    }
    const parts = oldRelPath.split('/');
    parts[parts.length - 1] = newName;
    const newRelPath = parts.join('/');
    if (newRelPath === oldRelPath) { setRenaming(null); return; }
    if (workspacePath && f && pathUtil) {
      const oldAbs = pathUtil.join(workspacePath, oldRelPath);
      const newAbs = pathUtil.join(workspacePath, newRelPath);
      try {
        const exists = await f.exists(newAbs);
        if (exists) {
          setToast({ type: "WARNING", message: `"${newName}" already exists` });
          return;
        }
        await f.rename(oldAbs, newAbs);
      } catch (err) {
        setToast({ type: "ERROR", message: err.message || "Failed to rename" });
        setRenaming(null);
        return;
      }
    }
    recordRenameFile(oldRelPath, newRelPath);
    window.__renameModel?.(oldRelPath, newRelPath);
    setFiles(getFiles());
    if (workspacePath) await forceRefresh();
    setRenaming(null);
  }, [renameValue, workspacePath, f, pathUtil, setToast, setFiles, forceRefresh]);

  const handleDelete = useCallback(async (relPath, isDir) => {
    if (confirmDelete === relPath) {
      if (workspacePath && f && pathUtil) {
        const absPath = pathUtil.join(workspacePath, relPath);
        try {
          await f.remove(absPath);
        } catch (err) {
          setToast({ type: "ERROR", message: err.message || "Failed to delete" });
          setConfirmDelete(null);
          setCtxMenu(null);
          return;
        }
      }
      recordRemoveFile(relPath);
      window.__removeModel?.(relPath);
      setFiles(getFiles());
      if (workspacePath) await forceRefresh();
      setToast({ type: "SUCCESS", message: `Deleted "${relPath}"` });
      setConfirmDelete(null);
      setCtxMenu(null);
    } else {
      setConfirmDelete(relPath);
    }
  }, [workspacePath, f, pathUtil, setToast, setFiles, forceRefresh, confirmDelete]);

  const toggleDir = useCallback((absPath, relativeKey, currentlyOpen) => {
    if (currentlyOpen) {
      setExpanded(prev => {
        const next = { ...prev };
        delete next[relativeKey];
        return next;
      });
      return;
    }
    setExpanded(prev => ({ ...prev, [relativeKey]: true }));
    if (!dirContentsRef.current[relativeKey] && !loadingRef.current[relativeKey]) {
      loadDir(absPath, relativeKey);
    }
  }, [loadDir]);

  const handleFileClick = useCallback(async (relativePath) => {
    if (playing || !f || !workspacePath) return;
    if (!isTextFile(relativePath)) {
      setToast({ type: "WARNING", message: `${relativePath} is not a text file.` });
      return;
    }
    const registeredFiles = getFiles();
    const alreadyRegistered = registeredFiles.some(x => x.name === relativePath);
    if (!alreadyRegistered) {
      const fullPath = getAbsPath(relativePath);
      if (!fullPath) return;
      try {
        const content = await f.read(fullPath);
        if (content === null || content === undefined) {
          setToast({ type: "ERROR", message: `Failed to read ${relativePath}` });
          return;
        }
        addFile(relativePath, extLang(relativePath), content);
        setFiles(getFiles());
      } catch (err) {
        setToast({ type: "ERROR", message: err.message || "Failed to read file" });
        return;
      }
    }
    recordSwitchFile(relativePath);
    setActiveFile(relativePath);
  }, [playing, f, workspacePath, getAbsPath, setActiveFile, setFiles, setToast]);

  const handleRecordFileClick = useCallback((name) => {
    if (playing) return;
    recordSwitchFile(name);
    setActiveFile(name);
  }, [playing, setActiveFile]);

  const handleImport = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const name = await importFromFile(file);
      setRecordName(name);
      setPlaying(false);
      stopPlay();
      setCurrentRecord(null);
      const syncedFiles = getFiles();
      setFiles(syncedFiles);
      setToast({ type: "SUCCESS", message: `Imported "${name}"` });
      if (syncedFiles.length > 0) {
        setActiveFile(syncedFiles[0].name);
      }
    } catch (err) {
      setToast({ type: "ERROR", message: err.message || "Failed to import" });
    }
    e.target.value = "";
  }, [setRecordName, setToast, setFiles, setActiveFile, setPlaying, setCurrentRecord]);

  const currentActive = playing ? activeFile : (getActiveFile() || activeFile);

  function renderChildren(children, parentRel, depth) {
    if (!children) return null;
    const { dirs, files } = sortFsEntries(children);
    return (
      <>
        {dirs.map(d => {
          const relPath = parentRel ? parentRel + "/" + d.name : d.name;
          return renderDir(d, relPath, depth + 1);
        })}
        {files.map(fEntry => {
          const relPath = parentRel ? parentRel + "/" + fEntry.name : fEntry.name;
          return renderFile(fEntry, relPath, depth + 1);
        })}
      </>
    );
  }

  function renderDir(entry, relPath, depth) {
    const absPath = getAbsPath(relPath);
    if (!absPath) return null;
    const isOpen = !!expanded[relPath];
    const children = dirContents[relPath];
    const isLoading = !!loading[relPath];

    return (
      <div key={relPath}>
        <div
          className="file-tree-item file-tree-folder"
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => toggleDir(absPath, relPath, isOpen)}
          onContextMenu={(e) => handleContextMenu(e, relPath, true)}
        >
          <span className="file-tree-item-icon">
            {isLoading ? <span style={{ fontSize: 10 }}>...</span>
              : isOpen ? <FiChevronDown size={12} /> : <FiChevronRight size={12} />}
          </span>
          <FiFolder size={14} className="file-tree-folder-icon" />
          <span className="file-tree-item-name">{entry.name}</span>
        </div>
        {isOpen && (
          <div>
            {!children && isLoading ? (
              <div className="file-tree-item" style={{ paddingLeft: 8 + (depth + 1) * 14, opacity: 0.5 }}>Loading...</div>
            ) : (
              renderChildren(children, relPath, depth)
            )}
          </div>
        )}
      </div>
    );
  }

  function renderFile(entry, relPath, depth) {
    const isRenaming = renaming === relPath;
    return (
      <div
        key={relPath}
        className={"file-tree-item" + (relPath === currentActive ? " active" : "") + (playing ? " no-interact" : "") + (isRenaming ? " renaming" : "")}
        style={{ paddingLeft: 8 + (depth + 1) * 14 }}
        onClick={() => { if (!isRenaming) handleFileClick(relPath); }}
        onContextMenu={(e) => handleContextMenu(e, relPath, false)}
        title={relPath}
      >
        <span className="file-tree-item-icon">{extIcon(relPath)}</span>
        {isRenaming ? (
          <input
            className="file-tree-rename-input"
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') submitRename(relPath);
              if (e.key === 'Escape') setRenaming(null);
            }}
            onBlur={() => submitRename(relPath)}
            autoFocus
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <>
            <span className="file-tree-item-name">{entry.name}</span>
            <span className="file-tree-item-lang">{extLang(relPath)}</span>
          </>
        )}
      </div>
    );
  }

  const rootContents = dirContents[workspacePath];
  const rootLoading = loading[workspacePath];

  return (
    <div className="file-tree-items">
      <div className="file-tree-meta">
        <span>{workspacePath ? currentWorkspace?.name || "Project" : "No project"}</span>
        <span className="file-tree-actions">
          {currentRecord && (
            <button
              className="file-tree-action-btn"
              onClick={closeRecord}
              title="Close record"
              aria-label="Close record"
            >
              <FiX size={12} />
            </button>
          )}
          <button
            className="file-tree-action-btn"
            onClick={() => importInputRef.current?.click()}
            title="Import .cvid recording"
            aria-label="Import recording"
            disabled={recording}
          >
            <FiUpload size={12} />
          </button>
          {isTypistLoaded() && !recording && (
            <button
              className="file-tree-action-btn"
              onClick={exportRecord}
              title="Export recording as .cvid"
              aria-label="Export recording"
            >
              <FiDownload size={12} />
            </button>
          )}
        </span>
      </div>
      <input
        ref={importInputRef}
        type="file"
        accept=".cvid"
        style={{ display: "none" }}
        onChange={handleImport}
        aria-hidden="true"
      />
      {!workspacePath ? (
        isTypistLoaded() ? (
          <div className="file-tree-record-files">
            <div className="file-tree-record-header">Record Files</div>
            {getFiles().map(f => {
              const isRenaming = renaming === f.name;
              return (
                <div
                  key={f.name}
                  className={"file-tree-item" + (f.name === currentActive ? " active" : "") + (playing ? " no-interact" : "") + (isRenaming ? " renaming" : "")}
                  style={{ paddingLeft: 24 }}
                  onClick={() => { if (!isRenaming) handleRecordFileClick(f.name); }}
                  onContextMenu={(e) => { if (!playing) handleContextMenu(e, f.name, false); }}
                  title={f.name}
                >
                  <span className="file-tree-item-icon">{extIcon(f.name)}</span>
                  {isRenaming ? (
                    <input
                      className="file-tree-rename-input"
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') submitRename(f.name);
                        if (e.key === 'Escape') setRenaming(null);
                      }}
                      onBlur={() => submitRename(f.name)}
                      autoFocus
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <>
                      <span className="file-tree-item-name">
                        {f.name.split('/').pop()}
                      </span>
                      <span className="file-tree-item-path">{f.name.split('/').slice(0, -1).join('/')}</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="file-tree-empty">No project open</div>
        )
      ) : !rootContents ? (
        <div className="file-tree-empty">{rootLoading ? "Loading..." : "Empty project"}</div>
      ) : (
        <div>
          {renderChildren(rootContents, "", -1)}
          {missingFiles.length > 0 && (
            <>
              <div className="file-tree-record-header" style={{ paddingTop: 12 }}>Missing Record Files</div>
              {missingFiles.map(name => (
                <div
                  key={name}
                  className="file-tree-item file-tree-missing"
                  style={{ paddingLeft: 24 }}
                  onClick={() => restoreMissingFile(name)}
                  title={`Click to restore "${name}"`}
                >
                  <span className="file-tree-item-icon">{extIcon(name)}</span>
                  <span className="file-tree-item-name">{name.split('/').pop()}</span>
                  <span className="file-tree-item-path">{name.split('/').slice(0, -1).join('/') || '/'}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
      {ctxMenu && (
        <div
          className="menu-dropdown"
          style={{ left: ctxMenu.x, top: ctxMenu.y, position: 'absolute' }}
          onClick={e => e.stopPropagation()}
        >
          <button className="menu-item" onClick={() => startRename(ctxMenu.relPath)}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FiEdit2 size={12} /> Rename
            </span>
          </button>
          <div className="menu-separator" />
          <button
            className={"menu-item" + (confirmDelete === ctxMenu.relPath ? " confirming" : "")}
            onClick={() => handleDelete(ctxMenu.relPath, ctxMenu.isDir)}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: confirmDelete === ctxMenu.relPath ? '#e74c3c' : undefined }}>
              <FiTrash2 size={12} /> {confirmDelete === ctxMenu.relPath ? 'Confirm Delete' : 'Delete'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
});

FileTree.displayName = "FileTree";

export default FileTree;
