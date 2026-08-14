import { useState, useCallback, useEffect, useRef, useMemo, useContext, memo } from 'react';
import { GlobalContext } from '../../contexts/GlobalStates';
import { getFiles } from '../../functions/record';
import {
  FiSearch, FiFile, FiCode, FiCpu, FiZap, FiTerminal, FiSave, FiSettings,
  FiEdit3, FiEye, FiGitBranch, FiCommand,
} from 'react-icons/fi';

/**
 * Subsequence match with a score that favours consecutive hits and matches at
 * word boundaries, so "gtl" ranks "Go to Line" above an incidental match.
 * Returns null when the query is not a subsequence of the text.
 */
function fuzzyScore(text, query) {
  if (!query) return 0;
  const lower = text.toLowerCase();
  let score = 0;
  let textIndex = 0;
  let lastHit = -1;

  for (const ch of query.toLowerCase()) {
    const found = lower.indexOf(ch, textIndex);
    if (found === -1) return null;
    if (found === lastHit + 1) score += 8;
    if (found === 0 || /[\s/\-_.:]/.test(lower[found - 1])) score += 6;
    score -= Math.min(found - textIndex, 6);
    lastHit = found;
    textIndex = found + 1;
  }
  // Shorter labels that contain the same match are the better answer.
  return score - text.length * 0.08;
}

const modKey = () => (window.electronAPI?.platform === 'darwin' ? 'Cmd' : 'Ctrl');

/** Runs a Monaco editor action after making sure the editor has focus. */
const editorAction = (id) => () => {
  window.__focusEditor?.();
  window.__runEditorAction?.(id);
};

const clickShortcut = (name) => () => {
  document.querySelector(`[data-shortcut="${name}"]`)?.click();
};

