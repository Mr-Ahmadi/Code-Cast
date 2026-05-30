import { useRef, useContext, useEffect, useCallback, useState } from 'react';
import Editor from '../elements/Editor';
import Output from '../elements/Output';
import Top from '../elements/TopBar';
import Toast from '../elements/Toast';
import ShortcutsHelp from '../elements/ShortcutsHelp';
import { GlobalContext } from '../../contexts/GlobalStates';

export default function App() {
    const editorRef = useRef(null);
    const { output, recording, setOutput } = useContext(GlobalContext);
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
            <Editor editorRef={editorRef} />
            <Output value={output} onClear={handleClearOutput} />
            <Toast />
            <ShortcutsHelp display={showShortcuts} setDisplay={setShowShortcuts} />
        </div>
    );
}