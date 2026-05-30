import { useRef, useContext, memo } from 'react';
import { GlobalContext } from '../../contexts/GlobalStates';
import Editor from '@monaco-editor/react';
import { push, setEditor } from '../../functions/record';
import PropTypes from 'prop-types';

const _Editor = memo(({ editorRef }) => {
    const { recording, language, fontSize, showMinimap } = useContext(GlobalContext);

    const oldValue = useRef("");

    function handleEditorDidMount(editor) {
        editorRef.current = editor;
        setEditor(editorRef)
    }

    const options = {
        fontSize,
        minimap: { enabled: showMinimap },
        scrollBeyondLastLine: false,
        lineNumbers: "on",
        renderLineHighlight: "line",
        automaticLayout: true,
        smoothScrolling: true,
        cursorBlinking: "smooth",
        cursorSmoothCaretAnimation: "on",
        padding: { top: 12 },
    };

    return (
        <div className='editor-container' role="region" aria-label="Code editor">
            <div className="editor-monaco-wrapper">
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
                    options={options}
                />
            </div>
        </div>
    )
});

_Editor.displayName = 'Editor';

_Editor.propTypes = {
    editorRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.any })
    ])
}

export default _Editor