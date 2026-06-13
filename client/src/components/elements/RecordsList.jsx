import { useContext, useState, useEffect, useRef, useCallback, useMemo, memo } from 'react'
import { GlobalContext } from '../../contexts/GlobalStates';
import { useMode, MODES } from '../../contexts/ModeContext';
import PropTypes from 'prop-types';
import { init as initRecord, load as loadRecord, addFile as recordAddFile, stopPlay } from "../../functions/record";
import * as localStore from "../../stores/localStore";
import axios from "axios";
import { FiFileText, FiPlus, FiX, FiTrash2, FiSearch, FiChevronRight, FiChevronDown, FiFolder, FiFolderPlus } from "react-icons/fi";

const PROJECT_TEMPLATES = {
  'html-css-js': {
    name: 'HTML/CSS/JS',
    files: {
      'index.html': '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>My Project</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <h1>Hello World</h1>\n  <script src="script.js"></script>\n</body>\n</html>',
      'style.css': 'body {\n  font-family: system-ui, sans-serif;\n  margin: 0;\n  padding: 2rem;\n  background: #1a1a2e;\n  color: #e8e8e8;\n}',
      'script.js': '// Your code here\nconsole.log("Hello World");',
    },
  },
  'react': {
    name: 'React',
    files: {
      'src/App.jsx': 'import React from "react";\n\nfunction App() {\n  return (\n    <div>\n      <h1>Hello React</h1>\n    </div>\n  );\n}\n\nexport default App;',
      'src/index.js': 'import React from "react";\nimport ReactDOM from "react-dom/client";\nimport App from "./App";\n\nReactDOM.createRoot(document.getElementById("root")).render(<App />);',
      'public/index.html': '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>React App</title>\n</head>\n<body>\n  <div id="root"></div>\n</body>\n</html>',
      'package.json': '{\n  "name": "my-react-app",\n  "version": "1.0.0",\n  "private": true,\n  "dependencies": {\n    "react": "^18.2.0",\n    "react-dom": "^18.2.0"\n  }\n}',
    },
  },
  'python': {
    name: 'Python',
    files: {
      'main.py': '#!/usr/bin/env python3\n\ndef main():\n    print("Hello World")\n\n\nif __name__ == "__main__":\n    main()',
      'requirements.txt': '# Add your dependencies here\n',
    },
  },
  'node': {
    name: 'Node.js',
    files: {
      'index.js': '// Node.js app\nconsole.log("Hello World");',
      'package.json': '{\n  "name": "my-node-app",\n  "version": "1.0.0",\n  "private": true,\n  "main": "index.js",\n  "scripts": {\n    "start": "node index.js"\n  }\n}',
    },
  },
};

function extLang(name) {
  const ext = name.split('.').pop().toLowerCase();
  const map = {
    html:'html', htm:'html',
    css:'css',
    js:'javascript', jsx:'javascript', mjs:'javascript', cjs:'javascript',
    ts:'typescript', tsx:'typescript',
    py:'python',
    json:'json',
    md:'markdown',
    xml:'xml', svg:'xml',
    sql:'sql',
    sh:'shell', bash:'shell', zsh:'shell',
  };
  return map[ext] || 'plaintext';
}

const OPENED_FOLDERS_KEY = 'codecast_opened_folders';

