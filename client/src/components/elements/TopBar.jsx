import { useContext, useState, useEffect, useRef, useCallback, memo } from "react";
import { GlobalContext } from '../../contexts/GlobalStates'
import {
  start as startRecord,
  stop as stopRecord,
  pause as pauseRecord,
  resume as resumeRecord,
  play as runRecord,
  stopPlay,
  seek as seekTo,
  getDuration,
  getStateAt,
  isTypistLoaded,
  isAudioRecording,
  exportRecord,
  importFromFile,
} from "../../functions/record";
import RecordsList from "./RecordsList";
import ShortcutsHelp from "./ShortcutsHelp";
import ProgressBar from "./ProgressBar";
import langVersions from '../../constants/langVersions.json'
import { executeCode } from "../../functions/requests/execute";
import signOut from "../../functions/requests/signOut";
import { useNavigate } from "react-router-dom";
import { FiTerminal, FiFolder, FiLogOut, FiPlay, FiSquare, FiCircle, FiPause, FiMic, FiMicOff, FiChevronDown, FiHelpCircle, FiZoomIn, FiZoomOut, FiMaximize2, FiMinimize2, FiDownload, FiUpload } from "react-icons/fi";
import PropTypes from 'prop-types';

const speeds = [0.5, 0.75, 1, 1.5, 2, 4];
const SKIP_MS = 5000;

