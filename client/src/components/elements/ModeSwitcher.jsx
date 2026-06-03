import { useMode, MODES } from '../../contexts/ModeContext';
import { FiGlobe, FiMonitor } from 'react-icons/fi';

export default function ModeSwitcher() {
  const { mode, setMode } = useMode();

  return (
    <div className="mode-switcher">
      <button
        className={'mode-btn' + (mode === MODES.ONLINE ? ' active' : '')}
        onClick={() => setMode(MODES.ONLINE)}
        title="Online mode - uses server"
        aria-label="Switch to online mode"
      >
        <FiGlobe size={12} />
        <span>Online</span>
      </button>
      <button
        className={'mode-btn' + (mode === MODES.LOCAL ? ' active' : '')}
        onClick={() => {
          if (!window.electronAPI?.isElectron) {
            alert('Local mode requires the Electron desktop app.\n\nRun the app with: npm run electron');
            return;
          }
          setMode(MODES.LOCAL);
        }}
        title="Local mode - desktop only"
        aria-label="Switch to local mode"
      >
        <FiMonitor size={12} />
        <span>Local</span>
      </button>
    </div>
  );
}
