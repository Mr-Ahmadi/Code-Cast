import { useRef, useContext } from 'react';
import { GlobalContext } from '../../contexts/GlobalStates';
import Editor from '@monaco-editor/react';
import { push, setEditor } from '../../functions/record';

const _Editor = () => {
    const { recording } = useContext(GlobalContext);

    const editorRef = useRef(null);
    const oldValue = useRef("")

    function handleEditorDidMount(editor) {
        editorRef.current = editor;
        setEditor(editorRef)
    }

    return (
        <div className='editor-container'>
            <Editor
                height="100%"
                width="100%"
                defaultLanguage="javascript"
                // defaultValue="// some comment"
                onMount={handleEditorDidMount}
                onChange={() => {
                    if (recording) {
                        push(oldValue.current, editorRef.current.getValue())
                    }
                    oldValue.current = editorRef.current.getValue();
                }}
                theme='vs-dark'
            />
        </div>
    )
}

export default _Editor