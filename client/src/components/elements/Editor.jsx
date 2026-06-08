import { useRef, useContext, useEffect, useCallback, memo } from 'react';
import { GlobalContext } from '../../contexts/GlobalStates';
import Editor from '@monaco-editor/react';
import {
  push, setEditor, getFiles, getActiveFile, getFileFirstValue,
} from '../../functions/record';
import { FiFolder } from 'react-icons/fi';
import PropTypes from 'prop-types';

const _Editor = memo(({ editorRef }) => {
  const { 
    recording, fontSize, showMinimap, files, activeFile, 
    setActiveFile, currentWorkspace, autoSave, setToast 
  } = useContext(GlobalContext);

  const oldValue = useRef("");
  const monacoRef = useRef(null);
  const modelsRef = useRef({});
  const editorReady = useRef(false);
  const recordingRef = useRef(recording);
  const activeFileRef = useRef(activeFile);
  const autoSaveTimerRef = useRef(null);

  recordingRef.current = recording;
  activeFileRef.current = activeFile;

  const saveCurrentFile = useCallback(async () => {
    if (!activeFile || !currentWorkspace?.path || !window.electronAPI) return;
    
    const content = editorRef.current?.getValue();
    if (content === undefined) return;

    const fullPath = window.electronAPI.path.join(currentWorkspace.path, activeFile);
    const success = await window.electronAPI.file.write(fullPath, content);
    
    if (success) {
      console.log(`[Editor] Saved ${activeFile}`);
    } else {
      setToast({ type: 'ERROR', message: `Failed to save ${activeFile}` });
    }
  }, [activeFile, currentWorkspace, editorRef, setToast]);

  window.__saveCurrentFile = saveCurrentFile;

  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
  }, [activeFile]);

  const handleEditorChange = useCallback(() => {
    const currentValue = editorRef.current.getValue();
    
    if (recordingRef.current) {
      push(oldValue.current, currentValue);
    }
    oldValue.current = currentValue;

    if (autoSave && !recordingRef.current) {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(() => {
        saveCurrentFile();
      }, 1000);
    }
  }, [autoSave, editorRef, saveCurrentFile]);

  const langForExt = useCallback((name) => {
    const ext = name.split(".").pop().toLowerCase();
    const map = {
      html: "html", htm: "html",
      css: "css",
      js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
      ts: "typescript", tsx: "typescript",
      py: "python",
      json: "json",
      md: "markdown",
      xml: "xml", svg: "xml",
      sql: "sql",
      sh: "shell", bash: "shell",
      txt: "plaintext",
    };
    return map[ext] || "plaintext";
  }, []);

  const createModel = useCallback((monaco, name, content, language) => {
    if (modelsRef.current[name]) return modelsRef.current[name];
    const uri = monaco.Uri.parse(`file:///${name}`);
    const lang = language || langForExt(name);
    const model = monaco.editor.createModel(content || "", lang, uri);
    modelsRef.current[name] = model;
    return model;
  }, [langForExt]);

  const switchEditorModel = useCallback((name) => {
    const ed = editorRef.current;
    if (!ed || !modelsRef.current[name]) return;
    ed.setModel(modelsRef.current[name]);
    oldValue.current = ed.getValue();
  }, [editorRef]);

  function handleEditorDidMount(editor, monaco) {
    editorRef.current = editor;
    setEditor(editorRef);
    monacoRef.current = monaco;
    editorReady.current = true;

    // Define custom theme
    const styles = getComputedStyle(document.documentElement);
    const bg = styles.getPropertyValue('--bg-primary').trim() || '#1e1e1e';
    const fg = styles.getPropertyValue('--text-primary').trim() || '#cccccc';
    const border = styles.getPropertyValue('--border').trim() || '#3c3c3c';
    const selection = styles.getPropertyValue('--accent-glow').trim() || 'rgba(249, 109, 0, 0.25)';

    monaco.editor.defineTheme('codecast-theme', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': bg,
        'editor.foreground': fg,
        'editor.lineHighlightBackground': '#2a2d2e',
        'editorCursor.foreground': styles.getPropertyValue('--accent').trim() || '#f96d00',
        'editor.selectionBackground': selection,
        'editor.inactiveSelectionBackground': selection,
        'editorLineNumber.foreground': '#858585',
        'editorLineNumber.activeForeground': '#c6c6c6',
        'editor.border': border,
      }
    });
    monaco.editor.setTheme('codecast-theme');

    const fileList = getFiles();
    for (const f of fileList) {
      if (f.name && !modelsRef.current[f.name]) {
        createModel(monaco, f.name, getFileFirstValue(f.name) || "", f.language);
      }
    }

    const active = getActiveFile() || (fileList.length > 0 ? fileList[0].name : null);
    if (active && modelsRef.current[active]) {
      editor.setModel(modelsRef.current[active]);
    } else if (fileList.length > 0 && !active) {
      const first = fileList[0].name;
      if (modelsRef.current[first]) {
        editor.setModel(modelsRef.current[first]);
      }
    }

    if (!getActiveFile() && fileList.length > 0) {
      setActiveFile(fileList[0].name);
    }
  }

  const ensureModel = useCallback((name, content, language) => {
    const monaco = monacoRef.current;
    if (!monaco) return;
    if (modelsRef.current[name]) {
      const model = modelsRef.current[name];
      if (content !== undefined && model.getValue() !== content) {
        model.setValue(content);
      }
      return model;
    }
    return createModel(monaco, name, content, language);
  }, [createModel]);

  window.__ensureModel = ensureModel;
  window.__switchEditorModel = switchEditorModel;
  window.__getAllModelContents = () => {
    const trackedFiles = getFiles();
    const result = {};
    for (const file of trackedFiles) {
      const model = modelsRef.current[file.name];
      result[file.name] = model ? model.getValue() : (getFileFirstValue(file.name) || "");
    }
    return result;
  };

  const resumeFlashRef = useRef(null);

  window.__playbackHandler = useCallback((name, content, isSwitch, isResume) => {
    ensureModel(name, content);
    switchEditorModel(name);
    if (isSwitch) {
      setActiveFile(name);
    }
    if (isResume && resumeFlashRef.current) {
      resumeFlashRef.current.classList.remove('resume-flash');
      void resumeFlashRef.current.offsetWidth;
      resumeFlashRef.current.classList.add('resume-flash');
      setTimeout(() => {
        resumeFlashRef.current?.classList.remove('resume-flash');
      }, 1500);
    }
  }, [ensureModel, switchEditorModel, setActiveFile]);

  useEffect(() => {
    if (!editorReady.current || !activeFile) return;
    const content = modelsRef.current[activeFile] ? undefined : (getFileFirstValue(activeFile) || "");
    ensureModel(activeFile, content, undefined);
    if (modelsRef.current[activeFile]) {
      switchEditorModel(activeFile);
    }
  }, [activeFile, switchEditorModel, ensureModel]);

  useEffect(() => {
    const fileList = getFiles();
    const monaco = monacoRef.current;
    if (!monaco) return;

    for (const f of fileList) {
      if (f.name && !modelsRef.current[f.name]) {
        createModel(monaco, f.name, getFileFirstValue(f.name) || "", f.language);
      }
    }
  }, [files, createModel]);

  const noProject = !currentWorkspace;

  const options = {
    fontSize,
    minimap: { enabled: showMinimap },
    scrollBeyondLastLine: noProject,
    lineNumbers: noProject ? "off" : "on",
    renderLineHighlight: noProject ? "line" : "line",
    automaticLayout: true,
    smoothScrolling: true,
    cursorBlinking: noProject ? "solid" : "smooth",
    cursorSmoothCaretAnimation: noProject ? "off" : "on",
    padding: { top: 12 },
    readOnly: noProject,
    domReadOnly: noProject,
  };

  return (
    <div className='editor-container' ref={resumeFlashRef} role="region" aria-label="Code editor">
      {noProject && (
          <div className="editor-no-project">
            <div className="editor-no-project-content">
              <FiFolder size={48} />
              <h3>No Project Open</h3>
              <p>Open a folder, create a project, or open an existing one to start coding.</p>
              <button className="btn btn-primary" onClick={() => window.__openProjectDialog?.()}>
                <FiFolder size={14} /> Open Project
              </button>
            </div>
          </div>
      )}
      <div className="editor-monaco-wrapper">
        <Editor
          height="100%"
          width="100%"
          onMount={handleEditorDidMount}
          onChange={handleEditorChange}
          theme='codecast-theme'
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
