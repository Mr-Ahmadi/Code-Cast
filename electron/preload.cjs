const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  terminal: {
    create: (terminalId) => ipcRenderer.invoke('terminal:create', terminalId),
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

  file: {
    selectDirectory: () => ipcRenderer.invoke('select-directory'),
    read: (filePath) => ipcRenderer.invoke('file:read', filePath),
    write: (filePath, content) => ipcRenderer.invoke('file:write', filePath, content),
    remove: (targetPath) => ipcRenderer.invoke('file:remove', targetPath),
    list: (dirPath) => ipcRenderer.invoke('file:list', dirPath),
    exists: (filePath) => ipcRenderer.invoke('file:exists', filePath),
    mkdir: (dirPath) => ipcRenderer.invoke('file:mkdir', dirPath),
  },
});
