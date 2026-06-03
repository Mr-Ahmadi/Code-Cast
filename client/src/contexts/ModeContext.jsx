import { createContext, useContext, useState, useCallback, useMemo } from 'react';

export const MODES = {
  ONLINE: 'online',
  LOCAL: 'local',
};

const ModeContext = createContext();

export function ModeProvider({ children }) {
  const [mode, setModeState] = useState(() => {
    const saved = localStorage.getItem('codevideo_mode');
    if (saved === MODES.ONLINE || saved === MODES.LOCAL) return saved;
    const defaultMode = window.electronAPI?.isElectron ? MODES.LOCAL : MODES.ONLINE;
    localStorage.setItem('codevideo_mode', defaultMode);
    return defaultMode;
  });

  const setMode = useCallback((newMode) => {
    setModeState(newMode);
    localStorage.setItem('codevideo_mode', newMode);
  }, []);

  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

export function useMode() {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error('useMode must be used within ModeProvider');
  return ctx;
}
