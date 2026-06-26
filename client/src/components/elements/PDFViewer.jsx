import { useState, useEffect, useContext } from 'react';
import { GlobalContext } from '../../contexts/GlobalStates';
import { FiAlertTriangle } from 'react-icons/fi';

const PDFViewer = ({ file }) => {
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
        setError('Failed to read PDF file');
        setLoading(false);
        return;
      }
      setSrc(`data:application/pdf;base64,${base64}`);
      setLoading(false);
    }).catch((err) => {
      setError(err.message || 'Failed to load PDF');
      setLoading(false);
    });
  }, [file, currentWorkspace?.path]);

  if (loading) {
    return (
      <div className="viewer-container">
        <div className="viewer-loading">Loading PDF...</div>
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
    <div className="viewer-container pdf-viewer">
      <iframe
        src={src}
        title={file}
        className="pdf-viewer-iframe"
      />
    </div>
  );
};

export default PDFViewer;
