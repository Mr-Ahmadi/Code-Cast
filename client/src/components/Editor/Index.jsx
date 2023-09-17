import { useRef, useContext } from 'react';
import { GlobalContext } from '../../contexts/GlobalStates';
import Editor from '@monaco-editor/react';
import { push, setEditor } from '../../functions/record';
// import changes from '../../classes/Typist';
// import dataHandler from '../../functions/dataHandler';

const _Editor = () => {
    const { recording } = useContext(GlobalContext);

    const editorRef = useRef(null);
    const oldValue = useRef("")

    // const currentChanges = new changes(Date.now(), 100);
    // console.log(currentChanges instanceof changes)

    // const dataWorker = new Worker("src/functions/dataHandler.js");
    // dataWorker.onmessage


    function handleEditorDidMount(editor) {
        editorRef.current = editor;
        setEditor(editorRef)
    }

    return (
        <Editor
            height="93vh"
            width="90vw"
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
    )
}

export default _Editor