const TopBar = memo(({ editorRef }) => {
  const {
    startRecording, recording, stopRecording, paused, setPaused,
    recordName, setRecordName, setLanguage, language, playing, setPlaying, setOutput, setToast, refreshUser,
    audioEnabled, setAudioEnabled,
    fontSize, setFontSize, showMinimap, setShowMinimap,
  } = useContext(GlobalContext);
  const [recordsDisplay, setRecordsDisplay] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [showSpeed, setShowSpeed] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [playProgress, setPlayProgress] = useState(0);
  const [playDuration, setPlayDuration] = useState(0);
  const seekGuard = useRef(false);
  const timerRef = useRef(null);
  const speedRef = useRef(null);
  const progressPollRef = useRef(null);
  const navigate = useNavigate();
  const audioRecording = isAudioRecording();
  const importInputRef = useRef(null);

  const isRecordingActive = recording && !paused;

  useEffect(() => {
    if (recording) {
      setRecordTime(0);
      timerRef.current = setInterval(() => {
        if (!paused) {
          setRecordTime(t => t + 1);
        }
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [recording, paused]);

  useEffect(() => {
    if (playing) {
      const dur = getDuration();
      setPlayDuration(dur);
      if (progressPollRef.current) clearInterval(progressPollRef.current);
      progressPollRef.current = setInterval(() => {
        if (!seekGuard.current) {
          setPlayProgress(p => Math.min(p + 50 / dur, 1));
        }
      }, 50);
    } else {
      if (progressPollRef.current) {
        clearInterval(progressPollRef.current);
        progressPollRef.current = null;
      }
      setPlayProgress(0);
    }
    return () => {
      if (progressPollRef.current) clearInterval(progressPollRef.current);
    };
  }, [playing]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (speedRef.current && !speedRef.current.contains(e.target)) {
        setShowSpeed(false);
      }
    };
    if (showSpeed) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSpeed]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const handleExecute = useCallback(async () => {
    const sourceCode = editorRef.current?.getValue();
    if (!sourceCode) return;
    setExecuting(true);
    try {
      const { run: result } = await executeCode(language, sourceCode);
      setOutput(result?.output || "(no output)");
    } catch (error) {
      setOutput("Error: " + error.message);
      setToast({ type: "ERROR", message: error.message });
    } finally {
      setExecuting(false);
    }
  }, [editorRef, language, setOutput, setToast]);

  const handleRecord = useCallback(async () => {
    if (!recording && !playing) {
      await startRecord(recordName, audioEnabled);
      startRecording();
    } else if (recording && !paused) {
      await stopRecord();
      stopRecording();
      refreshUser();
    } else if (recording && paused) {
      await stopRecord();
      stopRecording();
      refreshUser();
    }
  }, [recording, paused, playing, recordName, audioEnabled, startRecording, stopRecording, refreshUser]);

  const handlePauseResume = useCallback(() => {
    if (paused) {
      resumeRecord();
      setPaused(false);
    } else {
      pauseRecord();
      setPaused(true);
    }
  }, [paused, setPaused]);

  const handlePlay = useCallback(() => {
    if (playing) {
      stopPlay();
      setPlaying(false);
    } else if (isTypistLoaded()) {
      setPlayProgress(0);
      setPlaying(true);
      runRecord((progress) => {
        setPlayProgress(progress);
        if (progress >= 1) setPlaying(false);
      }, speed);
    } else {
      setToast({ type: "ERROR", message: "No recording loaded. Open a record first." });
    }
  }, [playing, speed, setPlaying, setToast]);

  const handleSeek = useCallback((progress) => {
    seekGuard.current = true;
    setPlayProgress(progress);
    seekTo(progress, (p) => {
      setPlayProgress(p);
      if (p >= 1) setPlaying(false);
    }, speed);
    setTimeout(() => { seekGuard.current = false; }, 100);
  }, [speed, setPlaying]);

  const handleSkipBack = useCallback(() => {
    const totalMs = getDuration();
    const currentMs = playProgress * totalMs;
    const newMs = Math.max(0, currentMs - SKIP_MS);
    handleSeek(newMs / totalMs);
  }, [playProgress, handleSeek]);

  const handleSkipForward = useCallback(() => {
    const totalMs = getDuration();
    const currentMs = playProgress * totalMs;
    const newMs = Math.min(totalMs, currentMs + SKIP_MS);
    handleSeek(newMs / totalMs);
  }, [playProgress, handleSeek]);

  const handleSpeedSelect = useCallback((s) => {
    setSpeed(s);
    setShowSpeed(false);
    if (playing) {
      handleSeek(playProgress);
    }
  }, [playing, playProgress, handleSeek]);

  const handleSignOut = useCallback(() => {
    if (recording) {
      setToast({ type: "WARNING", message: "Stop recording before signing out." });
      return;
    }
    signOut(navigate);
  }, [recording, setToast, navigate]);

  const handleImport = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const name = await importFromFile(file);
      setRecordName(name);
      setToast({ type: "SUCCESS", message: `Imported "${name}"` });
      setPlaying(false);
      stopPlay();
      if (editorRef.current) {
        editorRef.current.setValue(getStateAt(0));
      }
    } catch (err) {
      setToast({ type: "ERROR", message: err.message || "Failed to import" });
    }
    e.target.value = "";
  }, [setRecordName, setToast, setPlaying, editorRef]);

  return (
    <>
      <div className="top-bar" role="toolbar" aria-label="Editor controls">
        <div className="top-bar-left">
          <button
            className={"btn btn-primary btn-sm" + (executing ? " btn-loading" : "")}
            onClick={handleExecute}
            title="Execute code (Ctrl+Enter)"
            aria-label="Execute code"
            disabled={executing}
            data-shortcut="execute"
          >
            <FiTerminal size={14} /> Execute
          </button>
          <select
            name="languages"
            className="select-box"
            value={language[0]}
            onChange={ev => setLanguage(ev.target.value, langVersions[ev.target.value])}
            aria-label="Programming language"
          >
            {Object.keys(langVersions).filter(l => ["python", "javascript", "typescript"].includes(l)).map(lang => (
              <option value={lang} key={lang}>{lang} {langVersions[lang]}</option>
            ))}
          </select>
        </div>
        <div className="top-bar-center">
          {isRecordingActive && (
            <span className="recording-indicator" role="status" aria-live="polite" aria-label="Recording in progress">
              <span className="recording-dot" aria-hidden="true"></span>
              <span className="recording-timer">{formatTime(recordTime)}</span>
              {audioRecording && <FiMic size={12} aria-label="Microphone active" />}
            </span>
          )}
          {paused && (
            <span className="paused-indicator" role="status" aria-live="polite" aria-label="Recording paused">
              <span className="paused-dot" aria-hidden="true"></span>
              <span className="recording-timer">{formatTime(recordTime)}</span>
            </span>
          )}
          {playing && (
            <span className="playing-indicator" role="status" aria-live="polite" aria-label="Playing back recording">
              <span className="playing-dot" aria-hidden="true"></span>
              Playing
            </span>
          )}
          {recording && (
            <button
              className="btn btn-sm btn-secondary"
              onClick={handlePauseResume}
              title={paused ? "Resume recording" : "Pause recording"}
              aria-label={paused ? "Resume recording" : "Pause recording"}
            >
              {paused ? <><FiCircle size={14} /> Resume</> : <><FiPause size={14} /> Pause</>}
            </button>
          )}
          <button
            className="btn btn-sm btn-secondary"
            onClick={handleRecord}
            title={recording ? "Stop recording (Ctrl+R)" : "Start recording (Ctrl+R)"}
            aria-label={recording ? "Stop recording" : "Start recording"}
            disabled={playing}
            data-shortcut="record"
          >
            {recording ? <><FiSquare size={14} /> Stop</> : <><FiCircle size={14} /> Record</>}
          </button>
          <button
            className={"btn btn-sm " + (playing ? "btn-danger" : "btn-secondary")}
            onClick={handlePlay}
            title={playing ? "Stop playback (Ctrl+P)" : "Play recording (Ctrl+P)"}
            aria-label={playing ? "Stop playback" : "Play recording"}
            disabled={recording}
            data-shortcut="play"
          >
            {playing ? <><FiSquare size={14} /> Stop</> : <><FiPlay size={14} /> Play</>}
          </button>
          <div className="speed-selector" ref={speedRef}>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => setShowSpeed(!showSpeed)}
              title="Playback speed"
              aria-label="Playback speed"
              aria-expanded={showSpeed}
              aria-haspopup="listbox"
            >
              {speed}x <FiChevronDown size={12} aria-hidden="true" />
            </button>
            {showSpeed && (
              <div className="speed-dropdown" role="listbox" aria-label="Select speed">
                {speeds.map(s => (
                  <button
                    key={s}
                    className={"speed-option" + (s === speed ? " active" : "")}
                    onClick={() => handleSpeedSelect(s)}
                    role="option"
                    aria-selected={s === speed}
                    tabIndex={0}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="top-bar-right">
          <button
            className={"btn btn-sm " + (audioEnabled ? "btn-secondary" : "btn-danger")}
            onClick={() => setAudioEnabled(!audioEnabled)}
            title={audioEnabled ? "Disable audio recording" : "Enable audio recording"}
            aria-label={audioEnabled ? "Disable audio recording" : "Enable audio recording"}
            disabled={recording}
          >
            {audioEnabled ? <FiMic size={14} /> : <FiMicOff size={14} />}
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setRecordsDisplay(true)}
            title="Open recordings (Ctrl+O)"
            aria-label="Open recordings"
            data-shortcut="open"
          >
            <FiFolder size={14} /> Open
          </button>
          {isTypistLoaded() && !recording && (
            <button
              className="btn btn-sm btn-secondary"
              onClick={exportRecord}
              title="Export recording as .cvid"
              aria-label="Export recording"
            >
              <FiDownload size={14} /> Export
            </button>
          )}
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => importInputRef.current?.click()}
            title="Import .cvid file"
            aria-label="Import recording"
            disabled={recording}
          >
            <FiUpload size={14} /> Import
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".cvid"
            style={{ display: "none" }}
            onChange={handleImport}
            aria-hidden="true"
          />
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => setShowShortcuts(true)}
            title="Keyboard shortcuts (?)"
            aria-label="Keyboard shortcuts"
          >
            <FiHelpCircle size={14} />
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleSignOut}
            aria-label="Sign out"
            disabled={recording}
          >
            <FiLogOut size={14} /> Sign Out
          </button>
        </div>
      </div>
      <div className="editor-settings-bar">
        <span className="record-name-label" title="Current record">{recordName}</span>
        <div className="editor-settings-group">
          <button
            className="editor-toolbar-btn"
            onClick={() => setFontSize(Math.max(10, fontSize - 2))}
            title="Decrease font size"
            aria-label="Decrease font size"
            disabled={fontSize <= 10}
          >
            <FiZoomOut size={12} />
          </button>
          <span className="editor-font-size">{fontSize}px</span>
          <button
            className="editor-toolbar-btn"
            onClick={() => setFontSize(Math.min(28, fontSize + 2))}
            title="Increase font size"
            aria-label="Increase font size"
            disabled={fontSize >= 28}
          >
            <FiZoomIn size={12} />
          </button>
          <button
            className="editor-toolbar-btn"
            onClick={() => setShowMinimap(s => !s)}
            title={showMinimap ? "Hide minimap" : "Show minimap"}
            aria-label={showMinimap ? "Hide minimap" : "Show minimap"}
          >
            {showMinimap ? <FiMinimize2 size={12} /> : <FiMaximize2 size={12} />}
          </button>
        </div>
      </div>
      {playing && (
        <ProgressBar
          progress={playProgress}
          duration={playDuration}
          onSeek={handleSeek}
          speed={speed}
          onSkipBack={handleSkipBack}
          onSkipForward={handleSkipForward}
        />
      )}
      <RecordsList display={recordsDisplay} setDisplay={setRecordsDisplay} />
      <ShortcutsHelp display={showShortcuts} setDisplay={setShowShortcuts} />
    </>
  )
});

TopBar.displayName = 'TopBar';

TopBar.propTypes = {
  editorRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any })
  ])
}

export default TopBar