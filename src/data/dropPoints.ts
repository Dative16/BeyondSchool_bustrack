// src/data/dropPoints.ts — 20 demo students, each with their own stop.
//
// These are SAMPLE coordinates around Dar es Salaam that follow the "Njia ya
// Mbezi" route from the design. Replace this file with the real roster/API
// when available; the rest of the app only reads the exports below.
//
// The same points are pickups in the morning and registered drop points in
// the evening. `guardian` is used by the Jioni handover screen.
export type DropPoint = {
  id: string;
  student: string;
  initials: string;
  studentClass: string;
  stop: string;
  position: { lat: number; lng: number };
  guardian: string;
  relationship: string;
};

export const DROP_POINTS: DropPoint[] = [
  { id: 'dp-01', student: 'Amina Mussa', initials: 'AM', studentClass: 'Darasa la 3', stop: 'Tegeta Nyuki', position: { lat: -6.7512, lng: 39.2708 }, guardian: 'Asha Mussa', relationship: 'Mama' },
  { id: 'dp-02', student: 'Baraka Joseph', initials: 'BJ', studentClass: 'Darasa la 5', stop: 'Tegeta Nyuki · B', position: { lat: -6.7535, lng: 39.2729 }, guardian: 'Joseph Ally', relationship: 'Baba' },
  { id: 'dp-03', student: 'Neema Peter', initials: 'NP', studentClass: 'Darasa la 2', stop: 'Kunduchi Mtongani', position: { lat: -6.7568, lng: 39.2512 }, guardian: 'Peter John', relationship: 'Baba' },
  { id: 'dp-04', student: 'Juma Ally', initials: 'JA', studentClass: 'Darasa la 4', stop: 'Kunduchi Pawawinga', position: { lat: -6.7594, lng: 39.2481 }, guardian: 'Fatma Ally', relationship: 'Mama' },
  { id: 'dp-05', student: 'Salma Hussen', initials: 'SH', studentClass: 'Darasa la 1', stop: 'Mbezi Kwa Komba', position: { lat: -6.7650, lng: 39.2603 }, guardian: 'Hussen Omar', relationship: 'Baba' },
  { id: 'dp-06', student: 'Daudi Ally', initials: 'DA', studentClass: 'Darasa la 6', stop: 'Mbezi Kwa Komba · B', position: { lat: -6.7673, lng: 39.2628 }, guardian: '', relationship: 'Hakuna mlezi aliyeidhinishwa' },
  { id: 'dp-07', student: 'Aisha Mohamed', initials: 'AM', studentClass: 'Darasa la 3', stop: 'Mbezi Beach Shoppers', position: { lat: -6.7721, lng: 39.2764 }, guardian: 'Mohamed Said', relationship: 'Baba' },
  { id: 'dp-08', student: 'Hamisi Said', initials: 'HS', studentClass: 'Darasa la 5', stop: 'Mbezi Beach', position: { lat: -6.7740, lng: 39.2791 }, guardian: 'Zawadi Said', relationship: 'Mama' },
  { id: 'dp-09', student: 'Zawadi Mussa', initials: 'ZM', studentClass: 'Darasa la 2', stop: 'Mbezi Beach Hotel', position: { lat: -6.7762, lng: 39.2817 }, guardian: 'Mussa Juma', relationship: 'Baba' },
  { id: 'dp-10', student: 'Joseph John', initials: 'JJ', studentClass: 'Darasa la 4', stop: 'Africana', position: { lat: -6.7861, lng: 39.2578 }, guardian: 'Mary John', relationship: 'Mama' },
  { id: 'dp-11', student: 'Mary Grace', initials: 'MG', studentClass: 'Darasa la 1', stop: 'Africana · B', position: { lat: -6.7885, lng: 39.2596 }, guardian: 'Grace Peter', relationship: 'Mama' },
  { id: 'dp-12', student: 'Ally Ramadhan', initials: 'AR', studentClass: 'Darasa la 6', stop: 'Mikocheni B', position: { lat: -6.7892, lng: 39.2714 }, guardian: 'Ramadhan Ally', relationship: 'Baba' },
  { id: 'dp-13', student: 'Fatuma Omar', initials: 'FO', studentClass: 'Darasa la 3', stop: 'Mikocheni A', position: { lat: -6.7871, lng: 39.2740 }, guardian: 'Omar Hassan', relationship: 'Baba' },
  { id: 'dp-14', student: 'Godfrey Peter', initials: 'GP', studentClass: 'Darasa la 5', stop: 'Regent Estate', position: { lat: -6.7846, lng: 39.2765 }, guardian: 'Peter Godfrey', relationship: 'Baba' },
  { id: 'dp-15', student: 'Rehema Juma', initials: 'RJ', studentClass: 'Darasa la 2', stop: 'Mwenge', position: { lat: -6.7818, lng: 39.2603 }, guardian: 'Juma Rehema', relationship: 'Baba' },
  { id: 'dp-16', student: 'Hassan Ali', initials: 'HA', studentClass: 'Darasa la 4', stop: 'Mwenge Darajani', position: { lat: -6.7840, lng: 39.2628 }, guardian: 'Ali Hassan', relationship: 'Baba' },
  { id: 'dp-17', student: 'Lilian John', initials: 'LJ', studentClass: 'Darasa la 1', stop: 'Kawe', position: { lat: -6.7760, lng: 39.2645 }, guardian: 'John Lilian', relationship: 'Baba' },
  { id: 'dp-18', student: 'Emmanuel Yusuph', initials: 'EY', studentClass: 'Darasa la 6', stop: 'Bunju', position: { lat: -6.7790, lng: 39.2615 }, guardian: 'Yusuph Emmanuel', relationship: 'Baba' },
  { id: 'dp-19', student: 'Sophia Dennis', initials: 'SD', studentClass: 'Darasa la 3', stop: 'Kisa', position: { lat: -6.7815, lng: 39.2585 }, guardian: 'Dennis Sophia', relationship: 'Baba' },
  { id: 'dp-20', student: 'Peter Francis', initials: 'PF', studentClass: 'Darasa la 5', stop: 'Mzimuni', position: { lat: -6.7845, lng: 39.2555 }, guardian: 'Francis Peter', relationship: 'Baba' },
];

/** Final stop of the morning run. In the evening the bus starts here. */
export const SCHOOL: DropPoint = {
  id: 'school',
  student: '',
  initials: 'SH',
  studentClass: '',
  stop: 'Shule',
  position: { lat: -6.8060, lng: 39.2740 },
  guardian: '',
  relationship: '',
};

/**
 * Everyone registered at the same physical stop. The "· B" suffix marks a
 * second door/side of a stop, so we group on the base name for the sheet.
 */
export function studentsAtStop(stop: string): DropPoint[] {
  const base = stop.split(' · ')[0].trim();
  return DROP_POINTS.filter(p => p.stop.split(' · ')[0].trim() === base);
}

/** Straight-line distance in kilometres — used only until Routes answers. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const lat1 = a.lat * rad;
  const lat2 = b.lat * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
