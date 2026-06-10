import { useContext, useCallback, useRef, useState, memo, useEffect } from "react";
import { GlobalContext } from "../../contexts/GlobalStates";
import {
  getActiveFile, switchFile as recordSwitchFile,
  getFiles, exportRecord, importFromFile, isTypistLoaded, stopPlay,
  addFile, getFileFirstValue,
} from "../../functions/record";
import { FiFileText, FiCode, FiImage, FiChevronRight, FiChevronDown, FiFolder, FiDownload, FiUpload } from "react-icons/fi";

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
  const { activeFile, setActiveFile, setFiles, playing, currentWorkspace, setToast, setRecordName, setCurrentRecord, setPlaying, recording } = useContext(GlobalContext);
  const importInputRef = useRef(null);
  const f = window.electronAPI?.file;
  const pathUtil = window.electronAPI?.path;
  const workspacePath = currentWorkspace?.path;

  const [expanded, setExpanded] = useState({});
  const [dirContents, setDirContents] = useState({});
  const [loading, setLoading] = useState({});

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
    return (
      <div
        key={relPath}
        className={"file-tree-item" + (relPath === currentActive ? " active" : "") + (playing ? " no-interact" : "")}
        style={{ paddingLeft: 8 + (depth + 1) * 14 }}
        onClick={() => handleFileClick(relPath)}
        title={relPath}
      >
        <span className="file-tree-item-icon">{extIcon(relPath)}</span>
        <span className="file-tree-item-name">{entry.name}</span>
        <span className="file-tree-item-lang">{extLang(relPath)}</span>
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
            {getFiles().map(f => (
              <div
                key={f.name}
                className={"file-tree-item" + (f.name === currentActive ? " active" : "") + (playing ? " no-interact" : "")}
                style={{ paddingLeft: 24 }}
                onClick={() => handleRecordFileClick(f.name)}
                title={f.name}
              >
                <span className="file-tree-item-icon">{extIcon(f.name)}</span>
                <span className="file-tree-item-name">
                  {f.name.split('/').pop()}
                </span>
                <span className="file-tree-item-path">{f.name.split('/').slice(0, -1).join('/')}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="file-tree-empty">No project open</div>
        )
      ) : !rootContents ? (
        <div className="file-tree-empty">{rootLoading ? "Loading..." : "Empty project"}</div>
      ) : (
        <div>
          {renderChildren(rootContents, "", -1)}
        </div>
      )}
    </div>
  );
});

FileTree.displayName = "FileTree";

export default FileTree;
