// src/sync/uploader.ts — sends unsynced rows to the server.
//
// Called from two places: the background GPS task (every time new points
// arrive) and the Home screen ("Sync now" + a timer). Both may fire at the
// same moment, so `running` stops two uploads of the same rows overlapping.
// Even if they did overlap, the server ignores duplicate client_ids — that's
// the real safety net.
import NetInfo from '@react-native-community/netinfo';

import { markSynced, pendingBatch } from '../db/db';

// Expo copies any EXPO_PUBLIC_* variable from .env into the app at build time.
// On the laptop's Wi-Fi, use the laptop's LAN IP (e.g. http://192.168.1.20:8000):
// "localhost" on the tablet means the tablet itself, not your laptop.
const API_URL: string = process.env.EXPO_PUBLIC_API_URL ?? '';

// Identifies this device in the server's stats. Fixed for the spike; the real
// app uses the logged-in device/trip IDs.
const DEVICE_ID = 'spike-tablet-1';

let running = false;

export type SyncResult = 'offline' | 'nothing' | 'sent' | 'failed' | 'busy';

export async function trySync(): Promise<SyncResult> {
  if (running) return 'busy';
  running = true;
  try {
    const net = await NetInfo.fetch();
    if (!net.isConnected) return 'offline';

    const { points, events } = pendingBatch();
    if (points.length === 0 && events.length === 0) return 'nothing';

    // Give up after 15 s: a hanging request on a weak 3G signal must not
    // block the next attempt forever.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(`${API_URL}/spike/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: DEVICE_ID, points, events }),
        signal: controller.signal,
      });
      if (!res.ok) return 'failed';
    } finally {
      clearTimeout(timer);
    }

    // Only mark rows synced AFTER the server said OK.
    markSynced(points.map((p) => p.client_id), events.map((e) => e.client_id));
    return 'sent';
  } catch {
    return 'failed';
  } finally {
    running = false;
  }
}
