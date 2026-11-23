// src/location/task.ts — background GPS tracking.
//
// THE most important file in the spike. The question it answers:
// "Does the tablet keep sending its position every ~10 s for a whole
//  90-minute trip, with the screen off, on a cheap Android device?"
//
// How it works on Android (worth understanding, not just reading):
// 1. TaskManager.defineTask() registers a function by NAME. It MUST run at
//    module load (we import this file first in index.ts), because when Android
//    wakes the app in the background, no React screen is mounted — only the
//    JS bundle runs, and it looks the task up by name.
// 2. Location.startLocationUpdatesAsync() asks Android to start a FOREGROUND
//    SERVICE: a background job tied to a permanent notification. Android kills
//    ordinary background apps to save battery; it (mostly) leaves foreground
//    services alone. "Mostly": Tecno/Infinix/Xiaomi add their own battery
//    killers on top — that's what the README test checklist is for.
// 3. Android then calls our task with a batch of locations. We save them to
//    SQLite immediately (fast, works offline) and kick off an upload attempt.
import * as Battery from 'expo-battery';
import * as Crypto from 'expo-crypto';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { insertPoints } from '../db/db';
import { trySync } from '../sync/uploader';

export const LOCATION_TASK = 'bus-location-task';

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    // Errors here never reach the UI; in the real app we'd log them to the server.
    console.warn('[location task]', error.message);
    return;
  }
  if (!data?.locations?.length) return;

  // Battery level once per batch is enough to see the drain curve.
  let battery: number | null = null;
  try {
    battery = await Battery.getBatteryLevelAsync();
  } catch {
    battery = null;
  }

  insertPoints(
    data.locations.map((loc) => ({
      client_id: Crypto.randomUUID(),
      recorded_at: new Date(loc.timestamp).toISOString(),
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      speed: loc.coords.speed,
      accuracy: loc.coords.accuracy,
      battery,
    })),
  );

  // Don't await: the task should return quickly. If upload fails, rows stay
  // in SQLite and go up next time.
  void trySync();
});

export type StartResult = 'started' | 'no-foreground-permission' | 'no-background-permission';

export async function startTracking(): Promise<StartResult> {
  // Android requires asking in two steps: first "while using the app", then
  // "all the time". The second opens a system settings screen on Android 11+,
  // where the person must pick "Allow all the time".
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return 'no-foreground-permission';
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== 'granted') return 'no-background-permission';

  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 10_000, // ask for a fix every 10 s ...
    distanceInterval: 0, // ... even when the bus is standing still (we want to see stops)
    foregroundService: {
      notificationTitle: 'Basi linafuatiliwa',
      notificationBody: 'Safari inaendelea — usifunge programu hii',
      notificationColor: '#111114',
      // Keep tracking even if someone swipes the app away from recent apps.
      killServiceOnDestroy: false,
    },
  });
  return 'started';
}

export async function stopTracking(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
}

export function isTracking(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
}
