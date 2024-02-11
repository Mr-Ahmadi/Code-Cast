import { useRef, useContext } from 'react';
import { GlobalContext } from '../../contexts/GlobalStates';
import Editor from '@monaco-editor/react';
import { push, setEditor } from '../../functions/record';
import PropTypes from 'prop-types';

const _Editor = ({ editorRef }) => {
    const { recording, language } = useContext(GlobalContext);

    // const editorRef = useRef(null);
    const oldValue = useRef("");

    function handleEditorDidMount(editor) {
        editorRef.current = editor;
        setEditor(editorRef)
    }

    return (
        <div className='editor-container'>
            <Editor
                height="100%"
                width="100%"
                language={language[0]}
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

_Editor.propTypes = {
    editorRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.any })
    ])
}

export default _Editor