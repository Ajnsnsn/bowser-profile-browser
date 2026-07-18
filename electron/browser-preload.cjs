const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('browserControls', {
  back: () => ipcRenderer.invoke('browser:back'),
  forward: () => ipcRenderer.invoke('browser:forward'),
  reloadOrStop: () => ipcRenderer.invoke('browser:reload-or-stop'),
  home: () => ipcRenderer.invoke('browser:home'),
  navigate: (url) => ipcRenderer.invoke('browser:navigate', url),
  onStateChanged: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('browser:state', listener);
    return () => ipcRenderer.removeListener('browser:state', listener);
  },
  onFocusLocation: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('browser:focus-location', listener);
    return () => ipcRenderer.removeListener('browser:focus-location', listener);
  },
});