const CommandPalette = memo(() => {
  // Terminal and panel state live in MainPage, so those commands go through the
  // window bridge the rest of the app already uses for them.
  const {
    settingsOpen, setSettingsOpen, setActiveFile, theme, setTheme,
  } = useContext(GlobalContext);

  const [open, setOpen] = useState(false);
  /** '' for commands, '>' typed by the user is stripped, '@' switches to files. */
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('commands');
  const [selected, setSelected] = useState(0);

  const inputRef = useRef(null);
  const listRef = useRef(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setMode('commands');
    setSelected(0);
    window.__focusEditor?.();
  }, []);

  const openPalette = useCallback((initialMode = 'commands') => {
    setMode(initialMode);
    setQuery('');
    setSelected(0);
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 20);
  }, []);

  const commands = useMemo(() => [
    // --- AI -------------------------------------------------------------
    { id: 'ai.edit', label: 'AI: Edit Selection…', hint: `${modKey()}+K`, icon: FiZap,
      run: () => window.__openInlineAiEdit?.() },
    { id: 'ai.suggest', label: 'AI: Trigger Inline Suggestion', hint: `${modKey()}+Shift+Space`, icon: FiCpu,
      run: editorAction('codecast.aiAutocomplete') },
    { id: 'ai.chat', label: 'AI: Open Chat', icon: FiCpu,
      run: () => window.__setActivePanel?.('chat') },
    { id: 'ai.explain', label: 'AI: Explain Selection', icon: FiCpu,
      run: () => window.__openAiChat?.({ useSelection: true, label: 'explain' }) },
    { id: 'ai.bugs', label: 'AI: Find Bugs in Selection', icon: FiCpu,
      run: () => window.__openAiChat?.({ useSelection: true, label: 'bugs' }) },
    { id: 'ai.tests', label: 'AI: Write Tests for Selection', icon: FiCpu,
      run: () => window.__openAiChat?.({ useSelection: true, label: 'tests' }) },

    // --- File -----------------------------------------------------------
    { id: 'file.save', label: 'File: Save', hint: `${modKey()}+S`, icon: FiSave,
      run: () => window.__saveCurrentFile?.() },
    { id: 'file.saveAs', label: 'File: Save As…', hint: `${modKey()}+Shift+S`, icon: FiSave,
      run: () => window.__saveCurrentFileAs?.() },
    { id: 'file.saveAll', label: 'File: Save All', icon: FiSave,
      run: () => window.__saveAllFiles?.() },
    { id: 'file.new', label: 'File: New File', hint: `${modKey()}+N`, icon: FiFile,
      run: () => (window.__startNewFile || window.__createNewFile)?.() },
    { id: 'file.open', label: 'File: Open Project / Recording', hint: `${modKey()}+O`, icon: FiFile,
      run: clickShortcut('open') },

    // --- Edit -----------------------------------------------------------
    { id: 'edit.format', label: 'Format Document', hint: 'Shift+Alt+F', icon: FiCode,
      run: () => window.__formatDocument?.() },
    { id: 'edit.find', label: 'Find', hint: `${modKey()}+F`, icon: FiSearch,
      run: editorAction('actions.find') },
    { id: 'edit.replace', label: 'Replace', hint: `${modKey()}+Alt+F`, icon: FiSearch,
      run: editorAction('editor.action.startFindReplaceAction') },
    { id: 'edit.comment', label: 'Toggle Line Comment', hint: `${modKey()}+/`, icon: FiEdit3,
      run: editorAction('editor.action.commentLine') },
    { id: 'edit.foldAll', label: 'Fold All', icon: FiCode, run: editorAction('editor.foldAll') },
    { id: 'edit.unfoldAll', label: 'Unfold All', icon: FiCode, run: editorAction('editor.unfoldAll') },
    { id: 'edit.sortAsc', label: 'Sort Lines Ascending', icon: FiCode,
      run: editorAction('editor.action.sortLinesAscending') },
    { id: 'edit.trimWhitespace', label: 'Trim Trailing Whitespace', icon: FiCode,
      run: editorAction('editor.action.trimTrailingWhitespace') },

    // --- Go to ----------------------------------------------------------
    { id: 'go.line', label: 'Go to Line…', hint: `${modKey()}+G`, icon: FiCode,
      run: editorAction('editor.action.gotoLine') },
    { id: 'go.symbol', label: 'Go to Symbol…', hint: `${modKey()}+Shift+O`, icon: FiCode,
      run: editorAction('editor.action.quickOutline') },
    { id: 'go.definition', label: 'Go to Definition', hint: 'F12', icon: FiCode,
      run: editorAction('editor.action.revealDefinition') },
    { id: 'go.references', label: 'Find All References', icon: FiCode,
      run: editorAction('editor.action.goToReferences') },
    { id: 'go.rename', label: 'Rename Symbol', hint: 'F2', icon: FiEdit3,
      run: editorAction('editor.action.rename') },

    // --- View -----------------------------------------------------------
    { id: 'view.terminal', label: 'View: Toggle Terminal', hint: `${modKey()}+\``, icon: FiTerminal,
      run: () => window.__setTerminalVisible?.(v => !v) },
    { id: 'view.explorer', label: 'View: Toggle Explorer', icon: FiEye,
      run: () => window.__toggleExplorer?.() },
    { id: 'view.minimap', label: 'View: Toggle Minimap', icon: FiEye,
      run: () => window.__toggleMinimap?.() },
    { id: 'view.theme', label: `View: Switch to ${theme === 'light' ? 'Dark' : 'Light'} Theme`, icon: FiEye,
      run: () => setTheme(theme === 'light' ? 'dark' : 'light') },
    { id: 'view.git', label: 'View: Source Control', icon: FiGitBranch,
      run: () => window.__showSidebarPanel?.('git') },
    { id: 'view.explorerPanel', label: 'View: Explorer', icon: FiFile,
      run: () => window.__showSidebarPanel?.('explorer') },
    { id: 'view.settings', label: 'Preferences: Open Settings', icon: FiSettings,
      run: () => setSettingsOpen(true) },

    // --- Run ------------------------------------------------------------
    { id: 'run.execute', label: 'Run: Execute Code', hint: `${modKey()}+Enter`, icon: FiTerminal,
      run: clickShortcut('execute') },
    { id: 'run.record', label: 'Record: Start / Stop', hint: `${modKey()}+R`, icon: FiTerminal,
      run: clickShortcut('record') },
    { id: 'run.play', label: 'Playback: Play / Stop', hint: `${modKey()}+P`, icon: FiTerminal,
      run: clickShortcut('play') },
  ], [setSettingsOpen, theme, setTheme]);

  const fileItems = useMemo(() => {
    if (!open || mode !== 'files') return [];
    return getFiles().map(f => ({
      id: `file:${f.name}`,
      label: f.name,
      icon: FiFile,
      run: () => (window.__openFileTab || setActiveFile)(f.name),
    }));
  }, [open, mode, setActiveFile]);

  const results = useMemo(() => {
    const source = mode === 'files' ? fileItems : commands;
    const trimmed = query.trim();
    if (!trimmed) return source.slice(0, 60);
    return source
      .map(item => ({ item, score: fuzzyScore(item.label, trimmed) }))
      .filter(entry => entry.score !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 60)
      .map(entry => entry.item);
  }, [query, mode, commands, fileItems]);

  useEffect(() => { setSelected(0); }, [query, mode]);

  // Keep the highlighted row inside the scroll viewport.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector('.command-palette-item.selected')
      ?.scrollIntoView({ block: 'nearest' });
  }, [selected, open, results]);

  useEffect(() => {
    window.__openCommandPalette = openPalette;
    return () => { window.__openCommandPalette = undefined; };
  }, [openPalette]);

  const runItem = useCallback((item) => {
    if (!item) return;
    close();
    // Deferred so the palette has closed (and released focus) before the
    // command runs — several of them focus the editor themselves.
    setTimeout(() => item.run(), 0);
  }, [close]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected(i => (results.length ? (i + 1) % results.length : 0));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected(i => (results.length ? (i - 1 + results.length) % results.length : 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      runItem(results[selected]);
    }
  }, [close, results, selected, runItem]);

  const handleChange = useCallback((e) => {
    const value = e.target.value;
    // Leading sigils switch list source the way the VS Code palette does.
    if (value.startsWith('>')) {
      setMode('commands');
      setQuery(value.slice(1));
    } else if (value.startsWith('@')) {
      setMode('files');
      setQuery(value.slice(1));
    } else {
      setQuery(value);
    }
  }, []);

  if (!open || settingsOpen) return null;

  return (
    <div className="command-palette-overlay" onClick={close} role="presentation">
      <div
        className="command-palette"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <div className="command-palette-input-row">
          <FiCommand size={13} className="command-palette-icon" />
          <input
            ref={inputRef}
            className="command-palette-input"
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={mode === 'files' ? 'Go to file…' : 'Type a command… (@ for files)'}
            aria-label={mode === 'files' ? 'Go to file' : 'Type a command'}
          />
          <span className="command-palette-mode">{mode === 'files' ? 'Files' : 'Commands'}</span>
        </div>

        <div className="command-palette-list" ref={listRef} role="listbox">
          {results.length === 0 && (
            <div className="command-palette-empty">
              No matching {mode === 'files' ? 'files' : 'commands'}
            </div>
          )}
          {results.map((item, i) => {
            const Icon = item.icon || FiCode;
            return (
              <button
                key={item.id}
                className={`command-palette-item${i === selected ? ' selected' : ''}`}
                onMouseEnter={() => setSelected(i)}
                onClick={() => runItem(item)}
                role="option"
                aria-selected={i === selected}
              >
                <Icon size={12} className="command-palette-item-icon" />
                <span className="command-palette-item-label">{item.label}</span>
                {item.hint && <span className="command-palette-item-hint">{item.hint}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});

CommandPalette.displayName = 'CommandPalette';

export default CommandPalette;
