import { useRef, useContext, useEffect, useCallback, useState } from 'react';
import Editor from '../elements/Editor';
import Output from '../elements/Output';
import Top from '../elements/TopBar';
import Toast from '../elements/Toast';
import FileTabs from '../elements/FileTabs';
import FileTree from '../elements/FileTree';
import ShortcutsHelp from '../elements/ShortcutsHelp';
import TerminalPanel from '../elements/Terminal';
import LocalSetupPrompt from '../elements/LocalSetupPrompt';
import ActivityBar from '../elements/ActivityBar';
import StatusBar from '../elements/StatusBar';
import { GlobalContext } from '../../contexts/GlobalStates';
import { getFiles } from "../../functions/record";
import { useMode, MODES } from '../../contexts/ModeContext';
import { isConfigured } from '../../stores/localFsStore';

export default function App() {
    const editorRef = useRef(null);
    const { output, recording, setActiveFile, setFiles, setOutput, sidebarOpen } = useContext(GlobalContext);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [terminalVisible, setTerminalVisible] = useState(false);
    const [showSetup, setShowSetup] = useState(false);
    const [activePanel, setActivePanel] = useState('output');
    const { mode } = useMode();
    const isLocal = mode === MODES.LOCAL;

    useEffect(() => {
        if (isLocal && window.electronAPI?.isElectron && !isConfigured()) {
            setShowSetup(true);
        }
    }, [isLocal]);

    const handleSetupComplete = () => {
        setShowSetup(false);
    };

    window.__setTerminalVisible = setTerminalVisible;

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
            const active = getFiles().find(f => f.name === (window.__activeFile || files[0].name));
            if (!active) setActiveFile(files[0].name);
        };
        syncFiles();
        const interval = setInterval(syncFiles, 500);
        return () => clearInterval(interval);
    }, [setFiles, setActiveFile]);

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

    return (
        <div className='main-container'>
            {showSetup && (
                <div className="modal-container" onClick={(e) => { if (e.target === e.currentTarget) return; }}>
                    <LocalSetupPrompt onComplete={handleSetupComplete} />
                </div>
            )}
            <Top editorRef={editorRef} />
            <div className="main-body">
                <ActivityBar />
                <div className={"sidebar" + (sidebarOpen ? "" : " closed")}>
                    <div className="sidebar-header">
                        <span className="sidebar-title">Explorer</span>
                    </div>
                    <div className="sidebar-content">
                        <FileTree />
                    </div>
                </div>
                <div className="main-content">
                    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                        <FileTabs />
                        <Editor editorRef={editorRef} />
                    </div>
                    {hasBottomContent && (
                        <div className="main-bottom-panels">
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
                                <div className="panel-tab-actions">
                                    <button
                                        className="panel-action-btn"
                                        onClick={() => { setTerminalVisible(false); setOutput(null); }}
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
                                <TerminalPanel
                                    visible={terminalVisible}
                                    onClose={() => setTerminalVisible(false)}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <StatusBar />
            <Toast />
            <ShortcutsHelp display={showShortcuts} setDisplay={setShowShortcuts} />
        </div>
    );
}
