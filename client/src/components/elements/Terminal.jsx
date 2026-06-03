import { useEffect, useRef, useContext } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { GlobalContext } from '../../contexts/GlobalStates';
import { useMode, MODES } from '../../contexts/ModeContext';
import { FiX } from "react-icons/fi";

let terminalCounter = 0;

export default function TerminalPanel({ visible, onClose }) {
  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);
  const { setToast, currentWorkspace } = useContext(GlobalContext);
  const { mode } = useMode();

  const isLocal = mode === MODES.LOCAL;

  useEffect(() => {
    if (!visible || !terminalRef.current) return;

    let term;
    let fitAddon;
    try {
      term = new XTerm({
        cursorBlink: true,
        cursorStyle: 'block',
        fontSize: 13,
        fontFamily: "Consolas, 'Courier New', monospace",
        theme: {
          background: '#1e1e1e',
          foreground: '#d4d4d4',
          cursor: '#d4d4d4',
          selectionBackground: '#264f78',
          black: '#1e1e1e',
          red: '#f44747',
          green: '#6a9955',
          yellow: '#d7ba7d',
          blue: '#569cd6',
          magenta: '#c586c0',
          cyan: '#4ec9b0',
          white: '#d4d4d4',
          brightBlack: '#808080',
          brightRed: '#f44747',
          brightGreen: '#6a9955',
          brightYellow: '#d7ba7d',
          brightBlue: '#569cd6',
          brightMagenta: '#c586c0',
          brightCyan: '#4ec9b0',
          brightWhite: '#d4d4d4',
        },
        allowTransparency: true,
      });

      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      fitAddonRef.current = fitAddon;

      term.open(terminalRef.current);
      term.write('\r\n');

      requestAnimationFrame(() => {
        try { fitAddon.fit(); } catch {}
      });

      xtermRef.current = term;
    } catch (e) {
      console.error('Xterm init failed:', e);
      return;
    }

    const disposables = [];
    let alive = true;

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        if (alive) try { fitAddon.fit(); } catch {}
      });
    });
    resizeObserver.observe(terminalRef.current);

    if (isLocal && window.electronAPI?.isElectron) {
      const id = `terminal-${++terminalCounter}`;

      const cwd = currentWorkspace?.path || undefined;
      window.electronAPI.terminal.create(id, cwd)
        .then(() => {
          if (!alive) {
            window.electronAPI.terminal.kill(id);
            return;
          }
          disposables.push(term.onData((data) => {
            window.electronAPI.terminal.write(id, data);
          }));

          const removeData = window.electronAPI.terminal.onData((termId, data) => {
            if (termId === id) {
              try { term.write(data); } catch {}
            }
          });

          const removeExit = window.electronAPI.terminal.onExit((termId) => {
            if (termId === id) {
              term.write('\r\n\x1b[31m[Process completed]\x1b[0m\r\n');
            }
          });

          disposables.push({ dispose: removeData });
          disposables.push({ dispose: removeExit });
          disposables.push({ dispose: () => window.electronAPI.terminal.kill(id) });
        })
        .catch((err) => {
          if (!alive) return;
          term.write(`\r\n\x1b[31m[IPC error: ${err.message}]\x1b[0m\r\n`);
          setToast({ type: 'ERROR', message: `Terminal: ${err.message}` });
        });
    } else if (!isLocal) {
      term.write('[Online mode] Connecting to server...\r\n');

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname;
      const getCookie = (name) => {
        const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
        return match ? match[2] : '';
      };
      const token = getCookie('jwt');
      const wsUrl = `${protocol}//${host}:4000/terminal${token ? `?token=${encodeURIComponent(token)}` : ''}`;
      let ws;

      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {};
        ws.onmessage = (event) => { if (alive) term.write(event.data); };
        ws.onerror = () => { if (alive) term.write('\x1b[31m[WebSocket error]\x1b[0m\r\n'); };
        ws.onclose = () => { if (alive) term.write('\r\n\x1b[33m[Disconnected]\x1b[0m\r\n'); };

        disposables.push(term.onData((data) => {
          if (ws && ws.readyState === WebSocket.OPEN) ws.send(data);
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
      resizeObserver.disconnect();
      for (const d of disposables) {
        try { d.dispose(); } catch {}
      }
      term.dispose();
      xtermRef.current = null;
    };
  }, [visible, isLocal, setToast, currentWorkspace?.path]);

  if (!visible) return null;

  return (
    <div className="terminal-panel">
      <div className="terminal-header">
        <span className="terminal-title">
          <span className="terminal-icon" /> TERMINAL
        </span>
        <div className="terminal-header-actions">
          <span className="terminal-mode-badge">
            {isLocal ? 'LOCAL' : 'ONLINE'}
          </span>
          <button className="terminal-close-btn" onClick={onClose} title="Close terminal" aria-label="Close terminal">
            <FiX size={14} />
          </button>
        </div>
      </div>
      <div className="terminal-body" ref={terminalRef} />
    </div>
  );
}
