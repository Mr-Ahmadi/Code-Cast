const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,

  terminal: {
    isPtyAvailable: () => ipcRenderer.invoke('terminal:isPtyAvailable'),
    create: (terminalId, cwd, dimensions) => ipcRenderer.invoke('terminal:create', terminalId, cwd, dimensions),
    write: (terminalId, data) => ipcRenderer.invoke('terminal:write', terminalId, data),
    resize: (terminalId, cols, rows) => ipcRenderer.invoke('terminal:resize', terminalId, cols, rows),
    kill: (terminalId) => ipcRenderer.invoke('terminal:kill', terminalId),
    killAll: () => ipcRenderer.invoke('terminal:killAll'),
    onData: (callback) => {
      const handler = (_event, terminalId, data) => callback(terminalId, data);
      ipcRenderer.on('terminal:data', handler);
      return () => ipcRenderer.removeListener('terminal:data', handler);
    },
    onExit: (callback) => {
      const handler = (_event, terminalId) => callback(terminalId);
      ipcRenderer.on('terminal:exit', handler);
      return () => ipcRenderer.removeListener('terminal:exit', handler);
    },
  },

  execute: {
    run: (options) => ipcRenderer.invoke('execute:run', options),
  },

  appMenu: {
    onAction: (callback) => {
      const handler = (_event, action) => callback(action);
      ipcRenderer.on('app-menu:action', handler);
      return () => ipcRenderer.removeListener('app-menu:action', handler);
    },
    onBeforeClose: (callback) => {
      const handler = () => callback();
      ipcRenderer.on('app:before-close', handler);
      return () => ipcRenderer.removeListener('app:before-close', handler);
    },
    closeWindow: () => ipcRenderer.send('app:close-window'),
  },

  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    setResizable: (resizable) => ipcRenderer.invoke('window:setResizable', resizable),
  },

  file: {
    selectOpenFile: (options) => ipcRenderer.invoke('file:selectOpenFile', options),
    selectDirectory: () => ipcRenderer.invoke('select-directory'),
    selectProjectDirectory: (projectName) => ipcRenderer.invoke('select-project-directory', projectName),
    selectSaveFile: (options) => ipcRenderer.invoke('select-save-file', options),
    read: (filePath) => ipcRenderer.invoke('file:read', filePath),
    write: (filePath, content) => ipcRenderer.invoke('file:write', filePath, content),
    rename: (oldPath, newPath) => ipcRenderer.invoke('file:rename', oldPath, newPath),
    remove: (targetPath) => ipcRenderer.invoke('file:remove', targetPath),
    list: (dirPath) => ipcRenderer.invoke('file:list', dirPath),
    exists: (filePath) => ipcRenderer.invoke('file:exists', filePath),
    mkdir: (dirPath) => ipcRenderer.invoke('file:mkdir', dirPath),
    listRecursive: (dirPath, filter) => ipcRenderer.invoke('file:listRecursive', dirPath, filter),
    watchDir: (dirPath) => ipcRenderer.invoke('file:watchDir', dirPath),
    unwatchDir: (dirPath) => ipcRenderer.invoke('file:unwatchDir', dirPath),
    watchFile: (filePath) => ipcRenderer.invoke('file:watchFile', filePath),
    unwatchFile: (filePath) => ipcRenderer.invoke('file:unwatchFile', filePath),
    unwatchAll: () => ipcRenderer.invoke('file:unwatchAll'),
    onDirChanged: (callback) => {
      const handler = (_event, dirPath) => callback(dirPath);
      ipcRenderer.on('file:dir-changed', handler);
      return () => ipcRenderer.removeListener('file:dir-changed', handler);
    },
    onFileChanged: (callback) => {
      const handler = (_event, filePath) => callback(filePath);
      ipcRenderer.on('file:file-changed', handler);
      return () => ipcRenderer.removeListener('file:file-changed', handler);
    },
  },

  path: {
    join: (...args) => args.join(process.platform === 'win32' ? '\\' : '/'),
    basename: (p) => p.split(/[\\/]/).pop(),
    dirname: (p) => p.split(/[\\/]/).slice(0, -1).join(process.platform === 'win32' ? '\\' : '/'),
  },
});
