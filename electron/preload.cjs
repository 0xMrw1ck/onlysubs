const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('studio', {
  pickVideo: () => ipcRenderer.invoke('pick-video'),
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  pickExportFolder: () => ipcRenderer.invoke('pick-export-folder'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  analyse: (input) => ipcRenderer.invoke('analyse', input),
  exportClips: (input) => ipcRenderer.invoke('export-clips', input),
  onProgress: (callback) => ipcRenderer.on('job-progress', (_, update) => callback(update))
})
