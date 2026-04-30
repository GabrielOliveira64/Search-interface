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

  onStatus: (cb) => ipcRenderer.on('status', (_, data) => cb(data)),
  onLog:    (cb) => ipcRenderer.on('log',    (_, line) => cb(line)),
  onTick:   (cb) => ipcRenderer.on('tick',   (_, secs) => cb(secs)),
});
