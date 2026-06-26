const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const { exec, execSync, spawn } = require('child_process');
const os = require('os');
const fs = require('fs');

const isPackaged = app.isPackaged;
const electronParent = path.resolve(__dirname, '..');
const isCopiedIntoClient = !isPackaged
  && fs.existsSync(path.join(electronParent, 'package.json'))
  && fs.existsSync(path.join(electronParent, 'index.html'));
const __root = isPackaged
  ? app.getAppPath()
  : isCopiedIntoClient
    ? path.resolve(electronParent, '..')
    : electronParent;
const clientRoot = isCopiedIntoClient ? electronParent : path.join(__root, 'client');

const iconPath = app.isPackaged
  ? path.join(__root, 'dist', 'codecast-256.png')
  : path.join(clientRoot, 'public', 'codecast-256.png');
const rendererIndexPath = path.join(__root, 'dist', 'index.html');

let prettier;
try {
  prettier = require('prettier');
} catch {}

const isDev = process.env.NODE_ENV === 'development' || !isPackaged;

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
          label: 'New File',
          accelerator: 'CmdOrCtrl+N',
          click: () => sendMenuAction('new-file'),
        },
        {
          label: 'Open Project…',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendMenuAction('open-project'),
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendMenuAction('save-file'),
        },
        {
          label: 'Save As…',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => sendMenuAction('save-file-as'),
        },
        {
          label: 'Save All',
          accelerator: 'CmdOrCtrl+Alt+S',
          click: () => sendMenuAction('save-all-files'),
        },
        {
          label: 'Toggle Auto Save',
          click: () => sendMenuAction('toggle-auto-save'),
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
          label: 'Find',
          accelerator: 'CmdOrCtrl+F',
          click: () => sendMenuAction('find'),
        },
        {
          label: 'Replace',
          accelerator: 'CmdOrCtrl+Alt+F',
          click: () => sendMenuAction('replace'),
        },
        { type: 'separator' },
        {
          label: 'Speech',
          submenu: [{ role: 'startSpeaking' }, { role: 'stopSpeaking' }],
        },
      ],
    },
    {
      label: 'Selection',
      submenu: [
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Expand Selection',
          accelerator: 'Shift+Alt+Right',
          click: () => sendMenuAction('expand-selection'),
        },
        {
          label: 'Shrink Selection',
          accelerator: 'Shift+Alt+Left',
          click: () => sendMenuAction('shrink-selection'),
        },
        { type: 'separator' },
        {
          label: 'Add Cursor Above',
          accelerator: 'CmdOrCtrl+Alt+Up',
          click: () => sendMenuAction('add-cursor-above'),
        },
        {
          label: 'Add Cursor Below',
          accelerator: 'CmdOrCtrl+Alt+Down',
          click: () => sendMenuAction('add-cursor-below'),
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Explorer',
          accelerator: 'CmdOrCtrl+B',
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
        {
          label: 'Increase Editor Font Size',
          accelerator: 'CmdOrCtrl+=',
          click: () => sendMenuAction('increase-font-size'),
        },
        {
          label: 'Decrease Editor Font Size',
          accelerator: 'CmdOrCtrl+-',
          click: () => sendMenuAction('decrease-font-size'),
        },
        {
          label: 'Reset Editor Font Size',
          accelerator: 'CmdOrCtrl+0',
          click: () => sendMenuAction('reset-font-size'),
        },
        {
          label: 'Toggle Theme',
          accelerator: 'CmdOrCtrl+Alt+T',
          click: () => sendMenuAction('toggle-theme'),
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Go',
      submenu: [
        {
          label: 'Go to Line/Column…',
          accelerator: 'CmdOrCtrl+G',
          click: () => sendMenuAction('go-to-line'),
        },
        {
          label: 'Go to Symbol…',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => sendMenuAction('go-to-symbol'),
        },
        {
          label: 'Go to Bracket',
          accelerator: 'CmdOrCtrl+Shift+\\',
          click: () => sendMenuAction('go-to-bracket'),
        },
      ],
    },
    {
      label: 'Format',
      submenu: [
        {
          label: 'Format Document',
          accelerator: 'Shift+Alt+F',
          click: () => sendMenuAction('format-document'),
        },
        {
          label: 'Toggle Format on Save',
          click: () => sendMenuAction('toggle-format-on-save'),
        },
        { type: 'separator' },
        {
          label: 'Open Settings',
          click: () => sendMenuAction('open-settings'),
        },
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
          label: 'Toggle Terminal',
          accelerator: 'CmdOrCtrl+`',
          click: () => sendMenuAction('toggle-terminal'),
        },
        { type: 'separator' },
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
    icon: iconPath,
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
    mainWindow.loadFile(rendererIndexPath).catch((err) => {
      console.error('Failed to load renderer:', err);
      mainWindow.loadURL('data:text/html;charset=utf-8,' +
        encodeURIComponent(
          '<html><body style="background:#1a1a2e;color:#e8e8e8;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">' +
          '<div style="text-align:center">' +
          '<h2>Failed to load app</h2>' +
          '<p style="color:#a0a0b0">' + err.message + '</p>' +
          '</div></body></html>'
        )
      );
    });
    mainWindow.once('ready-to-show', () => mainWindow.show());
  }

  mainWindow.on('close', (e) => {
    if (global._quitting) return;
    e.preventDefault();
    mainWindow.webContents.send('app:before-close');
  });
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

ipcMain.on('app:close-window', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy();
  }
});

