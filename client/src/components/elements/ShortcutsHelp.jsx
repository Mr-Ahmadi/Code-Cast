import { memo, useEffect, useRef } from "react";
import PropTypes from 'prop-types';
import { FiX, FiTerminal, FiCircle, FiPlay, FiFolder, FiSkipBack, FiHelpCircle } from "react-icons/fi";

const shortcuts = [
  { keys: "Ctrl+Enter", desc: "Execute code", icon: FiTerminal },
  { keys: "Ctrl+R", desc: "Start / Stop recording", icon: FiCircle },
  { keys: "Ctrl+P", desc: "Play / Stop playback", icon: FiPlay },
  { keys: "Ctrl+O", desc: "Open recordings", icon: FiFolder },
  { keys: "← / →", desc: "Skip back / forward 5s", icon: FiSkipBack },
  { keys: "?", desc: "Toggle this help", icon: FiHelpCircle },
];

const ShortcutsHelp = memo(({ display, setDisplay }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (!display) return;
    const prev = document.activeElement;
    ref.current?.focus();

    const handler = (e) => {
      if (e.key === 'Escape' || e.key === '?' || e.key === '/') {
        e.preventDefault();
        setDisplay(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      prev?.focus();
    };
  }, [display, setDisplay]);

  if (!display) return null;

  return (
    <div
      className="modal-container"
      onClick={(e) => { if (e.target === e.currentTarget) setDisplay(false); }}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div className="modal-box shortcuts-box" onClick={e => e.stopPropagation()} ref={ref} tabIndex={-1}>
        <div className="modal-header">
          <h2 className="modal-title">Keyboard Shortcuts</h2>
          <button className="modal-close" onClick={() => setDisplay(false)} aria-label="Close">
            <FiX size={18} />
          </button>
        </div>
        <div className="shortcuts-list">
          {shortcuts.map(({ keys, desc, icon: Icon }) => (
            <div key={keys} className="shortcut-row">
              <kbd className="shortcut-keys">{keys}</kbd>
              <span className="shortcut-desc"><Icon size={13} /> {desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

ShortcutsHelp.displayName = 'ShortcutsHelp';

ShortcutsHelp.propTypes = {
  display: PropTypes.bool,
  setDisplay: PropTypes.func,
};

export default ShortcutsHelp;