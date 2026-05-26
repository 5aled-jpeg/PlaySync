const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  controlWindow: (command) => ipcRenderer.send('window-control', command),
  setAutostart: (enabled) => ipcRenderer.invoke('set-autostart', enabled),
  getAutostart: () => ipcRenderer.invoke('get-autostart')
});
