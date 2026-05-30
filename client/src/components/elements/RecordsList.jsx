import { useContext, useState, useEffect, useRef, useCallback, memo } from 'react'
import { GlobalContext } from '../../contexts/GlobalStates';
import PropTypes from 'prop-types';
import { init as initRecord, load as loadRecord } from "../../functions/record";
import axios from "axios";
import { FiFileText, FiPlus, FiX, FiTrash2, FiSearch } from "react-icons/fi";

const RecordsList = memo(({ display, setDisplay }) => {
  const { user, setRecordName, setToast, refreshUser } = useContext(GlobalContext);
  const [selected, setSelected] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [loading, setLoading] = useState(null)
  const [search, setSearch] = useState("")
  const [renaming, setRenaming] = useState(null)
  const [renameValue, setRenameValue] = useState("")
  const records = user?.records || [];
  const modalRef = useRef(null);
  const listRef = useRef(null);
  const renameRef = useRef(null);

  const filtered = search
    ? records.filter(([name]) => name.toLowerCase().includes(search.toLowerCase()))
    : records;

  const closeModal = useCallback(() => {
    setDisplay(false);
    setSelected(null);
    setConfirmDelete(null);
    setSearch("");
    setRenaming(null);
  }, [setDisplay]);

  const handleOpen = useCallback(async () => {
    if (selected) {
      setLoading(selected);
      try {
        if (selected === true) {
          initRecord()
          closeModal()
        } else {
          const name = await loadRecord(selected)
          setRecordName(name)
          closeModal()
        }
      } catch {
        setToast({ type: "ERROR", message: "Failed to load record" });
      } finally {
        setLoading(null);
      }
    }
  }, [selected, closeModal, setToast, setRecordName]);

  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const handleOpenRef = useRef(handleOpen);
  handleOpenRef.current = handleOpen;

  useEffect(() => {
    if (!display) return;
    const prev = document.activeElement;
    const firstFocusable = modalRef.current?.querySelector('button, [tabindex]:not([tabindex="-1"])');
    firstFocusable?.focus();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeModal();
      }
      if (e.key === 'Enter' && selectedRef.current && !renaming) {
        handleOpenRef.current();
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = listRef.current?.querySelectorAll('.file-row, .file-label.new-record');
        if (!items || !items.length) return;
        const currentIndex = Array.from(items).findIndex(item =>
          item.classList.contains('selected')
        );
        const nextIndex = e.key === 'ArrowDown'
          ? Math.min(currentIndex + 1, items.length - 1)
          : Math.max(currentIndex - 1, 0);
        const nextItem = items[nextIndex];
        if (nextItem) {
          const label = nextItem.querySelector('.file-label');
          if (label) {
            label.click();
          } else if (nextItem.classList.contains('file-label')) {
            nextItem.click();
          }
          nextItem.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      prev?.focus();
    };
  }, [display, closeModal, renaming]);

  const handleDelete = useCallback(async (id, name) => {
    if (confirmDelete === id) {
      try {
        await axios.request({
          method: "delete",
          url: `index/delete/${id}`,
          withCredentials: true,
        });
        setToast({ type: "SUCCESS", message: `"${name}" deleted` });
        refreshUser();
      } catch {
        setToast({ type: "ERROR", message: "Failed to delete record" });
      }
      setConfirmDelete(null);
    } else {
      setConfirmDelete(id);
    }
  }, [confirmDelete, setToast, refreshUser]);

  const handleSelect = useCallback((id) => {
    setSelected(id);
    setConfirmDelete(null);
  }, []);

  const handleRename = useCallback(async (id, oldName) => {
    const newName = renameValue.trim();
    if (!newName || newName === oldName) {
      setRenaming(null);
      return;
    }
    try {
      await axios.request({
        method: "patch",
        url: `index/rename/${id}`,
        data: { name: newName },
        headers: { "Content-Type": "application/json" },
        withCredentials: true,
      });
      setToast({ type: "SUCCESS", message: `Renamed to "${newName}"` });
      refreshUser();
    } catch {
      setToast({ type: "ERROR", message: "Failed to rename" });
    }
    setRenaming(null);
  }, [renameValue, setToast, refreshUser]);

  const startRename = useCallback((id, currentName) => {
    setRenaming(id);
    setRenameValue(currentName);
    setTimeout(() => renameRef.current?.focus(), 50);
  }, []);

  if (!display) return null;

  return (
    <div
      className="modal-container"
      onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Recordings list"
      ref={modalRef}
    >
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Records</h2>
          <button className="modal-close" onClick={closeModal} aria-label="Close dialog">
            <FiX size={18} />
          </button>
        </div>
        {records.length > 0 && (
          <div className="search-bar">
            <FiSearch size={14} className="search-icon" aria-hidden="true" />
            <input
              type="text"
              className="search-input"
              placeholder="Filter records..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Filter records"
            />
          </div>
        )}
        <div className='list-container' ref={listRef} role="listbox" aria-label="Select a recording">
          {filtered.length ? filtered.map((record) => (
            <div
              key={record[1]}
              className={"file-row" + (selected === record[1] ? " selected" : "")}
              role="option"
              aria-selected={selected === record[1]}
            >
              {renaming === record[1] ? (
                <input
                  ref={renameRef}
                  className="rename-input"
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onBlur={() => handleRename(record[1], record[0])}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleRename(record[1], record[0]);
                    if (e.key === 'Escape') setRenaming(null);
                  }}
                  onClick={e => e.stopPropagation()}
                  aria-label="Record name"
                />
              ) : (
                <span
                  className="file-label"
                  onClick={() => handleSelect(record[1])}
                  onDoubleClick={() => startRename(record[1], record[0])}
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSelect(record[1]); }}
                  title="Double-click to rename"
                >
                  <FiFileText size={14} aria-hidden="true" />
                  {record[0]}
                </span>
              )}
              <button
                className={"btn-delete" + (confirmDelete === record[1] ? " confirming" : "")}
                onClick={(e) => { e.stopPropagation(); handleDelete(record[1], record[0]); }}
                title={confirmDelete === record[1] ? "Click again to confirm" : "Delete"}
                aria-label={confirmDelete === record[1] ? `Confirm delete ${record[0]}` : `Delete ${record[0]}`}
                tabIndex={0}
              >
                <FiTrash2 size={13} />
              </button>
            </div>
          )) : records.length ? (
            <div className="modal-empty" role="status">No records match &quot;{search}&quot;</div>
          ) : (
            <div className="modal-empty" role="status">
              <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.4 }}><FiFileText size={32} /></div>
              No recordings yet<br />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Start a new recording to begin</span>
            </div>
          )}
          <span
            className={'file-label new-record' + (selected === true ? " selected" : "")}
            onClick={() => handleSelect(true)}
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSelect(true); }}
            role="option"
            aria-selected={selected === true}
          >
            <FiPlus size={14} aria-hidden="true" />
            New Record...
          </span>
        </div>
        <div className="modal-footer">
          <div>
            <input
              type="text"
              className={"text-input" + (selected === true ? "" : " hide")}
              defaultValue={"Untitled"}
              onChange={ev => setRecordName(ev.target.value)}
              aria-label="Record name"
            />
          </div>
          <div>
            <button className="btn btn-secondary btn-sm" onClick={closeModal}>Cancel</button>
            <button
              className={"btn btn-primary btn-sm" + (loading ? " btn-loading" : "")}
              disabled={selected === null || !!loading}
              onClick={handleOpen}
            >
              Open
            </button>
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