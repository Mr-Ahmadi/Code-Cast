import { useContext, useCallback, useMemo, useState, memo } from "react";
import { GlobalContext } from "../../contexts/GlobalStates";
import {
  getActiveFile, switchFile as recordSwitchFile,
  getFileLanguage, renameFile as recordRenameFile,
  getFiles as recordGetFiles,
} from "../../functions/record";
import { FiFileText, FiCode, FiImage, FiChevronRight, FiChevronDown, FiFolder } from "react-icons/fi";
import PropTypes from "prop-types";

const extIcon = (name) => {
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
};

function buildTree(files) {
  const root = { name: "", children: {}, files: [] };
  for (const f of files) {
    const parts = f.name.split("/");
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!node.children[parts[i]]) {
        node.children[parts[i]] = { name: parts[i], children: {}, files: [] };
      }
      node = node.children[parts[i]];
    }
    node.files.push(f);
  }
  return root;
}

function sortEntries(node) {
  const dirs = Object.entries(node.children).sort((a, b) => a[0].localeCompare(b[0]));
  const files = [...node.files].sort((a, b) => a.name.localeCompare(b.name));
  return { dirs, files };
}

function FileTreeItem({ f, currentActive, depth, onFileClick, onRename, playing }) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(f.name.split("/").pop());

  const handleRenameSubmit = () => {
    const trimmed = newName.trim();
    if (trimmed && trimmed !== f.name.split("/").pop()) {
      onRename(f.name, trimmed);
    }
    setIsRenaming(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleRenameSubmit();
    if (e.key === "Escape") {
      setIsRenaming(false);
      setNewName(f.name.split("/").pop());
    }
  };

  if (isRenaming) {
    return (
      <div className="file-tree-item renaming" style={{ paddingLeft: 8 + (depth + 1) * 14 }}>
        <span className="file-tree-item-icon">{extIcon(f.name)}</span>
        <input
          autoFocus
          className="file-tree-rename-input"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onBlur={handleRenameSubmit}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    );
  }

  return (
    <div
      className={"file-tree-item" + (f.name === currentActive ? " active" : "") + (playing ? " no-interact" : "")}
      style={{ paddingLeft: 8 + (depth + 1) * 14 }}
      onClick={() => onFileClick(f.name)}
      onContextMenu={(e) => {
        if (playing) return;
        e.preventDefault();
        setIsRenaming(true);
      }}
      title={f.name}
    >
      <span className="file-tree-item-icon">{extIcon(f.name)}</span>
      <span className="file-tree-item-name">{f.name.split("/").pop()}</span>
      <span className="file-tree-item-lang">{getFileLanguage(f.name)}</span>
    </div>
  );
}

FileTreeItem.propTypes = {
  f: PropTypes.object.isRequired,
  currentActive: PropTypes.string,
  depth: PropTypes.number.isRequired,
  onFileClick: PropTypes.func.isRequired,
  onRename: PropTypes.func.isRequired,
  playing: PropTypes.bool,
};

function FileTreeNode({ node, depth, currentActive, onFileClick, onRename, playing }) {
  FileTreeNode.propTypes = {
    node: PropTypes.object.isRequired,
    depth: PropTypes.number.isRequired,
    currentActive: PropTypes.string,
    onFileClick: PropTypes.func.isRequired,
    onRename: PropTypes.func.isRequired,
    playing: PropTypes.bool,
  };
  const [expanded, setExpanded] = useState(true);
  const { dirs, files } = sortEntries(node);

  if (depth > 0) {
    return (
      <>
        <div
          className="file-tree-item file-tree-folder"
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => setExpanded(!expanded)}
        >
          <span className="file-tree-item-icon">
            {expanded ? <FiChevronDown size={12} /> : <FiChevronRight size={12} />}
          </span>
          <FiFolder size={14} className="file-tree-folder-icon" />
          <span className="file-tree-item-name">{node.name}</span>
        </div>
        {expanded && (
          <>
            {dirs.map(([, d]) => (
              <FileTreeNode key={d.name} node={d} depth={depth + 1} currentActive={currentActive} onFileClick={onFileClick} onRename={onRename} playing={playing} />
            ))}
            {files.map((f) => (
              <FileTreeItem
                key={f.name}
                f={f}
                currentActive={currentActive}
                depth={depth}
                onFileClick={onFileClick}
                onRename={onRename}
                playing={playing}
              />
            ))}
          </>
        )}
      </>
    );
  }

  return (
    <>
      {dirs.map(([, d]) => (
        <FileTreeNode key={d.name} node={d} depth={1} currentActive={currentActive} onFileClick={onFileClick} onRename={onRename} playing={playing} />
      ))}
      {files.map((f) => (
        <FileTreeItem
          key={f.name}
          f={f}
          currentActive={currentActive}
          depth={0}
          onFileClick={onFileClick}
          onRename={onRename}
          playing={playing}
        />
      ))}
    </>
  );
}

const FileTree = memo(() => {
  const { activeFile, files, setActiveFile, setFiles, playing, currentWorkspace } = useContext(GlobalContext);

  const tree = useMemo(() => buildTree(files), [files]);

  const handleFileClick = useCallback((name) => {
    if (playing) return;
    recordSwitchFile(name);
    setActiveFile(name);
  }, [playing, setActiveFile]);

  const handleRename = useCallback(async (oldName, newBaseName) => {
    if (playing) return;
    const parts = oldName.split("/");
    parts[parts.length - 1] = newBaseName;
    const newName = parts.join("/");

    if (files.some(f => f.name === newName)) {
      alert("A file with this name already exists.");
      return;
    }

    // Update internal Typist state
    const success = recordRenameFile(oldName, newName);
    if (!success) return;

    // If in local mode, rename on disk
    if (currentWorkspace?.path && window.electronAPI?.file?.rename) {
      const path = window.electronAPI.path;
      const oldAbsPath = path.join(currentWorkspace.path, oldName);
      const newAbsPath = path.join(currentWorkspace.path, newName);
      await window.electronAPI.file.rename(oldAbsPath, newAbsPath);
    }

    // Update global state
    const nextFiles = recordGetFiles();
    setFiles(nextFiles);
    if (activeFile === oldName) {
      setActiveFile(newName);
    }
  }, [playing, files, activeFile, setActiveFile, setFiles, currentWorkspace]);

  const currentActive = playing ? activeFile : (getActiveFile() || activeFile);

  return (
    <div className="file-tree-items">
      <div className="file-tree-meta">
        {files.length} file{files.length === 1 ? "" : "s"}
      </div>
      {files.length === 0 && (
        <div className="file-tree-empty">No files</div>
      )}
      <FileTreeNode
        node={tree}
        depth={0}
        currentActive={currentActive}
        onFileClick={handleFileClick}
        onRename={handleRename}
        playing={playing}
      />
    </div>
  );
});

FileTree.displayName = "FileTree";

export default FileTree;
