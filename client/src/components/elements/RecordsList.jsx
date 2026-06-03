import { useContext, useState, useEffect, useRef, useCallback, memo } from 'react'
import { GlobalContext } from '../../contexts/GlobalStates';
import { useMode, MODES } from '../../contexts/ModeContext';
import PropTypes from 'prop-types';
import { init as initRecord, load as loadRecord, addFile as recordAddFile } from "../../functions/record";
import * as localStore from "../../stores/localStore";
import axios from "axios";
import { FiFileText, FiPlus, FiX, FiTrash2, FiSearch, FiChevronRight, FiChevronDown, FiFolder } from "react-icons/fi";

const RecordsList = memo(({ display, setDisplay }) => {
  const { user, setRecordName, setToast, refreshUser, setCurrentWorkspace, setCurrentRecord } = useContext(GlobalContext);
  const { mode } = useMode();
  const isLocal = mode === MODES.LOCAL;
  const [selected, setSelected] = useState(null)
  const [selectedWs, setSelectedWs] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [loading, setLoading] = useState(null)
  const [search, setSearch] = useState("")
  const [expanded, setExpanded] = useState({})
  const [creatingWs, setCreatingWs] = useState(false)
  const [localProjects, setLocalProjects] = useState([])
  const modalRef = useRef(null);
  const listRef = useRef(null);

  const projects = isLocal ? localProjects : (user?.workspaces || []);

  const refreshLocal = useCallback(async () => {
    if (!isLocal) return;
    const projects = await localStore.getLocalProjects();
    const result = [];
    for (const p of projects) {
      const records = await localStore.getLocalRecordings(p.id);
      result.push({ id: p.id, name: p.name, files: p.files, records });
    }
    setLocalProjects(result);
  }, [isLocal]);

  useEffect(() => {
    if (display && isLocal) {
      refreshLocal();
    }
  }, [display, isLocal, refreshLocal]);

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
  }, [setDisplay]);

  const handleOpenProject = useCallback(async (ws) => {
    setLoading(ws.id);
    try {
      initRecord();
      for (const [name, fd] of Object.entries(ws.files || {})) {
        recordAddFile(name, fd.language, fd.firstValue || "");
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
    setLoading(recordId);
    try {
      if (isLocal) {
        const rec = await localStore.getLocalRecording(recordId);
        if (!rec) throw new Error("Recording not found");
        initRecord();
        const data = rec.data;
        if (data.files) {
          for (const [fName, fd] of Object.entries(data.files)) {
            recordAddFile(fName, fd.language || "plaintext", fd.firstValue || "");
          }
        }
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

  const handleCreateWorkspace = useCallback(async () => {
    setCreatingWs(true);
    try {
      if (isLocal) {
        const ws = await localStore.createLocalProject("New Project");
        if (!ws) {
          setCreatingWs(false);
          return;
        }
        initRecord();
        for (const [name, fd] of Object.entries(ws.files || {})) {
          recordAddFile(name, fd.language, fd.firstValue || "");
        }
        setCurrentWorkspace({ id: ws.id, name: ws.name, files: ws.files, path: ws.path || null });
        setCurrentRecord(null);
        setRecordName("Untitled");
        setToast({ type: "SUCCESS", message: `Project "${ws.name}" created` });
        await refreshLocal();
        setExpanded(prev => ({ ...prev, [ws.id]: true }));
        closeModal();
      } else {
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
      }
    } catch (err) {
      setToast({ type: "ERROR", message: err?.response?.data?.message || err.message || "Failed to create project" });
    } finally {
      setCreatingWs(false);
    }
  }, [isLocal, setToast, refreshUser, setCurrentWorkspace, setCurrentRecord, setRecordName, closeModal, refreshLocal]);

  const handleDeleteRecord = useCallback(async (id, name) => {
    if (confirmDelete === id) {
      try {
        if (isLocal) {
          await localStore.deleteLocalRecording(id);
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

  const handleDeleteWorkspace = useCallback(async (id, name) => {
    if (confirmDelete === `ws-${id}`) {
      try {
        if (isLocal) {
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
        setToast({ type: "SUCCESS", message: `Project "${name}" deleted` });
      } catch {
        setToast({ type: "ERROR", message: "Failed to delete project" });
      }
      setConfirmDelete(null);
    } else {
      setConfirmDelete(`ws-${id}`);
    }
  }, [confirmDelete, setToast, refreshUser, isLocal, refreshLocal]);

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
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
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
                  onClick={(e) => { e.stopPropagation(); handleDeleteWorkspace(ws.id, ws.name); }}
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
                        onClick={(e) => { e.stopPropagation(); handleDeleteRecord(record[1], record[0]); }}
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
        <div className="modal-footer">
          <div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleCreateWorkspace}
              disabled={creatingWs}
            >
              <FiPlus size={12} /> New Project
            </button>
          </div>
          <div>
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
