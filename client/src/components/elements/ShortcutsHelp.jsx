import { memo, useEffect, useRef } from "react";
import PropTypes from 'prop-types';
import {
  FiX, FiTerminal, FiCircle, FiPlay, FiFolder, FiSkipBack, FiHelpCircle, FiSave,
  FiScissors, FiCopy, FiClipboard, FiList, FiCornerUpLeft, FiCornerUpRight,
  FiSearch, FiArrowUp, FiArrowDown, FiCrosshair, FiCode, FiMove,
} from "react-icons/fi";

const shortcuts = [
  // General
  { group: "General" },
  { keys: "Ctrl+S", desc: "Save current file", icon: FiSave },
  { keys: "Ctrl+Enter", desc: "Execute code", icon: FiTerminal },
  { keys: "Ctrl+R", desc: "Start / Stop recording", icon: FiCircle },
  { keys: "Ctrl+P", desc: "Play / Stop playback", icon: FiPlay },
  { keys: "Ctrl+O", desc: "Open recordings", icon: FiFolder },
  { keys: "Ctrl+`", desc: "Toggle terminal", icon: FiTerminal },
  { keys: "← / →", desc: "Skip back / forward 5s", icon: FiSkipBack },
  { keys: "?", desc: "Toggle this help", icon: FiHelpCircle },

  // Edit
  { group: "Edit" },
  { keys: "Ctrl+Z", desc: "Undo", icon: FiCornerUpLeft },
  { keys: "Ctrl+Shift+Z", desc: "Redo", icon: FiCornerUpRight },
  { keys: "Ctrl+X", desc: "Cut", icon: FiScissors },
  { keys: "Ctrl+C", desc: "Copy", icon: FiCopy },
  { keys: "Ctrl+V", desc: "Paste", icon: FiClipboard },
  { keys: "Ctrl+F", desc: "Find", icon: FiSearch },
  { keys: "Ctrl+Alt+F", desc: "Replace", icon: FiSearch },

  // Selection
  { group: "Selection" },
  { keys: "Ctrl+A", desc: "Select all", icon: FiList },
  { keys: "Ctrl+D", desc: "Add selection to next find match", icon: FiCrosshair },
  { keys: "Ctrl+Shift+L", desc: "Select all occurrences", icon: FiCrosshair },
  { keys: "Shift+Alt+→", desc: "Expand selection", icon: FiMove },
  { keys: "Shift+Alt+←", desc: "Shrink selection", icon: FiMove },
  { keys: "Ctrl+Alt+↑", desc: "Add cursor above", icon: FiArrowUp },
  { keys: "Ctrl+Alt+↓", desc: "Add cursor below", icon: FiArrowDown },

  // Code actions
  { group: "Code" },
  { keys: "Ctrl+G", desc: "Go to line", icon: FiCode },
  { keys: "Ctrl+Shift+O", desc: "Go to symbol", icon: FiCode },
  { keys: "Ctrl+Shift+\\", desc: "Go to bracket", icon: FiCode },
  { keys: "Shift+Alt+↓", desc: "Duplicate line down", icon: FiCopy },
  { keys: "Shift+Alt+↑", desc: "Duplicate line up", icon: FiCopy },
];

const ShortcutsHelp = memo(({ display, setDisplay }) => {
  const ref = useRef(null);

  useEffect(() => {
    document.body.classList.toggle('dialog-open', display);
    if (window.electronAPI?.window?.setResizable) {
      window.electronAPI.window.setResizable(!display);
    }
  }, [display]);

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
          {shortcuts.map((item) => {
            if (item.group) {
              return <div key={item.group} className="shortcut-group-header">{item.group}</div>;
            }
            const { keys, desc, icon: Icon } = item;
            return (
              <div key={keys} className="shortcut-row">
                <kbd className="shortcut-keys">{keys}</kbd>
                <span className="shortcut-desc"><Icon size={13} /> {desc}</span>
              </div>
            );
          })}
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