import { useState, useEffect, useContext } from 'react';
import { GlobalContext } from '../../contexts/GlobalStates';
import { FiAlertTriangle } from 'react-icons/fi';

const ImageViewer = ({ file }) => {
  const { currentWorkspace } = useContext(GlobalContext);
  const [src, setSrc] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!file || !currentWorkspace?.path) return;
    setLoading(true);
    setError(null);
    const fullPath = window.electronAPI.path.join(currentWorkspace.path, file);

    window.electronAPI.file.readBase64(fullPath).then((base64) => {
      if (!base64) {
        setError('Failed to read file');
        setLoading(false);
        return;
      }
      const ext = file.split('.').pop().toLowerCase();
      const mime = ext === 'svg' ? 'image/svg+xml'
        : ext === 'png' ? 'image/png'
        : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
        : ext === 'gif' ? 'image/gif'
        : ext === 'webp' ? 'image/webp'
        : ext === 'bmp' ? 'image/bmp'
        : ext === 'ico' ? 'image/x-icon'
        : 'image/png';
      setSrc(`data:${mime};base64,${base64}`);
      setLoading(false);
    }).catch((err) => {
      setError(err.message || 'Failed to load image');
      setLoading(false);
    });
  }, [file, currentWorkspace?.path]);

  if (loading) {
    return (
      <div className="viewer-container">
        <div className="viewer-loading">Loading image...</div>
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
    <div className="viewer-container image-viewer">
      <div className="image-viewer-content">
        <img src={src} alt={file} />
        <div className="image-viewer-info">{file}</div>
      </div>
    </div>
  );
};

export default ImageViewer;