ipcMain.handle('window:setResizable', async (event, resizable) => {
  if (mainWindow) {
    mainWindow.setResizable(resizable);
  }
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

app.commandLine.appendSwitch('disable-features', 'PasswordManager');

app.whenReady().then(() => {
  createWindow();
  buildApplicationMenu();
});

app.on('before-quit', () => {
  global._quitting = true;
});

app.on('window-all-closed', () => {
  for (const key of Object.keys(terminalProcesses)) {
    terminalProcesses[key].kill();
  }
  terminalProcesses = {};
  for (const watcher of dirWatchers.values()) watcher.close();
  for (const watcher of fileWatchers.values()) watcher.close();
  dirWatchers.clear();
  fileWatchers.clear();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
  if (!Menu.getApplicationMenu()) buildApplicationMenu();
});

// --- Terminal IPC for local mode (node-pty) ---

function getShell() {
  if (process.platform === 'win32') return 'cmd.exe';

  let shell = process.env.SHELL;

  // Fallback to /etc/passwd if $SHELL is unset (VS Code approach)
  if (!shell) {
    try {
      shell = os.userInfo().shell;
    } catch (e) {
      /* ignore */
    }
  }

  // Some systems have $SHELL set to /bin/false which breaks the terminal (VS Code approach)
  if (shell === '/bin/false' || shell === '/usr/bin/false') {
    shell = null;
  }

  // Verify the shell exists and is executable
  if (shell) {
    try {
      fs.accessSync(shell, fs.constants.X_OK);
      return shell;
    } catch (e) {
      console.warn(`[Terminal] Shell "${shell}" not accessible, falling back`);
    }
  }

  // Try common shells
  const commonShells = ['/bin/zsh', '/bin/bash', '/usr/bin/zsh', '/usr/bin/bash', '/bin/sh'];
  for (const s of commonShells) {
    try {
      fs.accessSync(s, fs.constants.X_OK);
      return s;
    } catch (e) {
      /* skip */
    }
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

function normalizeTerminalDimensions(dimensions) {
  const cols = Number(dimensions?.cols);
  const rows = Number(dimensions?.rows);
  return {
    cols: Number.isFinite(cols) && cols > 0 ? Math.floor(cols) : 80,
    rows: Number.isFinite(rows) && rows > 0 ? Math.floor(rows) : 24,
  };
}

ipcMain.handle('terminal:create', (event, terminalId, cwd, dimensions) => {
  console.log(`[Terminal] Creating terminal "${terminalId}" at "${cwd || 'default'}"`);

  const shell = getShell();
  console.log(`[Terminal] Using shell: ${shell} (pty available: ${!!pty})`);
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
  const { cols, rows } = normalizeTerminalDimensions(dimensions);

  try {
    if (!pty) throw new Error('node-pty not available');

    console.log(`[Terminal] Spawning PTY with node-pty`);
    const term = pty.spawn(shell, process.platform !== 'win32' ? ['-i'] : [], {
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
  } catch (err) {
    console.warn(`[Terminal] PTY failed (${err.message}), trying fallback`);
    try {
      // Use -i for interactive mode to get a prompt
      const shellArgs = process.platform !== 'win32' ? ['-i'] : [];
      console.log(`[Terminal] Spawning fallback: ${shell} ${shellArgs.join(' ')}`);
      
      const proc = spawn(shell, shellArgs, {
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

      proc.on('exit', (code, signal) => {
        console.log(`[Terminal] Fallback process for ID "${terminalId}" exited (code: ${code}, signal: ${signal})`);
        if (terminalProcesses[terminalId] === proc) {
          delete terminalProcesses[terminalId];
        }
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('terminal:exit', terminalId);
        }
      });

      proc.on('error', (procErr) => {
        console.error(`[Terminal] Fallback process error for ID "${terminalId}":`, procErr);
        if (terminalProcesses[terminalId] === proc) {
          delete terminalProcesses[terminalId];
        }
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('terminal:data', terminalId, `\r\n\x1b[31mTerminal error: ${procErr.message}\x1b[0m\r\n`);
        }
      });

      console.log(`[Terminal] Fallback process spawned (PID: ${proc.pid})`);
    } catch (fallbackErr) {
      console.error(`[Terminal] Fallback also failed:`, fallbackErr);
      throw new Error(`Failed to create terminal: ${fallbackErr.message}`);
    }
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

// --- Formatter IPC for local mode ---

ipcMain.handle('formatter:format', async (event, formatterId, language, sourceCode) => {
  return new Promise((resolve) => {
    let cmd;
    let args;
    let parser;

    switch (formatterId) {
      case 'prettier':
        if (prettier) {
          parser = language;
          if (parser === 'javascript') parser = 'babel';
          if (parser === 'typescript') parser = 'typescript';
          try {
            prettier.format(sourceCode, { parser, filepath: `file.${language}` })
              .then(formatted => resolve({ error: null, formatted }))
              .catch(err => resolve({ error: err.message, formatted: null }));
          } catch (err) {
            resolve({ error: err.message, formatted: null });
          }
          return;
        }
        // Fallback to npx if prettier module isn't available
        parser = language;
        if (parser === 'javascript') parser = 'babel';
        if (parser === 'typescript') parser = 'typescript';
        cmd = 'npx';
        args = ['prettier', '--parser', parser, '--stdin-filepath', `file.${language}`];
        break;
      case 'black':
        cmd = 'black';
        args = ['-', '--quiet', '--line-length', '88'];
        break;
      case 'clang-format':
        cmd = 'clang-format';
        args = ['-style=file', '-assume-filename', `file.${language}`];
        break;
      case 'google-java-format':
        cmd = 'google-java-format';
        args = ['-'];
        break;
      case 'rustfmt':
        // rustfmt requires a file; write to temp and read back
        const tmpFile = path.join(os.tmpdir(), `codecast_${Date.now()}_fmt.rs`);
        fs.writeFileSync(tmpFile, sourceCode);
        const rustfmt = spawn('rustfmt', ['--edition', '2021', tmpFile], {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 30000,
        });
        rustfmt.on('close', (code) => {
          if (code === 0) {
            try {
              const formatted = fs.readFileSync(tmpFile, 'utf-8');
              fs.unlinkSync(tmpFile);
              resolve({ error: null, formatted });
            } catch (e) {
              resolve({ error: e.message, formatted: null });
            }
          } else {
            let errData = '';
            rustfmt.stderr.on('data', (d) => { errData += d; });
            rustfmt.on('error', (e) => { resolve({ error: e.message, formatted: null }); });
            rustfmt.on('close', () => {
              fs.unlink(tmpFile, () => {});
              resolve({ error: errData || `rustfmt exited with code ${code}`, formatted: null });
            });
          }
        });
        return;
      case 'gofmt':
        cmd = 'gofmt';
        args = [];
        break;
      default:
        resolve({ error: `Unknown formatter: ${formatterId}`, formatted: null });
        return;
    }

    const proc = spawn(cmd, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
      env: { ...process.env, PATH: process.env.PATH },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('error', (err) => {
      resolve({ error: `${formatterId} not found: ${err.message}. Is it installed?`, formatted: null });
    });

    proc.on('close', (code) => {
      if (code === 0 && stdout) {
        resolve({ error: null, formatted: stdout });
      } else {
        resolve({ error: stderr || `Formatter exited with code ${code}`, formatted: null });
      }
    });

    proc.stdin.write(sourceCode);
    proc.stdin.end();
  });
});

// --- Code execution IPC ---

// --- File system IPC for local mode ---

ipcMain.handle('file:selectOpenFile', async (event, options = {}) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: options.title || 'Open File',
    properties: ['openFile'],
    filters: Array.isArray(options.filters)
      ? options.filters
      : [{ name: 'CodeCast Recording', extensions: ['cvid'] }],
  });
  if (result.canceled) return null;
  const filePath = result.filePaths[0];
  const content = fs.readFileSync(filePath, 'utf-8');
  return { content, name: path.basename(filePath), filePath };
});

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

ipcMain.handle('select-save-file', async (event, options = {}) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: options.title || 'Save As',
    defaultPath: options.defaultPath || undefined,
    filters: Array.isArray(options.filters) ? options.filters : undefined,
    properties: ['showOverwriteConfirmation'],
  });
  if (result.canceled) return null;
  return result.filePath;
});

ipcMain.handle('file:read', async (event, filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
});

ipcMain.handle('file:readBase64', async (event, filePath) => {
  try {
    const data = fs.readFileSync(filePath);
    return data.toString('base64');
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

// Skip only dirs that are never user source and can contain 100k+ files
const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.svn', '.hg', '__pycache__',
]);

// --- File watching ---
const dirWatchers = new Map();
const fileWatchers = new Map();

ipcMain.handle('file:watchDir', async (event, dirPath) => {
  if (dirWatchers.has(dirPath)) return;
  try {
    if (!fs.existsSync(dirPath)) return;
    const watcher = fs.watch(dirPath, { recursive: true }, (eventType, filename) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('file:dir-changed', dirPath, eventType, filename);
      }
    });
    dirWatchers.set(dirPath, watcher);
  } catch (err) {
    console.warn('Failed to watch directory:', dirPath, err.message);
  }
});

ipcMain.handle('file:unwatchDir', (event, dirPath) => {
  const watcher = dirWatchers.get(dirPath);
  if (watcher) {
    watcher.close();
    dirWatchers.delete(dirPath);
  }
});

ipcMain.handle('file:watchFile', async (event, filePath) => {
  if (fileWatchers.has(filePath)) return;
  try {
    if (!fs.existsSync(filePath)) return;
    const watcher = fs.watch(filePath, (eventType) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('file:file-changed', filePath);
      }
    });
    fileWatchers.set(filePath, watcher);
  } catch (err) {
    console.warn('Failed to watch file:', filePath, err.message);
  }
});

ipcMain.handle('file:unwatchFile', (event, filePath) => {
  const watcher = fileWatchers.get(filePath);
  if (watcher) {
    watcher.close();
    fileWatchers.delete(filePath);
  }
});

ipcMain.handle('file:unwatchAll', () => {
  for (const watcher of dirWatchers.values()) watcher.close();
  for (const watcher of fileWatchers.values()) watcher.close();
  dirWatchers.clear();
  fileWatchers.clear();
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
      if (IGNORE_DIRS.has(e.name)) continue;
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

// --- Shell IPC for running arbitrary commands ---

ipcMain.handle('shell:exec', async (event, cwd, command) => {
  return new Promise((resolve) => {
    exec(command, { cwd, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({
        stdout: stdout || '',
        stderr: stderr || '',
        code: err ? (err.code || 1) : 0,
      });
    });
  });
});

// --- Git IPC for local mode ---

ipcMain.handle('git:exec', async (event, cwd, args) => {
  return new Promise((resolve) => {
    const quoted = args.map(a => `'${a.replace(/'/g, "'\\''")}'`).join(' ');
    const cmd = `git ${quoted}`;
    exec(cmd, { cwd, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({
        stdout: stdout || '',
        stderr: stderr || '',
        code: err ? (err.code || 1) : 0,
      });
    });
  });
});

// --- Opencode IPC for commit message generation ---

function findOpencode() {
  const commonPaths = [
    '/opt/homebrew/bin',
    '/usr/local/bin',
    path.join(os.homedir(), '.npm-global', 'bin'),
    path.join(os.homedir(), '.local', 'bin'),
  ];
  for (const dir of commonPaths) {
    const candidate = path.join(dir, 'opencode');
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {}
  }
  // Try resolving via npm root -g
  try {
    const npmRoot = execSync('npm root -g', { encoding: 'utf-8' }).trim();
    const candidate = path.join(path.dirname(npmRoot), 'opencode');
    fs.accessSync(candidate, fs.constants.X_OK);
    return candidate;
  } catch {}
  return 'opencode';
}

ipcMain.handle('opencode:listModels', async () => {
  return new Promise((resolve) => {
    const opencodeBin = findOpencode();
    const proc = spawn(opencodeBin, ['models'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });
    proc.on('close', (code) => {
      if (code !== 0) {
        resolve({ models: [], error: stderr || `opencode exited with code ${code}` });
        return;
      }
      const models = stdout.trim().split('\n').filter(Boolean).map(m => m.trim());
      resolve({ models, error: null });
    });
    proc.on('error', (err) => {
      resolve({ models: [], error: `opencode not found: ${err.message}. Is it installed?` });
    });
  });
});

ipcMain.handle('opencode:suggestCommit', async (event, cwd, model) => {
  return new Promise((resolve) => {
    exec('git diff --cached', { cwd, maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
      const diff = stdout || '';
      if (!diff.trim()) {
        resolve({ message: '', error: 'No staged changes found.' });
        return;
      }

      const prompt = `Generate a concise git commit message for these staged changes:\n\n${diff}\n\nOnly output the commit message, nothing else.`;
      const args = ['run', '--format', 'json'];
      if (model) {
        args.push('--model', model);
      }
      const opencodeBin = findOpencode();
      const proc = spawn(opencodeBin, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });

      let output = '';
      let errOutput = '';
      let message = '';

      proc.stdout.on('data', (data) => {
        output += data.toString();
        // Parse NDJSON events as they arrive
        const lines = output.split('\n');
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          try {
            const evt = JSON.parse(line);
            if (evt.type === 'text' && evt.part?.type === 'text') {
              message += evt.part.text;
            }
          } catch {}
        }
        output = lines[lines.length - 1];
      });

      proc.stderr.on('data', (data) => { errOutput += data.toString(); });

      proc.on('close', (code) => {
        // Parse any remaining data
        if (output.trim()) {
          try {
            const evt = JSON.parse(output.trim());
            if (evt.type === 'text' && evt.part?.type === 'text') {
              message += evt.part.text;
            }
          } catch {}
        }
        resolve({
          message: message.trim(),
          error: code !== 0 ? (errOutput || `opencode exited with code ${code}`) : null,
        });
      });

      proc.on('error', (err) => {
        resolve({ message: '', error: `opencode not found: ${err.message}. Is it installed?` });
      });

      proc.stdin.write(prompt);
      proc.stdin.end();
    });
  });
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
