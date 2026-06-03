import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, exec } from 'child_process';
import { createServer } from 'net';
import os from 'os';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const __root = path.resolve(__dirname, '..');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow;
let terminalProcesses = {};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'Code Video',
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

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  for (const key of Object.keys(terminalProcesses)) {
    terminalProcesses[key].kill();
  }
  terminalProcesses = {};
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// --- Terminal IPC for local mode ---

function getShell() {
  if (process.platform === 'win32') return 'cmd.exe';
  const shell = process.env.SHELL;
  if (shell) return shell;
  return '/bin/zsh';
}

ipcMain.handle('terminal:create', (event, terminalId, cwd) => {
  const shell = getShell();
  const defaultCwd = cwd || path.join(__dirname, '..', 'client');
  let shellProcess;

  if (process.platform === 'win32') {
    shellProcess = spawn('cmd.exe', [], { cwd: defaultCwd, env: { ...process.env, TERM: 'xterm-256color' } });
  } else {
    // Use Python's pty module to create a real PTY — avoids stdout buffering, gives TTY echo/prompt
    // Use SHELL env var so we don't need to embed the path in Python string
    const pythonCmd = `import pty,os; pty.spawn([os.environ.get('SHELL','/bin/zsh'),'-i'])`;
    shellProcess = spawn('python3', ['-c', pythonCmd], {
      cwd: defaultCwd,
      env: { ...process.env, TERM: 'xterm-256color' },
    });
  }

  terminalProcesses[terminalId] = shellProcess;

  shellProcess.stdout.on('data', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('terminal:data', terminalId, data.toString());
    }
  });

  shellProcess.stderr.on('data', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('terminal:data', terminalId, data.toString());
    }
  });

  shellProcess.on('exit', () => {
    delete terminalProcesses[terminalId];
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('terminal:exit', terminalId);
    }
  });

  return true;
});

ipcMain.handle('terminal:write', (event, terminalId, data) => {
  const proc = terminalProcesses[terminalId];
  if (proc) {
    proc.stdin.write(data);
  }
});

ipcMain.handle('terminal:resize', (event, terminalId, cols, rows) => {
  // no-op for now
});

ipcMain.handle('terminal:kill', (event, terminalId) => {
  const proc = terminalProcesses[terminalId];
  if (proc) {
    proc.kill();
    delete terminalProcesses[terminalId];
  }
});

ipcMain.handle('terminal:killAll', () => {
  for (const key of Object.keys(terminalProcesses)) {
    terminalProcesses[key].kill();
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
