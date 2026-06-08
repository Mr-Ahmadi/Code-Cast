import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import os from 'os';
import fs from 'fs';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const __root = path.resolve(__dirname, '..');
// Resolve modules from client/ where node_modules lives
const require = createRequire(path.resolve(__root, 'client', 'package.json'));

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow;
let terminalProcesses = {};

function sendMenuAction(action) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('app-menu:action', action);
}

function buildApplicationMenu() {
  if (process.platform !== 'darwin') return;

  const template = [
    { role: 'appMenu' },
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Project…',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendMenuAction('open-project'),
        },
        { type: 'separator' },
        {
          label: 'Import Recording…',
          click: () => sendMenuAction('import-recording'),
        },
        {
          label: 'Export Recording',
          click: () => sendMenuAction('export-recording'),
        },
        { type: 'separator' },
        { role: 'close' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Speech',
          submenu: [{ role: 'startSpeaking' }, { role: 'stopSpeaking' }],
        },
      ],
    },
    {
      label: 'Selection',
      submenu: [{ role: 'selectAll' }],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Explorer',
          click: () => sendMenuAction('toggle-explorer'),
        },
        {
          label: 'Toggle Terminal',
          accelerator: 'CmdOrCtrl+`',
          click: () => sendMenuAction('toggle-terminal'),
        },
        {
          label: 'Toggle Minimap',
          click: () => sendMenuAction('toggle-minimap'),
        },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Run',
      submenu: [
        {
          label: 'Run Code',
          accelerator: 'CmdOrCtrl+Enter',
          click: () => sendMenuAction('run-code'),
        },
        {
          label: 'Toggle Recording',
          accelerator: 'CmdOrCtrl+R',
          click: () => sendMenuAction('toggle-recording'),
        },
        {
          label: 'Toggle Playback',
          accelerator: 'CmdOrCtrl+P',
          click: () => sendMenuAction('toggle-playback'),
        },
      ],
    },
    {
      label: 'Terminal',
      submenu: [
        {
          label: 'New Terminal',
          accelerator: 'CmdOrCtrl+Shift+`',
          click: () => sendMenuAction('new-terminal'),
        },
        {
          label: 'Close Active Terminal',
          click: () => sendMenuAction('close-terminal'),
        },
      ],
    },
    {
      role: 'windowMenu',
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Keyboard Shortcuts',
          accelerator: 'CmdOrCtrl+/',
          click: () => sendMenuAction('show-shortcuts'),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'CodeCast',
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: !isDev,
      allowRunningInsecureContent: !!isDev,
    },
    backgroundColor: '#1a1a2e',
    show: false,
  });

  if (isDev) {
    loadDevServer();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
    mainWindow.once('ready-to-show', () => mainWindow.show());
  }
}

ipcMain.on('window:minimize', () => {
  mainWindow.minimize();
});

ipcMain.on('window:maximize', () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.on('window:close', () => {
  mainWindow.close();
});

function loadDevServer() {
  let retries = 30;

  const showDevTools = () => {
    mainWindow.show();
    mainWindow.webContents.openDevTools();
  };

  const tryConnect = () => {
    mainWindow.loadURL('http://localhost:5173')
      .then(showDevTools)
      .catch(() => {
        if (--retries > 0) {
          setTimeout(tryConnect, 1000);
        } else {
          mainWindow.loadURL('data:text/html;charset=utf-8,' +
            encodeURIComponent(
              '<html><body style="background:#1a1a2e;color:#e8e8e8;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">' +
              '<div style="text-align:center">' +
              '<h2>Vite dev server not running</h2>' +
              '<p style="color:#a0a0b0">Run <code style="background:#2d3340;padding:4px 8px;border-radius:4px">npm run dev</code> in the client directory first.</p>' +
              '</div></body></html>'
            )
          );
        }
      });
  };

  tryConnect();
}

app.whenReady().then(() => {
  createWindow();
  buildApplicationMenu();
});

app.on('window-all-closed', () => {
  for (const key of Object.keys(terminalProcesses)) {
    terminalProcesses[key].kill();
  }
  terminalProcesses = {};
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
  if (!Menu.getApplicationMenu()) buildApplicationMenu();
});

// --- Terminal IPC for local mode (node-pty) ---

function getShell() {
  if (process.platform === 'win32') return 'cmd.exe';
  
  const shells = [
    process.env.SHELL,
    '/bin/zsh',
    '/bin/bash',
    '/usr/bin/zsh',
    '/usr/bin/bash',
    '/bin/sh'
  ];

  for (const s of shells) {
    if (s && fs.existsSync(s)) return s;
  }
  
  return '/bin/sh';
}

let pty;
let ptyError;
try {
  pty = require('node-pty');
} catch (e) {
  ptyError = e.message;
  console.error('node-pty not available, terminal will not work:', e.message);
}

ipcMain.handle('terminal:isPtyAvailable', () => {
  return { available: !!pty, error: ptyError };
});

ipcMain.handle('terminal:create', (event, terminalId, cwd) => {
  console.log(`[Terminal] Creating terminal "${terminalId}" at "${cwd || 'default'}"`);
  
  const shell = getShell();
  console.log(`[Terminal] Using shell: ${shell}`);
  let defaultCwd = cwd || os.homedir();
  
  // Verify CWD exists, fallback to home if not
  if (!fs.existsSync(defaultCwd)) {
    console.warn(`[Terminal] CWD "${defaultCwd}" does not exist, falling back to home directory`);
    defaultCwd = os.homedir();
  }

  // Kill existing process with same ID if any
  if (terminalProcesses[terminalId]) {
    console.log(`[Terminal] Killing existing process for ID "${terminalId}"`);
    try {
      const oldProc = terminalProcesses[terminalId];
      if (typeof oldProc.kill === 'function') oldProc.kill();
      else if (typeof oldProc.kill === 'number') process.kill(oldProc.kill);
    } catch (e) {
      console.error(`[Terminal] Failed to kill old terminal process: ${e.message}`);
    }
    delete terminalProcesses[terminalId];
  }
  const cols = 80;
  const rows = 24;

  try {
    if (pty) {
      console.log(`[Terminal] Spawning PTY with node-pty`);
      const term = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols,
        rows,
        cwd: defaultCwd,
        env: { ...process.env, TERM: 'xterm-256color' },
      });

      terminalProcesses[terminalId] = term;

      term.onData((data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('terminal:data', terminalId, data);
        }
      });

      term.onExit(() => {
        console.log(`[Terminal] Process for ID "${terminalId}" exited`);
        if (terminalProcesses[terminalId] === term) {
          delete terminalProcesses[terminalId];
        }
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('terminal:exit', terminalId);
        }
      });
    } else {
      console.warn(`[Terminal] node-pty not available, falling back to child_process.spawn`);
      // Fallback: spawn without PTY (basic, no TUI support)
      const { spawn } = require('child_process');
      const proc = spawn(shell, [], {
        cwd: defaultCwd,
        env: { ...process.env, TERM: 'xterm-256color' },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      terminalProcesses[terminalId] = proc;

      proc.stdout.on('data', (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('terminal:data', terminalId, data.toString());
        }
      });

      proc.stderr.on('data', (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('terminal:data', terminalId, data.toString());
        }
      });

      proc.on('exit', () => {
        console.log(`[Terminal] Fallback process for ID "${terminalId}" exited`);
        if (terminalProcesses[terminalId] === proc) {
          delete terminalProcesses[terminalId];
        }
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('terminal:exit', terminalId);
        }
      });
    }
  } catch (err) {
    console.error(`[Terminal] Creation failed:`, err);
    throw new Error(`Failed to create terminal: ${err.message}`);
  }

  return true;
});

