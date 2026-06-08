import { useEffect, useMemo, useRef, useState, memo } from "react";
import PropTypes from "prop-types";

const MenuBar = memo(({
  recording,
  playing,
  canExport,
  hasWorkspace,
  showMinimap,
  autoSave,
  setAutoSave,
  onOpenProject,
  onImport,
  onExport,
  onRun,
  onRecord,
  onPlay,
  onToggleExplorer,
  onToggleTerminal,
  onToggleMinimap,
  onNewTerminal,
  onCloseTerminal,
  onShowShortcuts,
}) => {
  const [openMenu, setOpenMenu] = useState(null);
  const rootRef = useRef(null);

  useEffect(() => {
    const handleOutside = (e) => {
      if (!rootRef.current?.contains(e.target)) {
        setOpenMenu(null);
      }
    };
    const handleEsc = (e) => {
      if (e.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const runEditCommand = (cmd) => {
    try {
      document.execCommand(cmd);
    } catch {
      // no-op
    }
  };

  const menus = useMemo(() => ([
    {
      id: "file",
      label: "File",
      items: [
        { label: "Open Project...", shortcut: "Ctrl+O", action: onOpenProject },
        { label: "Save", shortcut: "Ctrl+S", action: () => window.__saveCurrentFile?.(), disabled: !hasWorkspace },
        { label: autoSave ? "Disable Autosave" : "Enable Autosave", action: () => setAutoSave(!autoSave) },
        { separator: true },
        { label: "Import Recording...", action: onImport },
        { label: "Export Recording", action: onExport, disabled: !canExport },
      ],
    },
    {
      id: "edit",
      label: "Edit",
      items: [
        { label: "Undo", shortcut: "Ctrl+Z", action: () => runEditCommand("undo") },
        { label: "Redo", shortcut: "Ctrl+Shift+Z", action: () => runEditCommand("redo") },
        { separator: true },
        { label: "Cut", shortcut: "Ctrl+X", action: () => runEditCommand("cut") },
        { label: "Copy", shortcut: "Ctrl+C", action: () => runEditCommand("copy") },
        { label: "Paste", shortcut: "Ctrl+V", action: () => runEditCommand("paste") },
      ],
    },
    {
      id: "selection",
      label: "Selection",
      items: [
        { label: "Select All", shortcut: "Ctrl+A", action: () => runEditCommand("selectAll") },
      ],
    },
    {
      id: "view",
      label: "View",
      items: [
        { label: "Toggle Explorer", action: onToggleExplorer },
        { label: "Toggle Terminal", shortcut: "Ctrl+`", action: onToggleTerminal },
        { label: showMinimap ? "Hide Minimap" : "Show Minimap", action: onToggleMinimap },
      ],
    },
    {
      id: "run",
      label: "Run",
      items: [
        { label: "Run Code", shortcut: "Ctrl+Enter", action: onRun, disabled: !hasWorkspace },
        {
          label: recording ? "Stop Recording" : "Start Recording",
          shortcut: "Ctrl+R",
          action: onRecord,
          disabled: playing || !hasWorkspace,
        },
        { label: playing ? "Stop Playback" : "Play Recording", shortcut: "Ctrl+P", action: onPlay, disabled: recording },
      ],
    },
    {
      id: "terminal",
      label: "Terminal",
      items: [
        { label: "New Terminal", action: onNewTerminal },
        { label: "Close Active Terminal", action: onCloseTerminal },
      ],
    },
    {
      id: "help",
      label: "Help",
      items: [
        { label: "Keyboard Shortcuts", shortcut: "?", action: onShowShortcuts },
      ],
    },
  ]), [
    recording,
    playing,
    canExport,
    hasWorkspace,
    showMinimap,
    onOpenProject,
    onImport,
    onExport,
    onRun,
    onRecord,
    onPlay,
    onToggleExplorer,
    onToggleTerminal,
    onToggleMinimap,
    onNewTerminal,
    onCloseTerminal,
    onShowShortcuts,
  ]);

  return (
    <div className="menu-bar" ref={rootRef}>
      {menus.map((menu) => (
        <div
          key={menu.id}
          className="menu-entry"
          onMouseEnter={() => {
            if (openMenu) setOpenMenu(menu.id);
          }}
        >
          <button
            className={"menu-button" + (openMenu === menu.id ? " active" : "")}
            onClick={() => setOpenMenu((prev) => prev === menu.id ? null : menu.id)}
            aria-haspopup="menu"
            aria-expanded={openMenu === menu.id}
          >
            {menu.label}
          </button>
          {openMenu === menu.id && (
            <div className="menu-dropdown" role="menu">
              {menu.items.map((item, index) => (
                item.separator
                  ? <div key={`${menu.id}-sep-${index}`} className="menu-separator" role="separator" />
                  : (
                    <button
                      key={`${menu.id}-${item.label}`}
                      className={"menu-item" + (item.disabled ? " disabled" : "")}
                      role="menuitem"
                      disabled={item.disabled}
                      onClick={() => {
                        if (item.disabled) return;
                        item.action?.();
                        setOpenMenu(null);
                      }}
                    >
                      <span className="menu-item-label">{item.label}</span>
                      {item.shortcut && <span className="menu-item-shortcut">{item.shortcut}</span>}
                    </button>
                  )
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
});

MenuBar.displayName = "MenuBar";

MenuBar.propTypes = {
  recording: PropTypes.bool,
  playing: PropTypes.bool,
  canExport: PropTypes.bool,
  hasWorkspace: PropTypes.bool,
  showMinimap: PropTypes.bool,
  autoSave: PropTypes.bool,
  setAutoSave: PropTypes.func,
  onOpenProject: PropTypes.func,
  onImport: PropTypes.func,
  onExport: PropTypes.func,
  onRun: PropTypes.func,
  onRecord: PropTypes.func,
  onPlay: PropTypes.func,
  onToggleExplorer: PropTypes.func,
  onToggleTerminal: PropTypes.func,
  onToggleMinimap: PropTypes.func,
  onNewTerminal: PropTypes.func,
  onCloseTerminal: PropTypes.func,
  onShowShortcuts: PropTypes.func,
};

export default MenuBar;
