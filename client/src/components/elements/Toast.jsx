import { useContext, useEffect, useRef, useCallback } from 'react';
import { GlobalContext } from '../../contexts/GlobalStates';
import { FiCheckCircle, FiAlertCircle, FiInfo, FiAlertTriangle, FiX } from "react-icons/fi";

const iconMap = {
  SUCCESS: FiCheckCircle,
  ERROR: FiAlertCircle,
  INFO: FiInfo,
  WARNING: FiAlertTriangle,
};

const Toast = () => {
  const { toast, setToast } = useContext(GlobalContext);
  const timerRef = useRef(null);
  const paused = useRef(false);

  const clearToast = useCallback(() => {
    setToast(null);
  }, [setToast]);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!paused.current) {
      timerRef.current = setTimeout(clearToast, 4000);
    }
  }, [clearToast]);

  useEffect(() => {
    if (toast) {
      startTimer();
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast, startTimer]);

  const handlePause = useCallback(() => {
    paused.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const handleResume = useCallback(() => {
    paused.current = false;
    startTimer();
  }, [startTimer]);

  if (!toast) return null;

  const type = toast.type || "INFO";
  const Icon = iconMap[type] || FiInfo;
  const isError = type === "ERROR";
  const isWarning = type === "WARNING";

  const className = isError ? 'toast-error' : isWarning ? 'toast-warning' : 'toast-success';

  return (
    <div
      className={'toast ' + className}
      role="status"
      aria-live="polite"
      onMouseEnter={handlePause}
      onMouseLeave={handleResume}
    >
      <Icon size={18} aria-hidden="true" />
      <span>{toast.message}</span>
      <button className="toast-close" onClick={clearToast} aria-label="Dismiss notification">
        <FiX size={16} />
      </button>
    </div>
  );
};

export default Toast;