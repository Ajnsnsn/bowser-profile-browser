const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bowser', {
  getState: () => ipcRenderer.invoke('app:get-state'),
  saveProfile: (profile) => ipcRenderer.invoke('profile:save', profile),
  duplicateProfile: (id) => ipcRenderer.invoke('profile:duplicate', id),
  deleteProfile: (id) => ipcRenderer.invoke('profile:delete', id),
  launchProfile: (id) => ipcRenderer.invoke('profile:launch', id),
  stopProfile: (id) => ipcRenderer.invoke('profile:stop', id),
  openDataFolder: () => ipcRenderer.invoke('app:open-data-folder'),
  importUserAgents: () => ipcRenderer.invoke('user-agents:import'),
  clearUserAgents: () => ipcRenderer.invoke('user-agents:clear'),
  onStateChanged: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('state:changed', listener);
    return () => ipcRenderer.removeListener('state:changed', listener);
  },
});
