/**
 * SQLite offline cache for display device.
 * Stores: routes + stops, GPS buffer, pending impression queue.
 */

import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

let db: ReturnType<typeof Database>;

export function initDb() {
  const dbPath = path.join(app.getPath('userData'), 'adkerala.db');
  db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS routes (
      id      TEXT PRIMARY KEY,
      data    TEXT NOT NULL,
      cached_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gps_buffer (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      lat        REAL NOT NULL,
      lng        REAL NOT NULL,
      accuracy   REAL,
      speed      REAL,
      heading    REAL,
      ts         INTEGER NOT NULL,
      synced     INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS impression_queue (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      data  TEXT NOT NULL,
      synced INTEGER DEFAULT 0
    );
  `);

  console.log('[DB] SQLite ready at', dbPath);
}

// ── Route cache ───────────────────────────────────────────────────────────────

export function cacheRoute(routeData: any) {
  db.prepare(`
    INSERT OR REPLACE INTO routes (id, data, cached_at) VALUES (?, ?, ?)
  `).run(routeData.id, JSON.stringify(routeData), Date.now());
}

export function getCachedRoute(routeId: string): any | null {
  const row = db.prepare('SELECT data FROM routes WHERE id = ?').get(routeId) as any;
  return row ? JSON.parse(row.data) : null;
}

// ── GPS buffer ────────────────────────────────────────────────────────────────

export function bufferGpsPoint(point: { lat: number; lng: number; accuracy?: number; speed?: number; heading?: number; timestamp: number }) {
  db.prepare(`
    INSERT INTO gps_buffer (lat, lng, accuracy, speed, heading, ts)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(point.lat, point.lng, point.accuracy ?? null, point.speed ?? null, point.heading ?? null, point.timestamp);
}

export function drainGpsBuffer(): any[] {
  const rows = db.prepare('SELECT * FROM gps_buffer WHERE synced = 0 ORDER BY ts ASC LIMIT 500').all();
  if (rows.length) {
    const ids = (rows as any[]).map(r => r.id);
    db.prepare(`UPDATE gps_buffer SET synced = 1 WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids);
  }
  return rows;
}

// ── Impression queue (for offline buffering) ──────────────────────────────────

export function queueImpression(payload: any) {
  db.prepare('INSERT INTO impression_queue (data) VALUES (?)').run(JSON.stringify(payload));
}

export function drainImpressionQueue(): any[] {
  const rows = db.prepare('SELECT * FROM impression_queue WHERE synced = 0 LIMIT 100').all() as any[];
  if (rows.length) {
    const ids = rows.map(r => r.id);
    db.prepare(`UPDATE impression_queue SET synced = 1 WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids);
  }
  return rows.map(r => JSON.parse(r.data));
}
