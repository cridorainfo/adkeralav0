/**
 * adkerala Display — Electron main process
 *
 * Responsibilities:
 *  1. Open fullscreen BrowserWindow loading the display page from cloud
 *  2. Serve local WebSocket :8765 for ESP32 button events
 *  3. Serve local WebSocket :8766 for driver phone GPS + button commands
 *  4. Advertise both via mDNS (Bonjour) so devices discover without fixed IP
 *  5. Local SQLite cache: route/stops/ads for offline operation
 *  6. Forward button/GPS events to the display page via IPC
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { Bonjour } from 'bonjour-service';
import Store from 'electron-store';
import { initDb, cacheRoute, getCachedRoute } from './db';
import type { LanMessage } from '@adkerala/types';

const store = new Store<{ busId: string; displayToken: string; cloudUrl: string }>();

let mainWindow: BrowserWindow | null = null;

// ── App config (set during setup / first run) ─────────────────────────────────
const BUS_ID       = store.get('busId',       '');
const DISPLAY_TOKEN = store.get('displayToken', '');
const CLOUD_URL    = store.get('cloudUrl',    'https://adkerala-production.up.railway.app');

const DISPLAY_URL  = BUS_ID
  ? `${CLOUD_URL}/display?busId=${BUS_ID}&token=${DISPLAY_TOKEN}`
  : `${CLOUD_URL}/display/setup`;

// ── Electron window ───────────────────────────────────────────────────────────
app.whenReady().then(() => {
  initDb();

  mainWindow = new BrowserWindow({
    fullscreen: true,
    frame:      false,
    webPreferences: {
      preload:         path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(DISPLAY_URL);
  mainWindow.on('closed', () => { mainWindow = null; });

  startLocalServers();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ── Local WebSocket servers ────────────────────────────────────────────────────

function startLocalServers() {
  // Port 8765 — ESP32 button events
  const esp32Server = new WebSocketServer({ port: 8765 });
  esp32Server.on('connection', handleESP32);

  // Port 8766 — driver phone (GPS + button commands over LAN)
  const driverServer = new WebSocketServer({ port: 8766 });
  driverServer.on('connection', handleDriver);

  // Advertise via mDNS
  const bonjour = new Bonjour();
  bonjour.publish({ name: 'adkerala-display', type: 'ws', port: 8765 });
  bonjour.publish({ name: 'adkerala-driver',  type: 'ws', port: 8766 });

  console.log('[LAN] ESP32 WS on :8765, Driver WS on :8766, mDNS published');
}

// ── ESP32 handler ─────────────────────────────────────────────────────────────

function handleESP32(ws: WebSocket) {
  console.log('[ESP32] connected');

  ws.on('message', (raw) => {
    try {
      const msg: LanMessage = JSON.parse(raw.toString());
      if (msg.type === 'btn' && msg.button) {
        console.log(`[ESP32] button: ${msg.button}`);
        // Forward to display renderer via IPC
        mainWindow?.webContents.send('lan:button', { button: msg.button });
        ws.send(JSON.stringify({ type: 'ack', ts: Date.now() }));
      }
      if (msg.type === 'heartbeat') {
        ws.send(JSON.stringify({ type: 'ack', ts: Date.now() }));
      }
    } catch { /* ignore malformed */ }
  });

  ws.on('close', () => console.log('[ESP32] disconnected'));
}

// ── Driver phone handler ──────────────────────────────────────────────────────

function handleDriver(ws: WebSocket) {
  console.log('[Driver LAN] connected');

  ws.on('message', (raw) => {
    try {
      const msg: LanMessage = JSON.parse(raw.toString());

      if (msg.type === 'gps' && msg.point) {
        mainWindow?.webContents.send('lan:gps', msg.point);
        ws.send(JSON.stringify({ type: 'ack', ts: Date.now() }));
      }

      if (msg.type === 'btn' && msg.button) {
        mainWindow?.webContents.send('lan:button', { button: msg.button });
        ws.send(JSON.stringify({ type: 'ack', ts: Date.now() }));
      }

      if (msg.type === 'session') {
        mainWindow?.webContents.send('lan:session', { sessionId: msg.sessionId });
        ws.send(JSON.stringify({ type: 'ack', ts: Date.now() }));
      }
    } catch { /* ignore */ }
  });

  ws.on('close', () => console.log('[Driver LAN] disconnected'));
}

// ── IPC: renderer asks for config ─────────────────────────────────────────────

ipcMain.handle('get-config', () => ({
  busId:        BUS_ID,
  displayToken: DISPLAY_TOKEN,
  cloudUrl:     CLOUD_URL,
}));

ipcMain.handle('save-config', (_event, config: { busId: string; displayToken: string; cloudUrl: string }) => {
  store.set('busId',        config.busId);
  store.set('displayToken', config.displayToken);
  store.set('cloudUrl',     config.cloudUrl);
  app.relaunch();
  app.quit();
});

// ── Offline route cache (IPC) ─────────────────────────────────────────────────

ipcMain.handle('cache-route', (_event, routeData: any) => {
  cacheRoute(routeData);
});

ipcMain.handle('get-cached-route', (_event, routeId: string) => {
  return getCachedRoute(routeId);
});
