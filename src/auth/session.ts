// src/auth/session.ts — local spike login + trip context.
//
// This is deliberately fake: no network, no token storage. It exists so we
// can test the real driver flow (login → confirm assignment → drive mode)
// before the backend is ready. Replace signInLocal() with the real API call
// when the auth endpoint exists; keep the Driver/TripContext shapes.

export type SessionType = 'Asubuhi' | 'Jioni';

export type Driver = {
  phone: string;
  name: string;
};

export type TripContext = {
  driver: Driver;
  route: string;
  studentCount: number;
  session: SessionType;
  plate: string;
  vehicle: string;
};

export const DEMO_ROUTE = 'Njia ya Mbezi';
export const DEMO_STUDENT_COUNT = 20;
export const DEMO_PLATE = 'T 123 ABC';
export const DEMO_VEHICLE = 'Coaster';

// Tanzanian numbers: 0XXXXXXXXX or +255XXXXXXXXX.
const TZ_PHONE = /^(?:\+255|0)\d{9}$/;

export function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s()-]/g, '');
  if (!TZ_PHONE.test(cleaned)) return null;
  return cleaned.startsWith('0') ? `+255${cleaned.slice(1)}` : cleaned;
}

export function signInLocal(phoneRaw: string, password: string): Driver | null {
  const phone = normalizePhone(phoneRaw);
  if (!phone || password.trim().length < 6) return null;
  // Demo identity: the last three digits make repeated test runs recognisable.
  return { phone, name: `Dereva ${phone.slice(-3)}` };
}
