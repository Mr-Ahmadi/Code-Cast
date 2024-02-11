import { useRef } from 'react';
import Editor from '../elements/Editor';
import Output from '../elements/Output';
import Top from '../elements/TopBar';

export default function App() {
    const editorRef = useRef(null);

    return (
        <div className='main-container'>
            <Top editorRef={editorRef} />
            <Editor editorRef={editorRef} />
            <Output value={" > Hello world!"} />
        </div>
    );
}