ipcMain.handle('terminal:write', (event, terminalId, data) => {
  const proc = terminalProcesses[terminalId];
  if (proc) {
    try {
      if (typeof proc.write === 'function') {
        proc.write(data);
      } else if (proc.stdin && proc.stdin.writable) {
        proc.stdin.write(data);
      }
    } catch (e) {
      console.error('Terminal write error:', e.message);
    }
  }
});

ipcMain.handle('terminal:resize', (event, terminalId, cols, rows) => {
  const proc = terminalProcesses[terminalId];
  if (proc && typeof proc.resize === 'function') {
    try {
      cols = Math.max(cols, 1);
      rows = Math.max(rows, 1);
      proc.resize(cols, rows);
    } catch (e) {
      console.error('resize error:', e.message);
    }
  }
});

ipcMain.handle('terminal:kill', (event, terminalId) => {
  const proc = terminalProcesses[terminalId];
  if (proc) {
    if (typeof proc.kill === 'function') {
      try { proc.kill(); } catch {}
    } else if (typeof proc.kill === 'number') {
      try { process.kill(proc.kill); } catch {}
    }
    delete terminalProcesses[terminalId];
  }
});

ipcMain.handle('terminal:killAll', () => {
  for (const key of Object.keys(terminalProcesses)) {
    const proc = terminalProcesses[key];
    if (typeof proc.kill === 'function') {
      try { proc.kill(); } catch {}
    } else if (typeof proc.kill === 'number') {
      try { process.kill(proc.kill); } catch {}
    }
  }
  terminalProcesses = {};
});

// --- Code execution IPC ---

// --- File system IPC for local mode ---

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Choose a folder for your projects',
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('select-project-directory', async (event, projectName) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: `Choose a folder for project "${projectName}"`,
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('file:read', async (event, filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
});

ipcMain.handle('file:write', async (event, filePath, content) => {
  try {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('file:remove', async (event, targetPath) => {
  try {
    fs.rmSync(targetPath, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('file:rename', async (event, oldPath, newPath) => {
  try {
    fs.renameSync(oldPath, newPath);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('file:list', async (event, dirPath) => {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries.map(e => ({ name: e.name, isDirectory: e.isDirectory() }));
  } catch {
    return [];
  }
});

ipcMain.handle('file:exists', async (event, filePath) => {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
});

ipcMain.handle('file:mkdir', async (event, dirPath) => {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('file:listRecursive', async (event, dirPath) => {
  const results = [];
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const fullPath = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(fullPath);
      } else if (e.isFile()) {
        results.push(fullPath);
      }
    }
  }
  walk(dirPath);
  return results;
});

ipcMain.handle('execute:run', async (event, { language, sourceCode }) => {
  return new Promise((resolve) => {
    let command;
    switch (language) {
      case 'javascript':
        command = `node -e ${JSON.stringify(sourceCode)}`;
        break;
      case 'typescript':
        command = `npx tsx -e ${JSON.stringify(sourceCode)}`;
        break;
      case 'python':
        command = `python3 -c ${JSON.stringify(sourceCode)}`;
        break;
      default:
        resolve({ stdout: '', stderr: `Unsupported language: ${language}`, output: `Unsupported language: ${language}`, code: 1, signal: null });
        return;
    }

    exec(command, { timeout: 10000 }, (err, stdout, stderr) => {
      const output = stdout + (stderr ? '\n' + stderr : '');
      resolve({
        stdout,
        stderr,
        output,
        code: err ? (err.code || 1) : 0,
        signal: err ? (err.signal || null) : null,
      });
    });
  });
});
