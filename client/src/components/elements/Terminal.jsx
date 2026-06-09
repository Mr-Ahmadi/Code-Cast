import { useEffect, useRef, useContext, useState, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { GlobalContext } from '../../contexts/GlobalStates';
import { useMode, MODES } from '../../contexts/ModeContext';
import PropTypes from "prop-types";

export default function TerminalPanel({ visible, terminalId }) {
  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);
  const { theme, setToast, currentWorkspace } = useContext(GlobalContext);
  const themeRef = useRef(theme);
  const { mode } = useMode();
  const isLocal = mode === MODES.LOCAL;

  // Track if terminal is initialized for this session
  const [isReady, setIsReady] = useState(false);
  themeRef.current = theme;

  const buildTerminalTheme = useCallback(() => {
    const nextTheme = themeRef.current === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);
    document.body.setAttribute('data-theme', nextTheme);

    const styles = getComputedStyle(document.documentElement);
    const bg = styles.getPropertyValue('--bg-primary').trim() || (nextTheme === 'light' ? '#f4f6fb' : '#13161c');
    const fg = styles.getPropertyValue('--text-primary').trim() || (nextTheme === 'light' ? '#1f2735' : '#e7ebf2');
    const accent = styles.getPropertyValue('--accent').trim() || '#a94442';
    const success = styles.getPropertyValue('--success').trim() || (nextTheme === 'light' ? '#2f8d69' : '#46b188');
    const selection = styles.getPropertyValue('--accent-glow').trim() || 'rgba(169, 68, 66, 0.28)';

    return {
      background: bg,
      foreground: fg,
      cursor: accent,
      selectionBackground: selection,
      black: bg,
      red: '#f44747',
      green: '#6a9955',
      yellow: '#d7ba7d',
      blue: accent,
      magenta: '#c586c0',
      cyan: success,
      white: fg,
      brightBlack: '#808080',
      brightRed: '#f44747',
      brightGreen: '#6a9955',
      brightYellow: '#d7ba7d',
      brightBlue: accent,
      brightMagenta: '#c586c0',
      brightCyan: success,
      brightWhite: fg,
    };
  }, []);

  const applyTerminalTheme = useCallback(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = buildTerminalTheme();
      xtermRef.current.refresh(0, xtermRef.current.rows - 1);
    }
  }, [buildTerminalTheme]);

  // Update terminal theme when global theme changes
  useEffect(() => {
    applyTerminalTheme();
  }, [theme, applyTerminalTheme]);

  // Focus and fit when terminal becomes visible or ready
  useEffect(() => {
    if (visible && xtermRef.current && isReady) {
      const timer = setTimeout(() => {
        if (xtermRef.current && visible) {
          xtermRef.current.focus();
          try {
            // Force a refresh of the dimensions
            xtermRef.current.refresh(0, xtermRef.current.rows - 1);
            fitAddonRef.current?.fit();
          } catch (error) {
            void error;
          }
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [visible, isReady]);

  useEffect(() => {
    if (!terminalRef.current) return;

    let term;
    let fitAddon;
    let alive = true;
    const disposables = [];

    try {
      term = new XTerm({
        cursorBlink: true,
        cursorStyle: 'block',
        fontSize: 13,
        fontFamily: "Consolas, 'Courier New', monospace",
        theme: buildTerminalTheme(),
        allowTransparency: true,
      });

      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      term.open(terminalRef.current);
      term.write('\x1b[2mConnecting...\x1b[0m\r\n');
      
      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      requestAnimationFrame(() => {
        if (alive) {
          try { fitAddon.fit(); } catch (error) { void error; }
        }
      });
    } catch (e) {
      console.error('Xterm init failed:', e);
      return;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      if (!alive || !entries.length) return;
      const { width, height } = entries[0].contentRect;
      if (width === 0 || height === 0) return;

      requestAnimationFrame(() => {
        if (alive) {
          try { fitAddon.fit(); } catch (error) { void error; }
        }
      });
    });
    resizeObserver.observe(terminalRef.current);

    if (isLocal && window.electronAPI?.isElectron) {
      window.electronAPI.terminal.isPtyAvailable().then(({ available, error }) => {
        if (!alive) return;
        if (!available) {
          term.write(`\r\n\x1b[31m[Terminal Error: node-pty not available]\x1b[0m\r\n`);
          if (error) term.write(`\x1b[31m[Error detail: ${error}]\x1b[0m\r\n`);
          term.write(`\r\n\x1b[33m[Falling back to basic shell...]\x1b[0m\r\n`);
        }

        const id = terminalId || `terminal-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const cwd = currentWorkspace?.path || undefined;

        window.electronAPI.terminal.create(id, cwd)
          .then(() => {
            if (!alive) {
              window.electronAPI.terminal.kill(id);
              return;
            }
            term.clear();
            setIsReady(true);

            disposables.push(term.onData((data) => {
              window.electronAPI.terminal.write(id, data);
            }));

            const removeData = window.electronAPI.terminal.onData((termId, data) => {
              if (termId === id && alive) {
                try { term.write(data); } catch (error) { void error; }
              }
            });

            const removeExit = window.electronAPI.terminal.onExit((termId) => {
              if (termId === id && alive) {
                term.write('\r\n\x1b[31m[Process completed]\x1b[0m\r\n');
              }
            });

            disposables.push(term.onResize(({ cols, rows }) => {
              window.electronAPI.terminal.resize(id, cols, rows);
            }));

            disposables.push({ dispose: removeData });
            disposables.push({ dispose: removeExit });
            disposables.push({ dispose: () => window.electronAPI.terminal.kill(id) });
          })
          .catch((err) => {
            if (!alive) return;
            term.write(`\r\n\x1b[31m[IPC error: ${err.message}]\x1b[0m\r\n`);
            setToast({ type: 'ERROR', message: `Terminal: ${err.message}` });
          });
      });
    } else if (!isLocal) {
      term.write('\x1b[33m[Online mode] Connecting to server...\x1b[0m\r\n');
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname;
      const getCookie = (name) => {
        const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
        return match ? match[2] : '';
      };
      const token = getCookie('jwt');
      const wsUrl = `${protocol}//${host}:4000/terminal${token ? `?token=${encodeURIComponent(token)}` : ''}`;
      
      try {
        const ws = new WebSocket(wsUrl);
        ws.onopen = () => { if (alive) { term.clear(); setIsReady(true); } };
        ws.onmessage = (event) => { if (alive) term.write(event.data); };
        ws.onerror = () => { if (alive) term.write('\x1b[31m[WebSocket error]\x1b[0m\r\n'); };
        ws.onclose = () => { if (alive) term.write('\r\n\x1b[33m[Disconnected]\x1b[0m\r\n'); };

        disposables.push(term.onData((data) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(data);
        }));

        disposables.push(term.onResize(({ cols, rows }) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "resize", cols, rows }));
          }
        }));

        disposables.push({ dispose: () => ws.close() });
      } catch (e) {
        term.write(`\x1b[31m[WS error: ${e.message}]\x1b[0m\r\n`);
      }
    } else {
      term.write('\x1b[33m[Terminal requires Electron for local mode]\x1b[0m\r\n');
    }

    return () => {
      alive = false;
      setIsReady(false);
      resizeObserver.disconnect();
      for (const d of disposables) {
        try { d.dispose(); } catch (error) { void error; }
      }
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [isLocal, setToast, currentWorkspace?.path, terminalId, buildTerminalTheme]);

  return (
    <div 
      className={"terminal-panel" + (visible ? "" : " hidden")} 
      aria-hidden={!visible}
      onClick={() => xtermRef.current?.focus()}
    >
      <div className="terminal-body" ref={terminalRef} />
    </div>
  );
}

TerminalPanel.propTypes = {
  visible: PropTypes.bool,
  terminalId: PropTypes.string,
};
