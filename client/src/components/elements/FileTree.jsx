import { useContext, useCallback, memo } from "react";
import { GlobalContext } from "../../contexts/GlobalStates";
import {
  getFiles, getActiveFile, switchFile as recordSwitchFile,
  getFileLanguage,
} from "../../functions/record";
import { FiFileText, FiCode, FiImage } from "react-icons/fi";

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

const FileTree = memo(() => {
  const { activeFile, setActiveFile, playing } = useContext(GlobalContext);

  const files = getFiles();

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
      {files.map((f) => (
        <div
          key={f.name}
          className={"file-tree-item" + (f.name === currentActive ? " active" : "") + (playing ? " no-interact" : "")}
          onClick={() => handleFileClick(f.name)}
          title={f.name}
        >
          <span className="file-tree-item-icon">{extIcon(f.name)}</span>
          <span className="file-tree-item-name">{f.name}</span>
          <span className="file-tree-item-lang">{getFileLanguage(f.name)}</span>
        </div>
      ))}
    </div>
  );
});

FileTree.displayName = "FileTree";

export default FileTree;
