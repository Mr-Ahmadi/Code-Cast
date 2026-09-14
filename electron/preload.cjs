const { contextBridge, ipcRenderer } = require('electron');

// One listener routes streamed AI chunks to the request that asked for them.
const aiChunkHandlers = new Map();
ipcRenderer.on('ai:chunk', (_event, requestId, chunk) => {
  aiChunkHandlers.get(requestId)?.(chunk);
});

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,

  ai: {
    fetch: async (requestId, request, onChunk) => {
      if (typeof onChunk === 'function') aiChunkHandlers.set(requestId, onChunk);
      try {
        return await ipcRenderer.invoke('ai:fetch', requestId, request);
      } finally {
        aiChunkHandlers.delete(requestId);
      }
    },
    abort: (requestId) => ipcRenderer.invoke('ai:abort', requestId),
  },

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

  formatter: {
    format: (formatterId, language, sourceCode) => ipcRenderer.invoke('formatter:format', formatterId, language, sourceCode),
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
    readBase64: (filePath) => ipcRenderer.invoke('file:readBase64', filePath),
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

  git: {
    exec: (cwd, args) => ipcRenderer.invoke('git:exec', cwd, args),
  },

  shell: {
    exec: (cwd, command) => ipcRenderer.invoke('shell:exec', cwd, command),
  },

  path: {
    join: (...args) => args.join(process.platform === 'win32' ? '\\' : '/'),
    basename: (p) => p.split(/[\\/]/).pop(),
    dirname: (p) => p.split(/[\\/]/).slice(0, -1).join(process.platform === 'win32' ? '\\' : '/'),
  },
});
