import { useRef, useContext, useEffect, useCallback, useState } from 'react';
import Editor from '../elements/Editor';
import Output from '../elements/Output';
import Top from '../elements/TopBar';
import Toast from '../elements/Toast';
import FileTabs from '../elements/FileTabs';
import FileTree from '../elements/FileTree';
import ShortcutsHelp from '../elements/ShortcutsHelp';
import { GlobalContext } from '../../contexts/GlobalStates';
import { getFiles } from "../../functions/record";

export default function App() {
    const editorRef = useRef(null);
    const { output, recording, setOutput, setActiveFile, setFiles } = useContext(GlobalContext);
    const [showShortcuts, setShowShortcuts] = useState(false);

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

    return (
        <div className='main-container'>
            <Top editorRef={editorRef} />
            <div className="main-body">
                <FileTree />
                <div className="main-content">
                    <Editor editorRef={editorRef} />
                    <FileTabs />
                    <Output value={output} onClear={handleClearOutput} />
                </div>
            </div>
            <Toast />
            <ShortcutsHelp display={showShortcuts} setDisplay={setShowShortcuts} />
        </div>
    );
}