const RecordsList = memo(({ display, setDisplay }) => {
  const { user, setRecordName, setToast, refreshUser, setCurrentWorkspace, setCurrentRecord, setPlaying } = useContext(GlobalContext);
  const { mode } = useMode();
  const isLocal = mode === MODES.LOCAL;
  const [selected, setSelected] = useState(null)
  const [selectedWs, setSelectedWs] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [loading, setLoading] = useState(null)
  const [search, setSearch] = useState("")
  const [expanded, setExpanded] = useState({})
  const [creatingWs, setCreatingWs] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newProjectName, setNewProjectName] = useState("My Project")
  const [newProjectTemplate, setNewProjectTemplate] = useState("html-css-js")
  const [localProjects, setLocalProjects] = useState([])
  const [openedFolders, setOpenedFolders] = useState(() => {
    try { return JSON.parse(localStorage.getItem(OPENED_FOLDERS_KEY) || '[]'); }
    catch { return []; }
  })
  const modalRef = useRef(null);
  const listRef = useRef(null);

  const projects = useMemo(() => isLocal ? localProjects : (user?.workspaces || []), [isLocal, localProjects, user]);

  function saveOpenedFolders(list) {
    localStorage.setItem(OPENED_FOLDERS_KEY, JSON.stringify(list));
    setOpenedFolders(list);
  }

  const refreshLocal = useCallback(async () => {
    if (!isLocal) return;
    const indexed = await localStore.getLocalProjects();
    const result = [];
    for (const p of indexed) {
      const records = await localStore.getLocalRecordings(p.id);
      result.push({ id: p.id, name: p.name, files: p.files, records, path: p.path });
    }
    for (const folder of openedFolders) {
      const records = await localStore.getLocalRecordings(null, folder.path);
      result.push({
        id: folder.path,
        name: folder.name,
        path: folder.path,
        files: {},
        records,
        isFolder: true,
      });
    }
    setLocalProjects(result);
  }, [isLocal, openedFolders]);

  useEffect(() => {
    if (display && isLocal) {
      refreshLocal();
    }
  }, [display, isLocal, refreshLocal]);

  useEffect(() => {
    document.body.classList.toggle('dialog-open', display);
    if (window.electronAPI?.window?.setResizable) {
      window.electronAPI.window.setResizable(!display);
    }
  }, [display]);

  const filtered = search
    ? projects.map(ws => ({
        ...ws,
        records: ws.records.filter(([name]) => name.toLowerCase().includes(search.toLowerCase())),
      })).filter(ws => ws.records.length > 0 || ws.name.toLowerCase().includes(search.toLowerCase()))
    : projects;

  const closeModal = useCallback(() => {
    setDisplay(false);
    setSelected(null);
    setSelectedWs(null);
    setConfirmDelete(null);
    setSearch("");
    setCreatingWs(false);
    setShowCreateForm(false);
  }, [setDisplay]);

  const handleOpenProject = useCallback(async (ws) => {
    stopPlay();
    setPlaying(false);
    setLoading(ws.id);
    try {
      if (ws.path) {
        initRecord();
      } else {
        initRecord();
        for (const [name, fd] of Object.entries(ws.files || {})) {
          recordAddFile(name, fd.language, fd.firstValue || "");
        }
      }
      setCurrentWorkspace({ id: ws.id, name: ws.name, files: ws.files, path: ws.path || null });
      setCurrentRecord(null);
      setRecordName("Untitled");
      setToast({ type: "SUCCESS", message: `Opened "${ws.name}"` });
      closeModal();
    } catch {
      setToast({ type: "ERROR", message: "Failed to open project" });
    } finally {
      setLoading(null);
    }
  }, [closeModal, setToast, setCurrentWorkspace, setCurrentRecord, setRecordName]);

  const handleOpenRecord = useCallback(async (recordId, name, ws) => {
    stopPlay();
    setPlaying(false);
    setLoading(recordId);
    try {
      if (isLocal) {
        await loadRecord(recordId, ws?.path);
        setRecordName(name);
        setCurrentWorkspace(ws ? { id: ws.id, name: ws.name, files: ws.files, path: ws.path || null } : null);
        setCurrentRecord(recordId);
      } else {
        await loadRecord(recordId);
        setRecordName(name);
        setCurrentWorkspace(ws ? { id: ws.id, name: ws.name, files: ws.files, path: ws.path || null } : null);
        setCurrentRecord(recordId);
      }
      setToast({ type: "SUCCESS", message: `Opened "${name}"` });
      closeModal();
    } catch {
      setToast({ type: "ERROR", message: "Failed to open record" });
    } finally {
      setLoading(null);
    }
  }, [closeModal, setToast, setRecordName, setCurrentWorkspace, setCurrentRecord, isLocal]);

  const handleOpenFolder = useCallback(async () => {
    stopPlay();
    setPlaying(false);
    const f = window.electronAPI?.file;
    if (!f) {
      setToast({ type: "ERROR", message: "File system not available. Use the desktop app." });
      return;
    }
    const dir = await f.selectDirectory();
    if (!dir) return;

    setLoading(dir);
    try {
      const folderName = dir.split('/').pop() || dir.split('\\').pop() || 'Folder';

      initRecord();
      setCurrentWorkspace({ id: dir, name: folderName, files: {}, path: dir });
      setCurrentRecord(null);
      setRecordName("Untitled");
      setToast({ type: "SUCCESS", message: `Opened "${folderName}"` });

      const existing = openedFolders.find(o => o.path === dir);
      if (!existing) {
        saveOpenedFolders([...openedFolders, { path: dir, name: folderName }]);
      }

      closeModal();
    } catch (err) {
      setToast({ type: "ERROR", message: err.message || "Failed to open folder" });
    } finally {
      setLoading(null);
    }
  }, [setToast, setCurrentWorkspace, setCurrentRecord, setRecordName, closeModal, openedFolders]);

  const handleCreateWorkspace = useCallback(async () => {
    stopPlay();
    setPlaying(false);
    if (isLocal) {
      setShowCreateForm(true);
      return;
    }
    setCreatingWs(true);
    try {
      const { data } = await axios.request({
        method: "post",
        url: "index/workspace/create",
        data: { name: "New Project" },
        headers: { "Content-Type": "application/json" },
        withCredentials: true,
      });
      initRecord();
      for (const [name, fd] of Object.entries(data.files || {})) {
        recordAddFile(name, fd.language, fd.firstValue || "");
      }
      setCurrentWorkspace({ id: data.id, name: data.name, files: data.files });
      setCurrentRecord(null);
      setRecordName("Untitled");
      setToast({ type: "SUCCESS", message: `Project "${data.name}" created` });
      refreshUser();
      setExpanded(prev => ({ ...prev, [data.id]: true }));
      closeModal();
    } catch (err) {
      setToast({ type: "ERROR", message: err?.response?.data?.message || err.message || "Failed to create project" });
    } finally {
      setCreatingWs(false);
    }
  }, [isLocal, setToast, refreshUser, setCurrentWorkspace, setCurrentRecord, setRecordName, closeModal]);

  const doCreateProject = useCallback(async () => {
    stopPlay();
    setPlaying(false);
    const name = newProjectName.trim() || "My Project";
    const templateKey = newProjectTemplate;
    const template = PROJECT_TEMPLATES[templateKey];
    if (!template) return;

    const f = window.electronAPI?.file;
    if (!f) {
      setToast({ type: "ERROR", message: "File system not available" });
      return;
    }

    const dir = await f.selectProjectDirectory(name);
    if (!dir) return;

    setCreatingWs(true);
    try {
      const projectDir = `${dir}/${name.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      await f.mkdir(projectDir);

      initRecord();
      for (const [filePath, content] of Object.entries(template.files)) {
        const fullPath = `${projectDir}/${filePath}`;
        const parentDir = fullPath.split('/').slice(0, -1).join('/');
        await f.mkdir(parentDir);
        await f.write(fullPath, content);
        recordAddFile(filePath, extLang(filePath), content);
      }

      setCurrentWorkspace({ id: projectDir, name, files: {}, path: projectDir });
      setCurrentRecord(null);
      setRecordName("Untitled");
      setToast({ type: "SUCCESS", message: `Project "${name}" created` });

      const existing = openedFolders.find(o => o.path === projectDir);
      if (!existing) {
        saveOpenedFolders([...openedFolders, { path: projectDir, name }]);
      }

      setShowCreateForm(false);
      closeModal();
    } catch (err) {
      setToast({ type: "ERROR", message: err.message || "Failed to create project" });
    } finally {
      setCreatingWs(false);
    }
  }, [newProjectName, newProjectTemplate, setToast, setCurrentWorkspace, setCurrentRecord, setRecordName, closeModal, openedFolders]);

  const handleDeleteRecord = useCallback(async (id, name, projectPath) => {
    if (confirmDelete === id) {
      try {
        if (isLocal) {
          await localStore.deleteLocalRecording(id, projectPath);
          await refreshLocal();
        } else {
          await axios.request({
            method: "delete",
            url: `index/delete/${id}`,
            withCredentials: true,
          });
          refreshUser();
        }
        setToast({ type: "SUCCESS", message: `"${name}" deleted` });
      } catch {
        setToast({ type: "ERROR", message: "Failed to delete record" });
      }
      setConfirmDelete(null);
    } else {
      setConfirmDelete(id);
    }
  }, [confirmDelete, setToast, refreshUser, isLocal, refreshLocal]);

  const handleDeleteWorkspace = useCallback(async (id, name, isFolder) => {
    if (confirmDelete === `ws-${id}`) {
      try {
        if (isFolder) {
          const updated = openedFolders.filter(o => o.path !== id);
          saveOpenedFolders(updated);
        } else if (isLocal) {
          await localStore.deleteLocalProject(id);
          await refreshLocal();
        } else {
          await axios.request({
            method: "delete",
            url: `index/workspace/${id}`,
            withCredentials: true,
          });
          refreshUser();
        }
        setToast({ type: "SUCCESS", message: `"${name}" removed` });
      } catch {
        setToast({ type: "ERROR", message: "Failed to delete project" });
      }
      setConfirmDelete(null);
    } else {
      setConfirmDelete(`ws-${id}`);
    }
  }, [confirmDelete, setToast, refreshUser, isLocal, refreshLocal, openedFolders]);

  const handleSelect = useCallback((id, wsId) => {
    setSelected(id);
    setSelectedWs(wsId || null);
    setConfirmDelete(null);
  }, []);

  const handleSelectWs = useCallback((id) => {
    setSelected(null);
    setSelectedWs(id);
    setConfirmDelete(null);
  }, []);

  const toggleExpand = useCallback((id) => {
    setExpanded(prev => ({ [id]: !prev[id] }));
  }, []);

  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const handleSelectWsRef = useRef(handleSelectWs);
  handleSelectWsRef.current = handleSelectWs;
  const toggleExpandRef = useRef(toggleExpand);
  toggleExpandRef.current = toggleExpand;

  useEffect(() => {
    if (!display) return;
    const prev = document.activeElement;
    const firstFocusable = modalRef.current?.querySelector('button, [tabindex]:not([tabindex="-1"])');
    firstFocusable?.focus();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeModal();
      }
      if (e.key === 'Enter' && selectedRef.current) {
        const ws = projects.find(w => w.id === selectedRef.current);
        if (ws) {
          handleOpenProject(ws);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      prev?.focus();
    };
  }, [display, closeModal, projects, handleOpenProject]);

  if (!display) return null;

  return (
    <div
      className="modal-container"
      onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Projects"
      ref={modalRef}
    >
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Projects</h2>
          <button className="modal-close" onClick={closeModal} aria-label="Close dialog">
            <FiX size={18} />
          </button>
        </div>
        {showCreateForm && isLocal ? (
          <div className="create-project-form">
            <h3 style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--text)' }}>Create Project</h3>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 12, color: 'var(--text-muted)' }}>Project Name</label>
            <input
              type="text"
              className="search-input"
              style={{ width: '100%', marginBottom: 12 }}
              value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
              placeholder="My Project"
              aria-label="Project name"
            />
            <label style={{ display: 'block', marginBottom: 8, fontSize: 12, color: 'var(--text-muted)' }}>Template</label>
            <select
              className="search-input"
              style={{ width: '100%', marginBottom: 16 }}
              value={newProjectTemplate}
              onChange={e => setNewProjectTemplate(e.target.value)}
              aria-label="Project template"
            >
              {Object.entries(PROJECT_TEMPLATES).map(([key, t]) => (
                <option key={key} value={key}>{t.name}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowCreateForm(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={doCreateProject} disabled={creatingWs}>
                {creatingWs ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        ) : (<>
          {projects.length > 0 && (
            <div className="search-bar">
              <FiSearch size={14} className="search-icon" aria-hidden="true" />
              <input
                type="text"
                className="search-input"
                placeholder="Filter..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                aria-label="Filter"
              />
            </div>
          )}
          <div className='list-container' ref={listRef}>
            {filtered.length ? filtered.map((ws) => (
              <div key={ws.id || "unorg"} className="ws-group">
                <div
                  className={"ws-header" + (confirmDelete === `ws-${ws.id}` ? " confirming" : "") + (selectedWs === ws.id && !selected ? " selected" : "")}
                  onClick={() => {
                    if (ws.id) {
                      handleSelectWs(ws.id);
                      toggleExpand(ws.id);
                    }
                  }}
                  onDoubleClick={() => ws.id && handleOpenProject(ws)}
                  title="Double-click to open project"
                >
                  <span className="ws-chevron">
                    {expanded[ws.id] ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                  </span>
                  <FiFolder size={14} className="ws-icon" />
                  <span className="ws-name">{ws.name}</span>
                  <span className="ws-count">{ws.records.length}</span>
                  <button
                    className="btn-delete ws-delete"
                    onClick={(e) => { e.stopPropagation(); handleDeleteWorkspace(ws.id, ws.name, ws.isFolder); }}
                    title={confirmDelete === `ws-${ws.id}` ? "Click again to confirm" : "Delete project"}
                    aria-label={`Delete project ${ws.name}`}
                  >
                    <FiTrash2 size={12} />
                  </button>
                </div>
                {expanded[ws.id] && (
                  <div className="ws-records">
                    {ws.records.length === 0 && (
                      <div className="ws-empty">No recordings in this project</div>
                    )}
                    {ws.records.map((record) => (
                      <div
                        key={record[1]}
                        className={"file-row" + (selected === record[1] ? " selected" : "")}
                      >
                        <span
                          className="file-label"
                          onClick={() => handleSelect(record[1], ws.id)}
                          onDoubleClick={() => handleOpenRecord(record[1], record[0], ws)}
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSelect(record[1], ws.id); }}
                          title="Double-click to open"
                        >
                          <FiFileText size={14} aria-hidden="true" />
                          {record[0]}
                        </span>
                        <button
                          className={"btn-delete" + (confirmDelete === record[1] ? " confirming" : "")}
                          onClick={(e) => { e.stopPropagation(); handleDeleteRecord(record[1], record[0], ws.path); }}
                          title={confirmDelete === record[1] ? "Click again to confirm" : "Delete"}
                          aria-label={`Delete ${record[0]}`}
                        >
                          <FiTrash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )) : projects.length ? (
              <div className="modal-empty" role="status">No matches for &quot;{search}&quot;</div>
            ) : (
              <div className="modal-empty" role="status">
                <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.4 }}><FiFolder size={32} /></div>
                No projects yet<br />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Create a project to get started</span>
              </div>
            )}
          </div>
        </>
        )}
        <div className="modal-footer">
          <div className="modal-footer-left">
            {isLocal && window.electronAPI?.isElectron && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleOpenFolder}
                disabled={!!loading}
              >
                <FiFolderPlus size={12} /> Open Folder
              </button>
            )}
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleCreateWorkspace}
              disabled={creatingWs}
            >
              <FiPlus size={12} /> New Project
            </button>
          </div>
          <div className="modal-footer-right">
            <button className="btn btn-secondary btn-sm" onClick={closeModal}>Cancel</button>
            {selectedWs && !selected && (
              <button
                className={"btn btn-primary btn-sm" + (loading === selectedWs ? " btn-loading" : "")}
                disabled={!!loading}
                onClick={() => {
                  const ws = projects.find(w => w.id === selectedWs);
                  if (ws) handleOpenProject(ws);
                }}
              >
                Open Project
              </button>
            )}
            {selected && (
              <button
                className={"btn btn-primary btn-sm" + (loading === selected ? " btn-loading" : "")}
                disabled={!!loading}
                onClick={() => {
                  const ws = projects.find(w => w.id === selectedWs);
                  const rec = ws?.records?.find(r => r[1] === selected);
                  if (rec) handleOpenRecord(rec[1], rec[0], ws);
                }}
              >
                Open Record
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
});

RecordsList.displayName = 'RecordsList';

RecordsList.propTypes = {
  display: PropTypes.bool,
  setDisplay: PropTypes.func
}

export default RecordsList
