// src/db/db.ts — the on-device database (SQLite).
//
// Why a database on the phone at all? Mobile data drops along the route.
// Everything the app records is written HERE first, then uploaded later by
// src/sync/uploader.ts. If the upload fails, nothing is lost: the row simply
// stays "synced = 0" and goes up on the next try.
//
// RN note: expo-sqlite's *Sync functions block the JS thread. That's fine for
// these tiny writes (a few rows), and it keeps the code simple to read. For
// big reads in the real app we'd switch to the *Async versions.
import * as SQLite from 'expo-sqlite';

export const db = SQLite.openDatabaseSync('spike.db');

// Runs once at import time. "IF NOT EXISTS" makes it safe to run every launch.
db.execSync(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS gps_point (
    client_id   TEXT PRIMARY KEY,      -- UUID made on the phone; the server ignores duplicates
    recorded_at TEXT NOT NULL,         -- when the GPS fix happened (ISO time), NOT when it was uploaded
    lat         REAL NOT NULL,
    lng         REAL NOT NULL,
    speed       REAL,                  -- metres per second, may be null
    accuracy    REAL,                  -- metres
    battery     REAL,                  -- 0..1, to see how fast tracking drains the device
    synced      INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS trip_event (
    client_id   TEXT PRIMARY KEY,
    type        TEXT NOT NULL,         -- e.g. 'boarded', 'arrived_stop'
    label       TEXT,                  -- free text for the spike (student name, stop name)
    occurred_at TEXT NOT NULL,
    lat         REAL,
    lng         REAL,
    synced      INTEGER NOT NULL DEFAULT 0
  );
`);

export type GpsPoint = {
  client_id: string;
  recorded_at: string;
  lat: number;
  lng: number;
  speed: number | null;
  accuracy: number | null;
  battery: number | null;
};

export type TripEvent = {
  client_id: string;
  type: string;
  label: string | null;
  occurred_at: string;
  lat: number | null;
  lng: number | null;
};

export function insertPoints(points: GpsPoint[]): void {
  // One transaction for the whole batch: either all rows land or none do.
  db.withTransactionSync(() => {
    for (const p of points) {
      db.runSync(
        `INSERT OR IGNORE INTO gps_point
           (client_id, recorded_at, lat, lng, speed, accuracy, battery)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        p.client_id, p.recorded_at, p.lat, p.lng, p.speed, p.accuracy, p.battery,
      );
    }
  });
}

export function insertEvent(e: TripEvent): void {
  db.runSync(
    `INSERT OR IGNORE INTO trip_event (client_id, type, label, occurred_at, lat, lng)
     VALUES (?, ?, ?, ?, ?, ?)`,
    e.client_id, e.type, e.label, e.occurred_at, e.lat, e.lng,
  );
}

export function pendingBatch(limit = 200): { points: GpsPoint[]; events: TripEvent[] } {
  const points = db.getAllSync<GpsPoint>(
    `SELECT client_id, recorded_at, lat, lng, speed, accuracy, battery
       FROM gps_point WHERE synced = 0 ORDER BY recorded_at LIMIT ?`,
    limit,
  );
  const events = db.getAllSync<TripEvent>(
    `SELECT client_id, type, label, occurred_at, lat, lng
       FROM trip_event WHERE synced = 0 ORDER BY occurred_at LIMIT ?`,
    limit,
  );
  return { points, events };
}

export function markSynced(pointIds: string[], eventIds: string[]): void {
  db.withTransactionSync(() => {
    for (const id of pointIds) db.runSync('UPDATE gps_point SET synced = 1 WHERE client_id = ?', id);
    for (const id of eventIds) db.runSync('UPDATE trip_event SET synced = 1 WHERE client_id = ?', id);
  });
}

export type Counts = {
  points: number;
  pendingPoints: number;
  events: number;
  pendingEvents: number;
  lastPointAt: string | null;
};

export function counts(): Counts {
  const p = db.getFirstSync<{ total: number; pending: number; last: string | null }>(
    `SELECT COUNT(*) AS total, COALESCE(SUM(synced = 0), 0) AS pending, MAX(recorded_at) AS last FROM gps_point`,
  );
  const e = db.getFirstSync<{ total: number; pending: number }>(
    `SELECT COUNT(*) AS total, COALESCE(SUM(synced = 0), 0) AS pending FROM trip_event`,
  );
  return {
    points: p?.total ?? 0,
    pendingPoints: p?.pending ?? 0,
    events: e?.total ?? 0,
    pendingEvents: e?.pending ?? 0,
    lastPointAt: p?.last ?? null,
  };
}
