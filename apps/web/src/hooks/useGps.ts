/**
 * useGps — always-on GPS hook for the driver PWA
 *
 * Guarantees:
 *  1. Screen Wake Lock → screen never sleeps while this hook is active
 *  2. watchPosition with high accuracy, max age 0
 *  3. Re-acquire Wake Lock on visibilitychange (it drops when tab hides)
 *  4. Queues points in IndexedDB when offline; syncs when back online
 *  5. Calls onPoint for every fix (used to push to display LAN + cloud)
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { GpsPoint } from '@adkerala/types';

interface Options {
  onPoint:  (point: GpsPoint) => void;
  onError?: (err: GeolocationPositionError) => void;
  minAccuracy?: number; // metres — ignore junk fixes above this
}

export function useGps({ onPoint, onError, minAccuracy = 100 }: Options) {
  const watchId    = useRef<number | null>(null);
  const wakeLock   = useRef<WakeLockSentinel | null>(null);
  const onPointRef = useRef(onPoint);

  // Keep callback ref up to date without re-registering watchPosition
  useEffect(() => { onPointRef.current = onPoint; }, [onPoint]);

  // ── Screen Wake Lock ──────────────────────────────────────────────────────
  const acquireWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLock.current = await navigator.wakeLock.request('screen');
      console.log('[GPS] Wake lock acquired');
    } catch (e) {
      console.warn('[GPS] Wake lock failed', e);
    }
  }, []);

  // Re-acquire when tab becomes visible again (wake lock drops on hide)
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') acquireWakeLock();
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [acquireWakeLock]);

  // ── GPS watchPosition ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) {
      console.error('[GPS] Geolocation not supported');
      return;
    }

    acquireWakeLock();

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (pos.coords.accuracy > minAccuracy) return; // discard poor fixes

        const point: GpsPoint = {
          lat:       pos.coords.latitude,
          lng:       pos.coords.longitude,
          accuracy:  pos.coords.accuracy,
          speed:     pos.coords.speed   ?? undefined,
          heading:   pos.coords.heading ?? undefined,
          timestamp: pos.timestamp,
        };

        onPointRef.current(point);
        queueGpsPoint(point); // IndexedDB queue for offline sync
      },
      (err) => {
        console.warn('[GPS] Error', err.code, err.message);
        onError?.(err);
      },
      {
        enableHighAccuracy: true,
        timeout:            10_000,
        maximumAge:         0,      // never use cached position
      }
    );

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      wakeLock.current?.release().catch(() => {});
      wakeLock.current = null;
    };
  }, []); // mount once
}

// ── IndexedDB GPS queue ───────────────────────────────────────────────────────

const DB_NAME    = 'adkerala-gps';
const STORE_NAME = 'queue';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME, { autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function queueGpsPoint(point: GpsPoint) {
  try {
    const db  = await openDb();
    const tx  = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).add(point);
  } catch { /* non-critical */ }
}

/** Called by the app when cloud socket reconnects — drains queue and sends */
export async function drainGpsQueue(): Promise<GpsPoint[]> {
  try {
    const db    = await openDb();
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve) => {
      const points: GpsPoint[] = [];
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          points.push(cursor.value);
          cursor.delete();
          cursor.continue();
        } else {
          resolve(points);
        }
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}
