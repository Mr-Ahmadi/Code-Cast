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
  theme,
  onToggleTheme,
  onNewFile,
  onOpenProject,
  onSave,
  onSaveAs,
  onSaveAll,
  onUndo,
  onRedo,
  onCut,
  onCopy,
  onPaste,
  onFind,
  onReplace,
  onSelectAll,
  onExpandSelection,
  onShrinkSelection,
  onAddCursorAbove,
  onAddCursorBelow,
  onImport,
  onExport,
  onGoToLine,
  onGoToSymbol,
  onGoToBracket,
  onIncreaseFontSize,
  onDecreaseFontSize,
  onResetFontSize,
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

  const shortcut = (windows, mac = windows.replace("Ctrl", "Cmd")) => (
    window.electronAPI?.platform === "darwin" ? mac : windows
  );

  const menus = useMemo(() => ([
    {
      id: "file",
      label: "File",
      items: [
        { label: "New File", shortcut: shortcut("Ctrl+N"), action: onNewFile, disabled: !hasWorkspace },
        { label: "Open Project...", shortcut: shortcut("Ctrl+O"), action: onOpenProject },
        { separator: true },
        { label: "Save", shortcut: shortcut("Ctrl+S"), action: onSave, disabled: !hasWorkspace },
        { label: "Save As...", shortcut: shortcut("Ctrl+Shift+S"), action: onSaveAs, disabled: !hasWorkspace },
        { label: "Save All", shortcut: shortcut("Ctrl+Alt+S"), action: onSaveAll, disabled: !hasWorkspace },
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
        { label: "Undo", shortcut: shortcut("Ctrl+Z"), action: onUndo },
        { label: "Redo", shortcut: shortcut("Ctrl+Shift+Z"), action: onRedo },
        { separator: true },
        { label: "Cut", shortcut: shortcut("Ctrl+X"), action: onCut },
        { label: "Copy", shortcut: shortcut("Ctrl+C"), action: onCopy },
        { label: "Paste", shortcut: shortcut("Ctrl+V"), action: onPaste },
        { separator: true },
        { label: "Find", shortcut: shortcut("Ctrl+F"), action: onFind },
        { label: "Replace", shortcut: shortcut("Ctrl+Alt+F", "Cmd+Alt+F"), action: onReplace },
      ],
    },
    {
      id: "selection",
      label: "Selection",
      items: [
        { label: "Select All", shortcut: shortcut("Ctrl+A"), action: onSelectAll },
        { separator: true },
        { label: "Expand Selection", shortcut: shortcut("Shift+Alt+Right"), action: onExpandSelection },
        { label: "Shrink Selection", shortcut: shortcut("Shift+Alt+Left"), action: onShrinkSelection },
        { separator: true },
        { label: "Add Cursor Above", shortcut: shortcut("Ctrl+Alt+Up"), action: onAddCursorAbove },
        { label: "Add Cursor Below", shortcut: shortcut("Ctrl+Alt+Down"), action: onAddCursorBelow },
      ],
    },
    {
      id: "view",
      label: "View",
      items: [
        { label: "Toggle Explorer", shortcut: shortcut("Ctrl+B"), action: onToggleExplorer },
        { label: "Toggle Terminal", shortcut: shortcut("Ctrl+`"), action: onToggleTerminal },
        { label: showMinimap ? "Hide Minimap" : "Show Minimap", action: onToggleMinimap },
        { separator: true },
        { label: "Increase Font Size", shortcut: shortcut("Ctrl+="), action: onIncreaseFontSize },
        { label: "Decrease Font Size", shortcut: shortcut("Ctrl+-"), action: onDecreaseFontSize },
        { label: "Reset Font Size", shortcut: shortcut("Ctrl+0"), action: onResetFontSize },
        { separator: true },
        { label: theme === 'light' ? "Switch to Dark Theme" : "Switch to Light Theme", action: onToggleTheme },
      ],
    },
    {
      id: "go",
      label: "Go",
      items: [
        { label: "Go to Line/Column...", shortcut: shortcut("Ctrl+G"), action: onGoToLine },
        { label: "Go to Symbol...", shortcut: shortcut("Ctrl+Shift+O"), action: onGoToSymbol },
        { label: "Go to Bracket", shortcut: shortcut("Ctrl+Shift+\\"), action: onGoToBracket },
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
        { label: "Toggle Terminal", shortcut: shortcut("Ctrl+`"), action: onToggleTerminal },
        { separator: true },
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
    autoSave,
    setAutoSave,
    theme,
    onToggleTheme,
    onNewFile,
    onOpenProject,
    onSave,
    onSaveAs,
    onSaveAll,
    onUndo,
    onRedo,
    onCut,
    onCopy,
    onPaste,
    onFind,
    onReplace,
    onSelectAll,
    onExpandSelection,
    onShrinkSelection,
    onAddCursorAbove,
    onAddCursorBelow,
    onImport,
    onExport,
    onGoToLine,
    onGoToSymbol,
    onGoToBracket,
    onIncreaseFontSize,
    onDecreaseFontSize,
    onResetFontSize,
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
  theme: PropTypes.string,
  onToggleTheme: PropTypes.func,
  onNewFile: PropTypes.func,
  onOpenProject: PropTypes.func,
  onSave: PropTypes.func,
  onSaveAs: PropTypes.func,
  onSaveAll: PropTypes.func,
  onUndo: PropTypes.func,
  onRedo: PropTypes.func,
  onCut: PropTypes.func,
  onCopy: PropTypes.func,
  onPaste: PropTypes.func,
  onFind: PropTypes.func,
  onReplace: PropTypes.func,
  onSelectAll: PropTypes.func,
  onExpandSelection: PropTypes.func,
  onShrinkSelection: PropTypes.func,
  onAddCursorAbove: PropTypes.func,
  onAddCursorBelow: PropTypes.func,
  onImport: PropTypes.func,
  onExport: PropTypes.func,
  onGoToLine: PropTypes.func,
  onGoToSymbol: PropTypes.func,
  onGoToBracket: PropTypes.func,
  onIncreaseFontSize: PropTypes.func,
  onDecreaseFontSize: PropTypes.func,
  onResetFontSize: PropTypes.func,
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
