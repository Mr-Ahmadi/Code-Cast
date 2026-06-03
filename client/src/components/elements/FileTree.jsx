import { useContext, useCallback, useState, memo } from "react";
import { GlobalContext } from "../../contexts/GlobalStates";
import {
  getFiles, getActiveFile, switchFile as recordSwitchFile,
  getFileLanguage,
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

function FileTreeNode({ node, depth, currentActive, onFileClick, playing }) {
  FileTreeNode.propTypes = {
    node: PropTypes.object.isRequired,
    depth: PropTypes.number.isRequired,
    currentActive: PropTypes.string,
    onFileClick: PropTypes.func.isRequired,
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
              <FileTreeNode key={d.name} node={d} depth={depth + 1} currentActive={currentActive} onFileClick={onFileClick} playing={playing} />
            ))}
            {files.map((f) => (
              <div
                key={f.name}
                className={"file-tree-item" + (f.name === currentActive ? " active" : "") + (playing ? " no-interact" : "")}
                style={{ paddingLeft: 8 + (depth + 1) * 14 }}
                onClick={() => onFileClick(f.name)}
                title={f.name}
              >
                <span className="file-tree-item-icon">{extIcon(f.name)}</span>
                <span className="file-tree-item-name">{f.name.split("/").pop()}</span>
                <span className="file-tree-item-lang">{getFileLanguage(f.name)}</span>
              </div>
            ))}
          </>
        )}
      </>
    );
  }

  return (
    <>
      {dirs.map(([, d]) => (
        <FileTreeNode key={d.name} node={d} depth={1} currentActive={currentActive} onFileClick={onFileClick} playing={playing} />
      ))}
      {files.map((f) => (
        <div
          key={f.name}
          className={"file-tree-item" + (f.name === currentActive ? " active" : "") + (playing ? " no-interact" : "")}
          onClick={() => onFileClick(f.name)}
          title={f.name}
        >
          <span className="file-tree-item-icon">{extIcon(f.name)}</span>
          <span className="file-tree-item-name">{f.name.split("/").pop()}</span>
          <span className="file-tree-item-lang">{getFileLanguage(f.name)}</span>
        </div>
      ))}
    </>
  );
}

const FileTree = memo(() => {
  const { activeFile, setActiveFile, playing } = useContext(GlobalContext);

  const files = getFiles();
  const tree = buildTree(files);

  const handleFileClick = useCallback((name) => {
    if (playing) return;
    recordSwitchFile(name);
    setActiveFile(name);
  }, [playing, setActiveFile]);

  const currentActive = playing ? activeFile : (getActiveFile() || activeFile);

  return (
    <div className="file-tree-items">
      {files.length === 0 && (
        <div className="file-tree-empty">No files</div>
      )}
      <FileTreeNode
        node={tree}
        depth={0}
        currentActive={currentActive}
        onFileClick={handleFileClick}
        playing={playing}
      />
    </div>
  );
});

FileTree.displayName = "FileTree";

export default FileTree;
