import type { GpsPoint, Stop } from '@adkerala/types';

// ─── Haversine Distance ───────────────────────────────────────────────────────

const EARTH_RADIUS_M = 6_371_000;

export function haversineMetres(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Geofence check ───────────────────────────────────────────────────────────

/**
 * Returns true if the GPS point is within the stop's geofence radius.
 * Default radius is 50 m if stop.geofenceRadius is not set.
 */
export function isWithinGeofence(point: GpsPoint, stop: Stop): boolean {
  const radius = stop.geofenceRadius ?? 50;
  return haversineMetres(point.lat, point.lng, stop.lat, stop.lng) <= radius;
}

// ─── Pairing code ─────────────────────────────────────────────────────────────

/** Generate a 6-digit numeric pairing code */
export function generatePairingCode(): string {
  return String(Math.floor(100_000 + Math.random() * 900_000));
}

// ─── Stop formatting ──────────────────────────────────────────────────────────

export function formatStopDisplay(stop: Stop | null): string {
  if (!stop) return '—';
  return stop.nameMl || stop.name;
}

// ─── Time helpers ─────────────────────────────────────────────────────────────

/** Returns HH:MM string from a Date (or now) */
export function toHHMM(date: Date = new Date()): string {
  return date.toTimeString().slice(0, 5);
}

/** Returns true if current time is within a campaign's time window */
export function isWithinTimeWindow(from: string | null, to: string | null): boolean {
  if (!from || !to) return true;
  const now = toHHMM();
  if (from <= to) return now >= from && now <= to;
  // overnight window e.g. 22:00 – 06:00
  return now >= from || now <= to;
}

// ─── GPS buffer ───────────────────────────────────────────────────────────────

/**
 * Simple ring buffer for GPS points — used in display SQLite offline queue.
 * Keeps the last N points for upload when cloud reconnects.
 */
export class GpsRingBuffer {
  private buf: GpsPoint[] = [];
  constructor(private maxSize = 200) {}

  push(point: GpsPoint) {
    this.buf.push(point);
    if (this.buf.length > this.maxSize) this.buf.shift();
  }

  drain(): GpsPoint[] {
    const copy = [...this.buf];
    this.buf = [];
    return copy;
  }

  get length() { return this.buf.length; }
}

// ─── CPM helpers ─────────────────────────────────────────────────────────────

/** Cost to advertiser for one impression at given CPM (CPM = cost per 1000) */
export function cpmToCharge(cpm: number): number {
  return parseFloat((cpm / 1000).toFixed(6));
}

// ─── Slug helpers ─────────────────────────────────────────────────────────────

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ─── Token expiry ────────────────────────────────────────────────────────────

/** Returns true if a unix-ms timestamp is expired */
export function isExpired(tsMs: number): boolean {
  return Date.now() > tsMs;
}

// ─── Number plate normalise ───────────────────────────────────────────────────

export function normaliseNumberPlate(plate: string): string {
  return plate.toUpperCase().replace(/\s+/g, '').replace(/-/g, '');
}
