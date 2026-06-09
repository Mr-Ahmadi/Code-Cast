import { useRef, useContext, useEffect, useCallback, useState } from 'react';
import Editor from '../elements/Editor';
import Output from '../elements/Output';
import Top from '../elements/TopBar';
import TitleBar from '../elements/TitleBar';
import MenuBar from '../elements/MenuBar';
import Toast from '../elements/Toast';
import FileTabs from '../elements/FileTabs';
import FileTree from '../elements/FileTree';
import ShortcutsHelp from '../elements/ShortcutsHelp';
import TerminalPanel from '../elements/Terminal';
import LocalSetupPrompt from '../elements/LocalSetupPrompt';
import ActivityBar from '../elements/ActivityBar';
import StatusBar from '../elements/StatusBar';
import { GlobalContext } from '../../contexts/GlobalStates';
import { addFile as recordAddFile, getFiles } from "../../functions/record";
import { useMode, MODES } from '../../contexts/ModeContext';
import { exportRecord, isTypistLoaded } from "../../functions/record";

const TEXT_EXTS = new Set([
    'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',
    'html', 'htm',
    'css', 'scss', 'less', 'sass',
    'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift', 'c', 'cpp', 'h', 'hpp',
    'json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'cfg',
    'md', 'txt', 'sh', 'bash', 'zsh', 'fish',
    'sql', 'graphql', 'r', 'lua', 'php', 'pl', 'pm',
    'env', 'gitignore', 'dockerfile', 'makefile',
]);

function extLang(name) {
    const ext = name.split('.').pop().toLowerCase();
    const map = {
        html: 'html', htm: 'html',
        css: 'css',
        js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
        ts: 'typescript', tsx: 'typescript',
        py: 'python',
        json: 'json',
        md: 'markdown',
        xml: 'xml', svg: 'xml',
        sql: 'sql',
        sh: 'shell', bash: 'shell', zsh: 'shell',
    };
    return map[ext] || 'plaintext';
}

