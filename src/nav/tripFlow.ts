// src/nav/tripFlow.ts — session-aware trip model.
//
// Asubuhi: pick students up at their stops, then finish at Shule.
// Jioni:   start at Shule, drop each student at their registered stop.
//
// Keeping this logic outside NavScreen/StopSheet means both screens agree on
// what "done" means at a stop and what has to be confirmed before closing.
import type { SessionType } from '../auth/session';
import { DROP_POINTS, SCHOOL, studentsAtStop, type DropPoint } from '../data/dropPoints';

export type Progress = {
  onboard: Record<string, boolean>; // currently in the bus
  absent: Record<string, boolean>;  // Asubuhi: parent reported "hasafiri leo"
  handed: Record<string, boolean>;  // Jioni: confirmed handover to a guardian
  remained: Record<string, boolean>; // Jioni: no authorised guardian, stays on bus
  arrived: Record<string, boolean>; // Asubuhi: confirmed at the school gate
};

export function emptyProgress(session: SessionType): Progress {
  return {
    // In the evening every student starts on the bus at the school.
    onboard:
      session === 'Jioni'
        ? Object.fromEntries(DROP_POINTS.map(p => [p.id, true]))
        : {},
    absent: {},
    handed: {},
    remained: {},
    arrived: {},
  };
}

export function routeFor(session: SessionType): DropPoint[] {
  // The school is the origin in the evening, not another drop marker.
  return session === 'Asubuhi' ? [...DROP_POINTS, SCHOOL] : [...DROP_POINTS];
}

export function isSchool(point: DropPoint): boolean {
  return point.id === SCHOOL.id;
}

export function studentsForStop(route: DropPoint[], index: number): DropPoint[] {
  const point = route[index];
  if (!point || isSchool(point)) return [];
  return studentsAtStop(point.stop);
}

/** Whether the driver has confirmed everybody at the current stop. */
export function stopIsDone(
  session: SessionType,
  route: DropPoint[],
  index: number,
  progress: Progress,
): boolean {
  const point = route[index];
  if (!point) return false;

  if (isSchool(point)) {
    const onboardIds = DROP_POINTS.filter(p => progress.onboard[p.id]).map(p => p.id);
    return onboardIds.length > 0 && onboardIds.every(id => progress.arrived[id]);
  }

  const students = studentsForStop(route, index);
  if (students.length === 0) return false;
  return students.every(s =>
    session === 'Asubuhi'
      ? Boolean(progress.onboard[s.id] || progress.absent[s.id])
      : Boolean(progress.handed[s.id] || progress.remained[s.id]),
  );
}

export function onboardCount(progress: Progress): number {
  return Object.values(progress.onboard).filter(Boolean).length;
}

export function arrivalCount(progress: Progress): number {
  return Object.values(progress.arrived).filter(Boolean).length;
}

export function handedCount(progress: Progress): number {
  return Object.values(progress.handed).filter(Boolean).length;
}

export function absentCount(progress: Progress): number {
  return Object.values(progress.absent).filter(Boolean).length;
}

export function remainedCount(progress: Progress): number {
  return Object.values(progress.remained).filter(Boolean).length;
}

export function notArrived(progress: Progress): DropPoint[] {
  return DROP_POINTS.filter(p => progress.onboard[p.id] && !progress.arrived[p.id]);
}

export function notHanded(progress: Progress): DropPoint[] {
  return DROP_POINTS.filter(p => !progress.handed[p.id] && !progress.remained[p.id]);
}
