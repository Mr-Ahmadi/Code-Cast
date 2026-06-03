import { useState, useEffect } from 'react';
import { isConfigured, configureRoot, getRootDir } from '../../stores/localFsStore';

export default function LocalSetupPrompt({ onComplete }) {
  const [choosing, setChoosing] = useState(false);
  const [done, setDone] = useState(isConfigured());
  const [rootDir, setRootDir] = useState(getRootDir());

  useEffect(() => {
    if (isConfigured()) {
      setDone(true);
      setRootDir(getRootDir());
    }
  }, []);

  const handleChoose = async () => {
    setChoosing(true);
    const ok = await configureRoot();
    setChoosing(false);
    if (ok) {
      setDone(true);
      setRootDir(getRootDir());
      onComplete?.();
    }
  };

  if (done) return null;

  return (
    <div className="partial-container" style={{ textAlign: 'center' }}>
      <h2 className="partial-title" style={{ fontSize: 20, marginBottom: 12 }}>
        Welcome to Code Video
      </h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
        You are using the app in <strong>offline mode</strong>.
        Choose a folder on your computer where all your projects and recordings will be saved.
      </p>
      <button
        className="btn btn-primary"
        onClick={handleChoose}
        disabled={choosing}
        style={{ padding: '10px 24px', fontSize: 14 }}
      >
        {choosing ? 'Opening...' : 'Choose Projects Folder'}
      </button>
      {rootDir && (
        <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 12 }}>
          Current: {rootDir}
        </p>
      )}
    </div>
  );
}
