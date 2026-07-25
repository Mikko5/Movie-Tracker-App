const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    send: (channel, ...args) => ipcRenderer.send(channel, ...args),
    onJsonUpdated: (callback) => ipcRenderer.on('json-updated', callback),
    onUpdaterStatus: (callback) => ipcRenderer.on('updater-status', (event, data) => callback(data)),
});
