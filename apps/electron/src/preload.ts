/**
 * Electron preload — exposes a safe IPC bridge to the renderer (display page).
 * The display page runs as a normal web page; it calls window.electronBridge.*
 */

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronBridge', {
  // Config
  getConfig:  () => ipcRenderer.invoke('get-config'),
  saveConfig: (cfg: any) => ipcRenderer.invoke('save-config', cfg),

  // Offline route cache
  cacheRoute:      (route: any)     => ipcRenderer.invoke('cache-route', route),
  getCachedRoute:  (routeId: string) => ipcRenderer.invoke('get-cached-route', routeId),

  // LAN events pushed from main process
  onLanButton: (cb: (data: { button: string }) => void) =>
    ipcRenderer.on('lan:button', (_e, data) => cb(data)),

  onLanGps: (cb: (point: any) => void) =>
    ipcRenderer.on('lan:gps', (_e, point) => cb(point)),

  onLanSession: (cb: (data: { sessionId: string }) => void) =>
    ipcRenderer.on('lan:session', (_e, data) => cb(data)),

  // Remove listeners on cleanup
  removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel),
});
