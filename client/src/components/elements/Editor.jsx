import { useRef, useContext, useEffect, useCallback, useState, memo } from 'react';
import { GlobalContext } from '../../contexts/GlobalStates';
import Editor from '@monaco-editor/react';
import {
  push, setEditor, getFiles, getActiveFile, getFileFirstValue,
  addFile as recordAddFile, removeFile as recordRemoveFile, switchFile as recordSwitchFile,
  ensureFileContent, isTypistLoaded,
} from '../../functions/record';
import { isBinaryFile, extLang } from '../../functions/fileTypes';
import { FiFolder, FiScissors, FiCopy, FiClipboard, FiList, FiAlertTriangle, FiFileText } from 'react-icons/fi';
import PropTypes from 'prop-types';

const _Editor = memo(({ editorRef }) => {
  const { 
    recording, fontSize, showMinimap, activeFile, previewFile,
    setActiveFile, setFiles, currentWorkspace, autoSave, setToast, theme
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

  const normalizeSlashes = useCallback((value = "") => value.replace(/\\/g, "/"), []);

  const getRelativePathFromWorkspace = useCallback((absolutePath) => {
    if (!absolutePath || !currentWorkspace?.path) return null;
    const workspaceRoot = normalizeSlashes(currentWorkspace.path).replace(/\/+$/, "");
    const normalizedAbsolute = normalizeSlashes(absolutePath);
    if (!normalizedAbsolute.startsWith(`${workspaceRoot}/`)) {
      return null;
    }
    return normalizedAbsolute.slice(workspaceRoot.length + 1);
  }, [currentWorkspace?.path, normalizeSlashes]);

  const saveRelativeFile = useCallback(async (relativePath, content, options = {}) => {
    if (!relativePath || !currentWorkspace?.path || !window.electronAPI?.file?.write) {
      return false;
    }
    const fullPath = window.electronAPI.path.join(currentWorkspace.path, relativePath);
    const success = await window.electronAPI.file.write(fullPath, content ?? "");
    if (!success && !options.silent) {
      setToast({ type: 'ERROR', message: `Failed to save ${relativePath}` });
    }
    return !!success;
  }, [currentWorkspace?.path, setToast]);

  const getModelContent = useCallback((name) => {
    const model = modelsRef.current[name];
    if (model) return model.getValue();
    return getFileFirstValue(name) || "";
  }, []);

  const saveCurrentFile = useCallback(async () => {
    if (!activeFile || activeFile === previewFile) return false;
    const content = editorRef.current?.getValue();
    if (content === undefined) return false;
    return saveRelativeFile(activeFile, content);
  }, [activeFile, previewFile, editorRef, saveRelativeFile]);

  const saveAllFiles = useCallback(async () => {
    if (!currentWorkspace?.path) return false;
    const trackedFiles = getFiles();
    if (!trackedFiles.length) return false;

    let failed = 0;
    for (const f of trackedFiles) {
      const ok = await saveRelativeFile(f.name, getModelContent(f.name), { silent: true });
      if (!ok) failed += 1;
    }

    if (failed === 0) {
      setToast({ type: "SUCCESS", message: `Saved ${trackedFiles.length} file${trackedFiles.length === 1 ? "" : "s"}` });
      return true;
    }

    setToast({
      type: "WARNING",
      message: `Saved ${trackedFiles.length - failed}/${trackedFiles.length} files`,
    });
    return false;
  }, [currentWorkspace?.path, getModelContent, saveRelativeFile, setToast]);

  const triggerEditorAction = useCallback((actionId) => {
    const editor = editorRef.current;
    if (!editor) return false;
    try {
      editor.focus();
      const action = editor.getAction?.(actionId);
      if (action && typeof action.run === "function") {
        action.run();
        return true;
      }
    } catch {
      // best effort
    }
    return false;
  }, [editorRef]);

  const [ctxMenu, setCtxMenu] = useState(null);

  const modKey = window.electronAPI?.platform === 'darwin' ? 'Cmd' : 'Ctrl';

  const editorCtxActions = useCallback((actionId) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();

    if (actionId === 'editor.action.clipboardCopyAction') {
      document.execCommand('copy');
    } else if (actionId === 'editor.action.clipboardCutAction') {
      document.execCommand('cut');
    } else if (actionId === 'editor.action.clipboardPasteAction') {
      document.execCommand('paste');
    } else {
      triggerEditorAction(actionId);
    }
    setCtxMenu(null);
  }, [triggerEditorAction]);

  const handleEditorContextMenu = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const editorEl = e.currentTarget;
    const rect = editorEl?.getBoundingClientRect();
    setCtxMenu({
      x: e.clientX - (rect?.left || 0),
      y: e.clientY - (rect?.top || 0),
    });
  }, []);

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
    };
  }, [ctxMenu]);

  const renameModel = useCallback((oldName, newName) => {
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    if (!monaco || !editor) return;
    const model = modelsRef.current[oldName];
    if (!model) return;
    const content = model.getValue();
    const lang = model.getLanguageId();
    model.dispose();
    delete modelsRef.current[oldName];
    const uri = monaco.Uri.parse(`file:///${newName}`);
    const newModel = monaco.editor.createModel(content, lang, uri);
    modelsRef.current[newName] = newModel;
    if (activeFileRef.current === oldName) {
      editor.setModel(newModel);
      oldValue.current = content;
    }
  }, [editorRef]);

  const removeModel = useCallback((name) => {
    const model = modelsRef.current[name];
    if (model) {
      model.dispose();
      delete modelsRef.current[name];
    }
  }, []);

  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
  }, [activeFile]);

  const handleEditorChange = useCallback(() => {
    if (!editorRef.current) return;
    const currentValue = editorRef.current.getValue();
    
    if (recordingRef.current) {
      push(oldValue.current, currentValue);
    }
    oldValue.current = currentValue;

    if (autoSave && !recordingRef.current && activeFileRef.current !== previewFile) {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(() => {
        saveCurrentFile();
      }, 1000);
    }
  }, [autoSave, editorRef, saveCurrentFile, previewFile]);

  const createModel = useCallback((monaco, name, content, language) => {
    if (modelsRef.current[name]) return modelsRef.current[name];
    const uri = monaco.Uri.parse(`file:///${name}`);
    const lang = language || extLang(name);
    const model = monaco.editor.createModel(content || "", lang, uri);
    modelsRef.current[name] = model;
    return model;
  }, []);

  const switchEditorModel = useCallback((name) => {
    const ed = editorRef.current;
    if (!ed || !modelsRef.current[name]) return;
    ed.setModel(modelsRef.current[name]);
    oldValue.current = ed.getValue();
  }, [editorRef]);

  const applyEditorTheme = useCallback((monacoInstance = monacoRef.current) => {
    if (!monacoInstance) return;
    const nextTheme = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);
    document.body.setAttribute('data-theme', nextTheme);

    const styles = getComputedStyle(document.documentElement);
    const bg = styles.getPropertyValue('--bg-primary').trim() || (nextTheme === 'light' ? '#f4f6fb' : '#13161c');
    const fg = styles.getPropertyValue('--text-primary').trim() || (nextTheme === 'light' ? '#1f2735' : '#e7ebf2');
    const border = styles.getPropertyValue('--border').trim() || (nextTheme === 'light' ? '#cfd8e6' : '#313a4d');
    const selection = nextTheme === 'light' ? '#c9defa' : '#315f8f';
    const inactiveSelection = nextTheme === 'light' ? '#dbe7f6' : '#263f5f';
    const selectionFg = nextTheme === 'light' ? '#102033' : '#ffffff';
    const lineHighlight = styles.getPropertyValue('--bg-hover').trim() || (nextTheme === 'light' ? '#e5eaf4' : '#293141');
    const cursor = styles.getPropertyValue('--accent').trim() || '#a94442';
    const lineNum = styles.getPropertyValue('--text-muted').trim() || (nextTheme === 'light' ? '#66748b' : '#7f8ca0');
    const lineNumActive = styles.getPropertyValue('--text-secondary').trim() || (nextTheme === 'light' ? '#3a465a' : '#b4becd');
    const monacoThemeName = `codecast-${nextTheme}`;

    monacoInstance.editor.defineTheme(monacoThemeName, {
      base: nextTheme === 'light' ? 'vs' : 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': bg,
        'editor.foreground': fg,
        'editor.lineHighlightBackground': lineHighlight,
        'editorCursor.foreground': cursor,
        'editor.selectionBackground': selection,
        'editor.selectionForeground': selectionFg,
        'editor.inactiveSelectionBackground': inactiveSelection,
        'editorLineNumber.foreground': lineNum,
        'editorLineNumber.activeForeground': lineNumActive,
        'editor.border': border,
      }
    });
    monacoInstance.editor.setTheme(monacoThemeName);
  }, [theme]);

  function handleEditorDidMount(editor, monaco) {
    editorRef.current = editor;
    setEditor(editorRef);
    monacoRef.current = monaco;
    editorReady.current = true;
    applyEditorTheme(monaco);

    const fileList = getFiles();
    const active = getActiveFile() || (fileList.length > 0 ? fileList[0].name : null);
    if (active) {
      const content = getFileFirstValue(active) || "";
      createModel(monaco, active, content, undefined);
      if (modelsRef.current[active]) {
        editor.setModel(modelsRef.current[active]);
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

  const saveCurrentFileAs = useCallback(async () => {
    if (!activeFile || !currentWorkspace?.path || !window.electronAPI?.file?.selectSaveFile) {
      return false;
    }

    const content = editorRef.current?.getValue();
    if (content === undefined) return false;

    const defaultPath = window.electronAPI.path.join(currentWorkspace.path, activeFile);
    const selectedPath = await window.electronAPI.file.selectSaveFile({
      title: "Save File As",
      defaultPath,
    });
    if (!selectedPath) return false;

    const relativePath = getRelativePathFromWorkspace(selectedPath);
    if (!relativePath) {
      setToast({ type: "WARNING", message: "Save As target must be inside the opened project folder." });
      return false;
    }

    const success = await window.electronAPI.file.write(selectedPath, content);
    if (!success) {
      setToast({ type: "ERROR", message: `Failed to save ${relativePath}` });
      return false;
    }

    if (relativePath !== activeFile) {
      if (getFiles().some((f) => f.name === relativePath)) {
        recordRemoveFile(relativePath);
      }
      recordAddFile(relativePath, extLang(relativePath), content);
      ensureModel(relativePath, content, extLang(relativePath));
      recordSwitchFile(relativePath);
      setActiveFile(relativePath);
      setFiles(getFiles());
    }

    setToast({ type: "SUCCESS", message: `Saved as ${relativePath}` });
    return true;
  }, [activeFile, currentWorkspace?.path, editorRef, ensureModel, getRelativePathFromWorkspace, setActiveFile, setFiles, setToast]);

  useEffect(() => {
    // Small delay to ensure the data-theme attribute is applied to the DOM
    // before we read the CSS variables
    const timer = setTimeout(() => {
      applyEditorTheme();
    }, 10);
    return () => clearTimeout(timer);
  }, [theme, applyEditorTheme]);

  useEffect(() => {
    window.__saveCurrentFile = saveCurrentFile;
    window.__saveCurrentFileAs = saveCurrentFileAs;
    window.__saveAllFiles = saveAllFiles;
    window.__runEditorAction = triggerEditorAction;
    window.__focusEditor = () => editorRef.current?.focus();
    return () => {
      window.__saveCurrentFile = undefined;
      window.__saveCurrentFileAs = undefined;
      window.__saveAllFiles = undefined;
      window.__runEditorAction = undefined;
      window.__focusEditor = undefined;
    };
  }, [editorRef, saveCurrentFile, saveCurrentFileAs, saveAllFiles, triggerEditorAction]);

  window.__ensureModel = ensureModel;
  window.__switchEditorModel = switchEditorModel;
  window.__renameModel = renameModel;
  window.__removeModel = removeModel;
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
    const load = async () => {
      let content = modelsRef.current[activeFile] ? undefined : (getFileFirstValue(activeFile) || "");
      if (!content && currentWorkspace?.path) {
        if (activeFile === previewFile) {
          const fullPath = window.electronAPI.path.join(currentWorkspace.path, activeFile);
          content = await window.electronAPI.file.read(fullPath);
        } else {
          await ensureFileContent(activeFile, currentWorkspace.path);
          content = getFileFirstValue(activeFile) || "";
        }
      }
      ensureModel(activeFile, content, undefined);
      if (modelsRef.current[activeFile]) {
        switchEditorModel(activeFile);
      }
    };
    load();
  }, [activeFile, switchEditorModel, ensureModel, currentWorkspace?.path, previewFile]);

  const noProject = !currentWorkspace && !isTypistLoaded();
  const noTabsOpen = !noProject && !activeFile;

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
    contextmenu: false,
  };

  const isBinary = activeFile && isBinaryFile(activeFile);

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
      {!noProject && isBinary && (
          <div className="editor-no-project binary-view">
            <div className="editor-no-project-content">
              <FiFileText size={48} />
              <h3>Binary File</h3>
              <p>The file is not displayed in the editor because it is either binary or uses an unsupported text encoding.</p>
              <p style={{fontSize: '0.85em', opacity: 0.7}}>File: {activeFile}</p>
            </div>
          </div>
      )}
      {noTabsOpen && (
        <div className="editor-no-project">
          <div className="editor-no-project-content">
            <FiFileText size={48} style={{ opacity: 0.3 }} />
            <h3>No File Open</h3>
            <p>Open a file from the explorer or create a new one to start editing.</p>
          </div>
        </div>
      )}
      <div className={`editor-monaco-wrapper ${(noProject || isBinary || noTabsOpen) ? 'hidden' : ''}`} onContextMenu={handleEditorContextMenu}>
        <Editor
          height="100%"
          width="100%"
          onMount={handleEditorDidMount}
          onChange={handleEditorChange}
          theme='codecast-theme'
          options={options}
        />
        {ctxMenu && (
          <div
            className="menu-dropdown editor-ctx-menu"
            style={{ left: ctxMenu.x, top: ctxMenu.y, position: 'absolute' }}
          >
            <button className="menu-item" onClick={() => editorCtxActions('editor.action.clipboardCutAction')}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FiScissors size={12} /> Cut</span>
              <span className="menu-item-shortcut">{modKey}+X</span>
            </button>
            <button className="menu-item" onClick={() => editorCtxActions('editor.action.clipboardCopyAction')}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FiCopy size={12} /> Copy</span>
              <span className="menu-item-shortcut">{modKey}+C</span>
            </button>
            <button className="menu-item" onClick={() => editorCtxActions('editor.action.clipboardPasteAction')}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FiClipboard size={12} /> Paste</span>
              <span className="menu-item-shortcut">{modKey}+V</span>
            </button>
            <div className="menu-separator" />
            <button className="menu-item" onClick={() => editorCtxActions('editor.action.selectAll')}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FiList size={12} /> Select All</span>
              <span className="menu-item-shortcut">{modKey}+A</span>
            </button>
          </div>
        )}
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
