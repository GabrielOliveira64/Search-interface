const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('portal', {
  getStatus:    ()       => ipcRenderer.invoke('get-status'),
  getLogs:      ()       => ipcRenderer.invoke('get-logs'),
  startServer:  ()       => ipcRenderer.invoke('start-server'),
  stopServer:   ()       => ipcRenderer.invoke('stop-server'),
  setPort:      (port)   => ipcRenderer.invoke('set-port', port),
  setAutostart: (enable) => ipcRenderer.invoke('set-autostart', enable),
  openPortal:   ()       => ipcRenderer.invoke('open-portal'),
  openFolder:   ()       => ipcRenderer.invoke('open-folder'),
  minimizePanel:()       => ipcRenderer.invoke('minimize-panel'),
  closeApp:     ()       => ipcRenderer.invoke('close-app'),

  // Update
  checkUpdate:    () => ipcRenderer.invoke('check-update'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  restartApp:     () => ipcRenderer.invoke('restart-app'),

  onStatus:       (cb) => ipcRenderer.on('status',        (_, d) => cb(d)),
  onLog:          (cb) => ipcRenderer.on('log',           (_, l) => cb(l)),
  onTick:         (cb) => ipcRenderer.on('tick',          (_, s) => cb(s)),
  onUpdateStatus: (cb) => ipcRenderer.on('update-status', (_, d) => cb(d)),
});