export default function App() {
    const editorRef = useRef(null);
    const {
        output, recording, currentWorkspace, currentRecord, playing,
        showMinimap, setShowMinimap, setSidebarOpen,
        setActiveFile, setFiles, setOutput, sidebarOpen,
        fontSize, setFontSize,
        theme, setTheme,
        autoSave, setAutoSave,
    } = useContext(GlobalContext);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [terminalVisible, setTerminalVisible] = useState(false);
    const [showSetup, setShowSetup] = useState(false);
    const isMacElectron = !!window.electronAPI?.isElectron && window.electronAPI?.platform === 'darwin';
    const [activePanel, setActivePanel] = useState('output');
    const [terminals, setTerminals] = useState([{ id: "terminal-1", name: "Terminal 1" }]);
    const [activeTerminalId, setActiveTerminalId] = useState("terminal-1");
    const { mode } = useMode();
    const isLocal = mode === MODES.LOCAL;

    const [sidebarWidth, setSidebarWidth] = useState(250);
    const [panelHeight, setPanelHeight] = useState(200);
    const [isResizingSidebar, setIsResizingSidebar] = useState(false);
    const [isResizingPanel, setIsResizingPanel] = useState(false);

    const startResizingSidebar = useCallback((e) => {
        e.preventDefault();
        setIsResizingSidebar(true);
    }, []);

    const startResizingPanel = useCallback((e) => {
        e.preventDefault();
        setIsResizingPanel(true);
    }, []);

    const stopResizing = useCallback(() => {
        setIsResizingSidebar(false);
        setIsResizingPanel(false);
    }, []);

    const resize = useCallback((e) => {
        if (isResizingSidebar) {
            const newWidth = e.clientX - 48; // ActivityBar width
            if (newWidth > 150 && newWidth < 600) {
                setSidebarWidth(newWidth);
            }
        } else if (isResizingPanel) {
            const newHeight = window.innerHeight - e.clientY - 22; // StatusBar height
            if (newHeight > 100 && newHeight < window.innerHeight * 0.7) {
                setPanelHeight(newHeight);
            }
        }
    }, [isResizingSidebar, isResizingPanel]);

    useEffect(() => {
        if (isResizingSidebar || isResizingPanel) {
            window.addEventListener('mousemove', resize);
            window.addEventListener('mouseup', stopResizing);
        } else {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        }
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [isResizingSidebar, isResizingPanel, resize, stopResizing]);

    useEffect(() => {
        if (isLocal && window.electronAPI?.isElectron) {
            const seen = localStorage.getItem('codecast_welcome_seen');
            if (!seen) {
                setShowSetup(true);
                localStorage.setItem('codecast_welcome_seen', '1');
            }
        }
    }, [isLocal]);

    const handleSetupComplete = () => {
        setShowSetup(false);
    };

    window.__setTerminalVisible = (updater) => {
        if (typeof updater === "function") {
            setTerminalVisible((prev) => updater(prev));
            return;
        }
        setTerminalVisible(!!updater);
    };
    window.__createTerminal = () => {
        setTerminals(prev => {
            const nextIndex = prev.length + 1;
            const nextId = `terminal-${Date.now()}-${nextIndex}`;
            const next = [...prev, { id: nextId, name: `Terminal ${nextIndex}` }];
            setActiveTerminalId(nextId);
            return next;
        });
        setTerminalVisible(true);
        setActivePanel('terminal');
    };
    window.__toggleExplorer = () => setSidebarOpen(prev => !prev);
    window.__toggleMinimap = () => setShowMinimap(prev => !prev);

    const handleClearOutput = useCallback(() => {
        setOutput(null);
    }, [setOutput]);

    useEffect(() => {
        if (recording) {
            const handler = (e) => {
                e.preventDefault();
                e.returnValue = '';
            };
            window.addEventListener('beforeunload', handler);
            return () => window.removeEventListener('beforeunload', handler);
        }
    }, [recording]);

    useEffect(() => {
        const syncFiles = () => {
            const files = getFiles();
            setFiles(files);
            if (!files.length) return;
            const preferred = window.__activeFile;
            if (!preferred || !files.some(f => f.name === preferred)) {
                setActiveFile(files[0].name);
            }
        };
        syncFiles();
        const interval = setInterval(syncFiles, 500);
        return () => clearInterval(interval);
    }, [setFiles, setActiveFile]);

    useEffect(() => {
        if (!isLocal || !window.electronAPI?.isElectron || !currentWorkspace?.path || currentRecord || playing) {
            return;
        }

        const f = window.electronAPI?.file;
        if (!f) return;

        let disposed = false;
        let syncing = false;

        const syncDirectoryFiles = async () => {
            if (syncing || disposed) return;
            syncing = true;
            try {
                const absoluteFiles = await f.listRecursive(currentWorkspace.path);
                if (disposed) return;

                const openFiles = getFiles();
                const opened = new Set(openFiles.map(file => file.name));
                let changed = false;

                for (const absolutePath of absoluteFiles) {
                    const relativePath = absolutePath.startsWith(`${currentWorkspace.path}/`)
                        ? absolutePath.slice(currentWorkspace.path.length + 1)
                        : absolutePath;
                    if (!relativePath) continue;

                    const ext = relativePath.split('.').pop().toLowerCase();
                    if (!TEXT_EXTS.has(ext)) continue;
                    if (opened.has(relativePath)) continue;

                    const content = await f.read(absolutePath);
                    if (disposed) return;
                    if (content === null || content === undefined) continue;

                    recordAddFile(relativePath, extLang(relativePath), content);
                    opened.add(relativePath);
                    changed = true;
                }

                if (changed) {
                    const nextFiles = getFiles();
                    setFiles(nextFiles);
                    if (!nextFiles.some(file => file.name === window.__activeFile) && nextFiles.length > 0) {
                        setActiveFile(nextFiles[0].name);
                    }
                }
            } catch {
                // best-effort sync; ignore transient FS errors
            } finally {
                syncing = false;
            }
        };

        syncDirectoryFiles();
        const interval = setInterval(syncDirectoryFiles, 2500);
        return () => {
            disposed = true;
            clearInterval(interval);
        };
    }, [isLocal, currentWorkspace?.path, currentRecord, playing, setFiles, setActiveFile]);

    const handleKeyDown = useCallback((e) => {
        const cmd = e.ctrlKey || e.metaKey;

        if (e.key === '?' && !cmd) {
            e.preventDefault();
            setShowShortcuts(s => !s);
            return;
        }

        if (e.key === '`' && cmd) {
            e.preventDefault();
            setTerminalVisible(v => !v);
            return;
        }

        if (e.key === 'k' && cmd && e.shiftKey) {
            e.preventDefault();
            setTerminalVisible(v => !v);
            return;
        }

        if (cmd && e.key === 's') {
            e.preventDefault();
            if (e.shiftKey) {
                window.__saveCurrentFileAs?.();
            } else {
                window.__saveCurrentFile?.();
            }
        }
        if (cmd && e.key === 'Enter') {
            e.preventDefault();
            document.querySelector('[data-shortcut="execute"]')?.click();
        }
        if (cmd && e.key === 'r') {
            e.preventDefault();
            document.querySelector('[data-shortcut="record"]')?.click();
        }
        if (cmd && e.key === 'p') {
            e.preventDefault();
            document.querySelector('[data-shortcut="play"]')?.click();
        }
        if (cmd && e.key === 'o') {
            e.preventDefault();
            document.querySelector('[data-shortcut="open"]')?.click();
        }
    }, []);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    const hasBottomContent = output || terminalVisible;
    const explorerContext = currentRecord
        ? "Record Snapshot"
        : currentWorkspace?.name || "No Project";
    const explorerMode = currentRecord ? "RECORDED FILES" : "WORKSPACE FILES";
    const activeTerminal = terminals.find(t => t.id === activeTerminalId) || terminals[0];

    const handleToggleTerminal = useCallback(() => {
        setTerminalVisible(v => !v);
        setActivePanel('terminal');
    }, []);

    const handleNewTerminal = useCallback(() => {
        window.__createTerminal?.();
    }, []);

    const handleCloseActiveTerminal = useCallback(() => {
        if (!activeTerminal) return;
        setTerminals(prev => {
            if (prev.length <= 1) {
                setTerminalVisible(false);
                return prev;
            }
            const filtered = prev.filter(t => t.id !== activeTerminal.id);
            if (!filtered.some(t => t.id === activeTerminalId)) {
                setActiveTerminalId(filtered[0].id);
            }
            return filtered;
        });
    }, [activeTerminal, activeTerminalId]);

    const handleCloseTerminalTab = (id) => {
        setTerminals(prev => {
            if (prev.length <= 1) {
                setTerminalVisible(false);
                return prev;
            }
            const filtered = prev.filter(t => t.id !== id);
            if (activeTerminalId === id && filtered.length > 0) {
                setActiveTerminalId(filtered[0].id);
            }
            return filtered;
        });
    };

    const runEditorCommand = useCallback((id) => {
        window.__focusEditor?.();
        window.__runEditorAction?.(id);
    }, []);

    useEffect(() => {
        if (!window.electronAPI?.appMenu?.onAction) {
            return undefined;
        }

        const unsubscribe = window.electronAPI.appMenu.onAction((action) => {

            switch (action) {
                case 'new-file':
                    window.__createNewFile?.();
                    break;
                case 'open-project':
                    window.__openProjectDialog?.();
                    break;
                case 'save-file':
                    window.__saveCurrentFile?.();
                    break;
                case 'save-file-as':
                    window.__saveCurrentFileAs?.();
                    break;
                case 'save-all-files':
                    window.__saveAllFiles?.();
                    break;
                case 'toggle-auto-save':
                    setAutoSave((prev) => !prev);
                    break;
                case 'toggle-theme':
                    setTheme(theme === 'light' ? 'dark' : 'light');
                    break;
                case 'undo':
                    runEditorCommand('undo');
                    break;
                case 'redo':
                    runEditorCommand('redo');
                    break;
                case 'cut':
                    runEditorCommand('editor.action.clipboardCutAction');
                    break;
                case 'copy':
                    runEditorCommand('editor.action.clipboardCopyAction');
                    break;
                case 'paste':
                    runEditorCommand('editor.action.clipboardPasteAction');
                    break;
                case 'find':
                    runEditorCommand('actions.find');
                    break;
                case 'replace':
                    runEditorCommand('editor.action.startFindReplaceAction');
                    break;
                case 'select-all':
                    runEditorCommand('editor.action.selectAll');
                    break;
                case 'expand-selection':
                    runEditorCommand('editor.action.smartSelect.expand');
                    break;
                case 'shrink-selection':
                    runEditorCommand('editor.action.smartSelect.shrink');
                    break;
                case 'add-cursor-above':
                    runEditorCommand('editor.action.insertCursorAbove');
                    break;
                case 'add-cursor-below':
                    runEditorCommand('editor.action.insertCursorBelow');
                    break;
                case 'import-recording':
                    document.querySelector('input[type="file"][accept=".cvid"]')?.click();
                    break;
                case 'export-recording':
                    if (isTypistLoaded() && !recording) {
                        exportRecord();
                    }
                    break;
                case 'run-code':
                    document.querySelector('[data-shortcut="execute"]')?.click();
                    break;
                case 'toggle-recording':
                    document.querySelector('[data-shortcut="record"]')?.click();
                    break;
                case 'toggle-playback':
                    document.querySelector('[data-shortcut="play"]')?.click();
                    break;
                case 'toggle-explorer':
                    window.__toggleExplorer?.();
                    break;
                case 'toggle-terminal':
                    handleToggleTerminal();
                    break;
                case 'toggle-minimap':
                    window.__toggleMinimap?.();
                    break;
                case 'increase-font-size':
                    setFontSize(Math.min(28, fontSize + 2));
                    break;
                case 'decrease-font-size':
                    setFontSize(Math.max(10, fontSize - 2));
                    break;
                case 'reset-font-size':
                    setFontSize(14);
                    break;
                case 'go-to-line':
                    runEditorCommand('editor.action.gotoLine');
                    break;
                case 'go-to-symbol':
                    runEditorCommand('editor.action.quickOutline');
                    break;
                case 'go-to-bracket':
                    runEditorCommand('editor.action.jumpToBracket');
                    break;
                case 'new-terminal':
                    handleNewTerminal();
                    break;
                case 'close-terminal':
                    handleCloseActiveTerminal();
                    break;
                case 'show-shortcuts':
                    setShowShortcuts(true);
                    break;
                default:
                    break;
            }
        });

        return unsubscribe;
    }, [recording, theme, setTheme, setAutoSave, fontSize, setFontSize, runEditorCommand, handleToggleTerminal, handleNewTerminal, handleCloseActiveTerminal]);

    return (
        <div className='main-container'>
            <TitleBar />
            {showSetup && (
                <div className="modal-container" onClick={(e) => { if (e.target === e.currentTarget) return; }}>
                    <LocalSetupPrompt onComplete={handleSetupComplete} />
                </div>
            )}
            {!isMacElectron && (
                <MenuBar
                    recording={recording}
                    playing={playing}
                    canExport={isTypistLoaded() && !recording}
                    hasWorkspace={!!currentWorkspace}
                    showMinimap={showMinimap}
                    autoSave={autoSave}
                    setAutoSave={setAutoSave}
                    theme={theme}
                    onToggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                    onNewFile={() => window.__createNewFile?.()}
                    onOpenProject={() => window.__openProjectDialog?.()}
                    onSave={() => window.__saveCurrentFile?.()}
                    onSaveAs={() => window.__saveCurrentFileAs?.()}
                    onSaveAll={() => window.__saveAllFiles?.()}
                    onUndo={() => runEditorCommand('undo')}
                    onRedo={() => runEditorCommand('redo')}
                    onCut={() => runEditorCommand('editor.action.clipboardCutAction')}
                    onCopy={() => runEditorCommand('editor.action.clipboardCopyAction')}
                    onPaste={() => runEditorCommand('editor.action.clipboardPasteAction')}
                    onFind={() => runEditorCommand('actions.find')}
                    onReplace={() => runEditorCommand('editor.action.startFindReplaceAction')}
                    onSelectAll={() => runEditorCommand('editor.action.selectAll')}
                    onExpandSelection={() => runEditorCommand('editor.action.smartSelect.expand')}
                    onShrinkSelection={() => runEditorCommand('editor.action.smartSelect.shrink')}
                    onAddCursorAbove={() => runEditorCommand('editor.action.insertCursorAbove')}
                    onAddCursorBelow={() => runEditorCommand('editor.action.insertCursorBelow')}
                    onImport={() => document.querySelector('input[type="file"][accept=".cvid"]')?.click()}
                    onExport={exportRecord}
                    onGoToLine={() => runEditorCommand('editor.action.gotoLine')}
                    onGoToSymbol={() => runEditorCommand('editor.action.quickOutline')}
                    onGoToBracket={() => runEditorCommand('editor.action.jumpToBracket')}
                    onIncreaseFontSize={() => setFontSize(Math.min(28, fontSize + 2))}
                    onDecreaseFontSize={() => setFontSize(Math.max(10, fontSize - 2))}
                    onResetFontSize={() => setFontSize(14)}
                    onRun={() => document.querySelector('[data-shortcut="execute"]')?.click()}
                    onRecord={() => document.querySelector('[data-shortcut="record"]')?.click()}
                    onPlay={() => document.querySelector('[data-shortcut="play"]')?.click()}
                    onToggleExplorer={() => window.__toggleExplorer?.()}
                    onToggleTerminal={handleToggleTerminal}
                    onToggleMinimap={() => window.__toggleMinimap?.()}
                    onNewTerminal={handleNewTerminal}
                    onCloseTerminal={handleCloseActiveTerminal}
                    onShowShortcuts={() => setShowShortcuts(true)}
                />
            )}
            <Top editorRef={editorRef} />
            <div className="main-body">
                <ActivityBar />
                <div 
                    className={"sidebar" + (sidebarOpen ? "" : " closed") + (isResizingSidebar ? " resizing" : "")}
                    style={{ width: sidebarOpen ? sidebarWidth : 0 }}
                >
                    <div className="sidebar-header">
                        <div className="sidebar-title-row">
                            <span className="sidebar-title">Explorer</span>
                            <span className="sidebar-mode-badge">{explorerMode}</span>
                        </div>
                        <span className="sidebar-context" title={explorerContext}>{explorerContext}</span>
                    </div>
                    <div className="sidebar-section-title">Files</div>
                    <div className="sidebar-content">
                        <FileTree />
                    </div>
                </div>
                {sidebarOpen && (
                    <div className="resizer resizer-h" onMouseDown={startResizingSidebar} />
                )}
                <div className="main-content">
                    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                        <FileTabs />
                        <Editor editorRef={editorRef} />
                    </div>
                    {hasBottomContent && (
                        <>
                            <div className="resizer resizer-v" onMouseDown={startResizingPanel} />
                            <div className={"main-bottom-panels" + (isResizingPanel ? " resizing" : "")} style={{ height: panelHeight }}>
                                <div className="panel-tabs">
                                    <button
                                        className={"panel-tab" + (activePanel === 'output' ? ' active' : '')}
                                        onClick={() => setActivePanel('output')}
                                    >
                                        OUTPUT
                                    </button>
                                    <button
                                        className={"panel-tab" + (activePanel === 'terminal' ? ' active' : '')}
                                        onClick={() => setActivePanel('terminal')}
                                    >
                                        TERMINAL
                                    </button>
                                    {terminalVisible && (
                                        <div className="terminal-tabs-list">
                                            {terminals.map((terminal) => (
                                                <button
                                                    key={terminal.id}
                                                    className={"terminal-tab" + (terminal.id === activeTerminalId ? " active" : "")}
                                                    onClick={() => {
                                                        setActiveTerminalId(terminal.id);
                                                        setActivePanel('terminal');
                                                    }}
                                                    title={terminal.name}
                                                >
                                                    <span>{terminal.name}</span>
                                                    <span
                                                        className="terminal-tab-close"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleCloseTerminalTab(terminal.id);
                                                        }}
                                                    >
                                                        ×
                                                    </span>
                                                </button>
                                            ))}
                                            <button className="terminal-tab-add" onClick={handleNewTerminal} title="New terminal">+</button>
                                        </div>
                                    )}
                                    <div className="panel-tab-actions">
                                        <button
                                            className="panel-action-btn"
                                            onClick={() => { setTerminalVisible(false); setOutput(null); setActivePanel('output'); }}
                                            title="Close panel"
                                            aria-label="Close panel"
                                        >
                                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M2 2l8 8M10 2l-8 8" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                                <div className="panel-body" style={{ display: activePanel === 'output' ? 'flex' : 'none' }}>
                                    <Output value={output} onClear={handleClearOutput} />
                                </div>
                                <div className="panel-body" style={{ display: activePanel === 'terminal' ? 'flex' : 'none' }}>
                                    <div className="terminal-stack">
                                        {terminals.map((terminal) => (
                                            <TerminalPanel
                                                key={terminal.id}
                                                visible={activePanel === 'terminal' && terminalVisible && terminal.id === activeTerminalId}
                                                terminalId={terminal.id}
                                                onClose={() => setTerminalVisible(false)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
            <StatusBar />
            <Toast />
            <ShortcutsHelp display={showShortcuts} setDisplay={setShowShortcuts} />
        </div>
    );
}
