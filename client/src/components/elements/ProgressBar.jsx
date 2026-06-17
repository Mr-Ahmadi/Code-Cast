import { useRef, useCallback, memo } from "react";
import PropTypes from 'prop-types';
import { FiSkipBack, FiSkipForward, FiCpu } from "react-icons/fi";

const formatMs = (ms) => {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const ProgressBar = memo(({ progress, duration, onSeek, speed, onSkipBack, onSkipForward, onExplain, explaining }) => {
  const barRef = useRef(null);
  const dragging = useRef(false);

  const computeProgress = useCallback((clientX) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  const handleMouseDown = useCallback((e) => {
    dragging.current = true;
    const p = computeProgress(e.clientX);
    onSeek(p);
    const handleMouseMove = (e) => {
      if (!dragging.current) return;
      const p = computeProgress(e.clientX);
      onSeek(p);
    };
    const handleMouseUp = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [computeProgress, onSeek]);

  const currentTime = Math.round(progress * duration);

  return (
    <div className="progress-bar-container">
      <button
        className="progress-skip-btn"
        onClick={onSkipBack}
        aria-label="Skip back 5 seconds"
        title="Skip back 5 seconds"
      >
        <FiSkipBack size={12} />
      </button>
      <div
        className="progress-bar-track"
        ref={barRef}
        onMouseDown={handleMouseDown}
        role="slider"
        aria-label="Playback progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') onSkipForward();
          if (e.key === 'ArrowLeft') onSkipBack();
        }}
      >
        <div
          className="progress-bar-fill"
          style={{ width: `${progress * 100}%` }}
        />
        <div
          className="progress-bar-thumb"
          style={{ left: `${progress * 100}%` }}
        />
      </div>
      <button
        className="progress-skip-btn"
        onClick={onSkipForward}
        aria-label="Skip forward 5 seconds"
        title="Skip forward 5 seconds"
      >
        <FiSkipForward size={12} />
      </button>
      <span className="progress-time">{formatMs(currentTime)} / {formatMs(duration)}</span>
      {speed !== 1 && <span className="speed-badge" style={{ marginLeft: 6 }}>{speed}x</span>}
      {onExplain && (
        <button
          className="progress-explain-btn"
          onClick={onExplain}
          disabled={explaining}
          title="Explain current code with AI"
          aria-label="Explain current code"
        >
          <FiCpu size={12} />
          {explaining ? '...' : 'Explain'}
        </button>
      )}
    </div>
  );
});

ProgressBar.displayName = 'ProgressBar';

ProgressBar.propTypes = {
  progress: PropTypes.number.isRequired,
  duration: PropTypes.number.isRequired,
  onSeek: PropTypes.func.isRequired,
  speed: PropTypes.number.isRequired,
  onSkipBack: PropTypes.func.isRequired,
  onSkipForward: PropTypes.func.isRequired,
  onExplain: PropTypes.func,
  explaining: PropTypes.bool,
};

export default ProgressBar;