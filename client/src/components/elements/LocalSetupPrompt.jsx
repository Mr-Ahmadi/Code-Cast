import { useEffect } from 'react';

export default function LocalSetupPrompt({ onComplete }) {
  useEffect(() => { onComplete?.(); }, [onComplete]);

  return (
    <div className="partial-container" style={{ textAlign: 'center' }}>
      <h2 className="partial-title" style={{ fontSize: 20, marginBottom: 12 }}>
        Welcome to Code Video
      </h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
        You are using the app in <strong>offline mode</strong>.
        Click <strong>Open Folder</strong> in the project list to open any folder on your computer.
        Each folder is its own project — recordings will be saved in a <code>.record</code> folder inside it.
      </p>
      <button
        className="btn btn-primary"
        onClick={() => { onComplete?.(); window.__openProjectDialog?.(); }}
        style={{ padding: '10px 24px', fontSize: 14 }}
      >
        Open Folder
      </button>
    </div>
  );
}
