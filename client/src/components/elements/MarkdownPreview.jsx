import { useState, useEffect, useContext, useMemo, useRef, useCallback } from 'react';
import { GlobalContext } from '../../contexts/GlobalStates';
import { FiAlertTriangle, FiEye, FiEdit3 } from 'react-icons/fi';
import { marked } from 'marked';

const MarkdownPreview = ({ file }) => {
  const { currentWorkspace } = useContext(GlobalContext);
  const previewRef = useRef(null);
  const [content, setContent] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(true);

  useEffect(() => {
    if (!file || !currentWorkspace?.path) return;
    setLoading(true);
    setError(null);
    const fullPath = window.electronAPI.path.join(currentWorkspace.path, file);

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
  }, [file, currentWorkspace?.path]);

  const fileDir = useMemo(() => {
    if (!file) return '';
    const parts = file.split('/');
    parts.pop();
    return parts.join('/');
  }, [file]);

  const html = useMemo(() => {
    if (!content) return '';
    try {
      // Prefix relative image URLs with the file's directory path using file://
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
      // Small delay to ensure DOM is updated
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

  return (
    <div className="viewer-container markdown-preview">
      <div className="markdown-preview-toolbar">
        <button
          className={`markdown-preview-btn ${showPreview ? 'active' : ''}`}
          onClick={() => setShowPreview(true)}
          title="Show rendered preview"
        >
          <FiEye size={14} /> Preview
        </button>
        <button
          className={`markdown-preview-btn ${!showPreview ? 'active' : ''}`}
          onClick={() => setShowPreview(false)}
          title="Show source"
        >
          <FiEdit3 size={14} /> Source
        </button>
        <span className="markdown-preview-filename">{file}</span>
      </div>
      {showPreview ? (
        <div
          className="markdown-preview-content"
          ref={previewRef}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="markdown-preview-source">{content}</pre>
      )}
    </div>
  );
};

export default MarkdownPreview;
