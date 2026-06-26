import { useState, useEffect, useContext, useMemo, useRef, useCallback } from 'react';
import { GlobalContext } from '../../contexts/GlobalStates';
import { FiAlertTriangle, FiEye, FiEdit3, FiSave } from 'react-icons/fi';
import { marked } from 'marked';
import MonacoEditor from '@monaco-editor/react';

const MarkdownPreview = ({ file }) => {
  const { currentWorkspace, theme, setToast } = useContext(GlobalContext);
  const previewRef = useRef(null);
  const monacoRef = useRef(null);
  const [content, setContent] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(true);

  const fullPath = useMemo(() => {
    if (!file || !currentWorkspace?.path) return null;
    return window.electronAPI.path.join(currentWorkspace.path, file);
  }, [file, currentWorkspace?.path]);

  useEffect(() => {
    if (!fullPath) return;
    setLoading(true);
    setError(null);

    window.electronAPI.file.read(fullPath).then((text) => {
      if (text === null || text === undefined) {
        setError('Failed to read file');
        setLoading(false);
        return;
      }
      setContent(text);
      setLoading(false);
    }).catch((err) => {
      setError(err.message || 'Failed to load file');
      setLoading(false);
    });
  }, [fullPath]);

  const saveContent = useCallback(async (text) => {
    if (!fullPath) return false;
    const ok = await window.electronAPI.file.write(fullPath, text ?? content);
    if (ok) {
      setToast({ type: 'SUCCESS', message: `Saved ${file}` });
    } else {
      setToast({ type: 'ERROR', message: `Failed to save ${file}` });
    }
    return ok;
  }, [fullPath, content, file, setToast]);

  const handleEditorMount = useCallback((editor, monaco) => {
    monacoRef.current = editor;
    editor.focus();
  }, []);

  const handleMonacoChange = useCallback((value) => {
    setContent(value || '');
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's' && !showPreview && monacoRef.current) {
        e.preventDefault();
        saveContent(monacoRef.current.getValue());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPreview, saveContent]);

  const handleToggleMode = useCallback((preview) => {
    if (!preview && monacoRef.current) {
      // Syncing latest from Monaco before switching to preview
      setContent(monacoRef.current.getValue());
    }
    setShowPreview(preview);
  }, []);

  const fileDir = useMemo(() => {
    if (!file) return '';
    const parts = file.split('/');
    parts.pop();
    return parts.join('/');
  }, [file]);

  const html = useMemo(() => {
    if (!content) return '';
    try {
      const processed = content.replace(
        /!\[([^\]]*)\]\(([^)]+)\)/g,
        (match, alt, href) => {
          if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('data:') || href.startsWith('file://')) {
            return match;
          }
          const base = fileDir ? `${fileDir}/` : '';
          return `![${alt}](file://${currentWorkspace?.path || ''}/${base}${href})`;
        }
      );
      return marked.parse(processed);
    } catch {
      return `<pre>${content}</pre>`;
    }
  }, [content, fileDir, currentWorkspace?.path]);

  const loadImages = useCallback(() => {
    if (!previewRef.current) return;
    const imgs = previewRef.current.querySelectorAll('img[src^="file://"]');
    imgs.forEach((img) => {
      const filePath = img.getAttribute('src')?.replace('file://', '');
      if (!filePath) return;
      window.electronAPI.file.readBase64(filePath).then((base64) => {
        if (base64) {
          const ext = filePath.split('.').pop().toLowerCase();
          const mime = ext === 'svg' ? 'image/svg+xml'
            : ext === 'png' ? 'image/png'
            : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
            : ext === 'gif' ? 'image/gif'
            : ext === 'webp' ? 'image/webp'
            : 'image/png';
          img.src = `data:${mime};base64,${base64}`;
        }
      });
    });
  }, []);

  useEffect(() => {
    if (showPreview && html) {
      requestAnimationFrame(loadImages);
    }
  }, [showPreview, html, loadImages]);

  if (loading) {
    return (
      <div className="viewer-container">
        <div className="viewer-loading">Loading preview...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="viewer-container">
        <div className="viewer-error">
          <FiAlertTriangle size={24} />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const editorTheme = theme === 'light' ? 'vs' : 'vs-dark';

  return (
    <div className="viewer-container markdown-preview">
      <div className="markdown-preview-toolbar">
        <button
          className={`markdown-preview-btn ${showPreview ? 'active' : ''}`}
          onClick={() => handleToggleMode(true)}
          title="Show rendered preview"
        >
          <FiEye size={14} /> Preview
        </button>
        <button
          className={`markdown-preview-btn ${!showPreview ? 'active' : ''}`}
          onClick={() => handleToggleMode(false)}
          title="Show source"
        >
          <FiEdit3 size={14} /> Source
        </button>
        {!showPreview && (
          <button
            className="markdown-preview-btn"
            onClick={() => saveContent(monacoRef.current?.getValue())}
            title="Save (Cmd+S)"
          >
            <FiSave size={14} /> Save
          </button>
        )}
        <span className="markdown-preview-filename">{file}</span>
      </div>
      <div className="markdown-preview-body">
        <div className={`markdown-preview-pane ${showPreview ? '' : 'hidden'}`}>
          <div
            className="markdown-preview-content"
            ref={previewRef}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
        <div className={`markdown-preview-pane ${!showPreview ? '' : 'hidden'}`}>
          <div className="markdown-preview-source-editor">
            <MonacoEditor
              height="100%"
              language="markdown"
              theme={editorTheme}
              defaultValue={content}
              onChange={handleMonacoChange}
              onMount={handleEditorMount}
              options={{
                fontSize: 13,
                minimap: { enabled: false },
                wordWrap: 'on',
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                padding: { top: 12 },
                tabSize: 2,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarkdownPreview;
