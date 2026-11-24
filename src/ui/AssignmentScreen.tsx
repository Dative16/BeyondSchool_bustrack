// src/ui/AssignmentScreen.tsx — step 2: confirm the assigned trip.
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  DEMO_PLATE,
  DEMO_ROUTE,
  DEMO_STUDENT_COUNT,
  DEMO_VEHICLE,
  type Driver,
  type SessionType,
  type TripContext,
} from '../auth/session';
import { DROP_POINTS } from '../data/dropPoints';
import { colors } from './theme';

type Props = {
  topInset: number;
  driver: Driver;
  onConfirm: (trip: TripContext) => void;
  onSignOut: () => void;
};

const SESSIONS: SessionType[] = ['Asubuhi', 'Jioni'];

export function AssignmentScreen({ topInset, driver, onConfirm, onSignOut }: Props) {
  const [session, setSession] = useState<SessionType>('Asubuhi');
  const stopCount = new Set(DROP_POINTS.map(p => p.stop.split(' · ')[0].trim())).size;

  const confirm = () =>
    onConfirm({
      driver,
      route: DEMO_ROUTE,
      studentCount: DEMO_STUDENT_COUNT,
      session,
      plate: DEMO_PLATE,
      vehicle: DEMO_VEHICLE,
    });

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: topInset + 20 }]}
    >
      <Text style={styles.eyebrow}>HATUA YA 2</Text>
      <Text style={styles.title}>Thibitisha safari</Text>
      <Text style={styles.subtitle}>
        {session === 'Asubuhi'
          ? 'Utawakuta wanafunzi kwenye vituo vyao, kisha uwapeleke shuleni.'
          : 'Utaanza shuleni na kuwashusha wanafunzi kwenye vituo vao vilivyosajiliwa.'}
      </Text>

      <View style={styles.card}>
        <Row label="Dereva" value={driver.name} />
        <Row label="Simu" value={driver.phone} />
        <View style={styles.divider} />
        <Row label="Njia" value={DEMO_ROUTE} strong />
        <Row label="Basi" value={`${DEMO_PLATE} · ${DEMO_VEHICLE}`} strong />
        <Row label="Kutoka" value={session === 'Asubuhi' ? 'Vituo vya nyumbani' : 'Shule'} />
        <Row label="Hadi" value={session === 'Asubuhi' ? 'Shule' : 'Vituo vya nyumbani'} />
        <Row
          label={session === 'Asubuhi' ? 'Wanafunzi wa kuchukua' : 'Wanafunzi wa kushusha'}
          value={`${DEMO_STUDENT_COUNT}`}
          strong
        />
        <Row label="Vituo" value={`${stopCount}`} />
      </View>

      <Text style={styles.section}>Wakati wa safari</Text>
      <View style={styles.segment}>
        {SESSIONS.map(option => (
          <Pressable
            key={option}
            onPress={() => setSession(option)}
            accessibilityRole="button"
            accessibilityLabel={`Chagua ${option}`}
            style={[styles.segmentButton, session === option && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, session === option && styles.segmentTextActive]}>
              {option}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={confirm}
        accessibilityRole="button"
        accessibilityLabel="Thibitisha na uanze"
        style={styles.primary}
      >
        <Text style={styles.primaryText}>Thibitisha na uanze</Text>
      </Pressable>

      <Pressable
        onPress={onSignOut}
        accessibilityRole="button"
        accessibilityLabel="Badilisha dereva"
        style={styles.secondary}
      >
        <Text style={styles.secondaryText}>Badilisha dereva</Text>
      </Pressable>
    </ScrollView>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, strong && styles.rowValueStrong]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  content: { paddingHorizontal: 20, paddingBottom: 32, gap: 12 },
  eyebrow: { fontSize: 12, fontWeight: '700', color: colors.secondary, letterSpacing: 1 },
  title: { fontSize: 30, fontWeight: '700', color: colors.ink },
  subtitle: { fontSize: 15, color: colors.secondary, lineHeight: 21, marginBottom: 8 },

  card: { backgroundColor: colors.card, borderRadius: 24, padding: 20, gap: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  rowLabel: { fontSize: 15, color: colors.secondary },
  rowValue: { fontSize: 16, color: colors.ink, textAlign: 'right' },
  rowValueStrong: { fontWeight: '700' },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 4 },

  section: { fontSize: 14, fontWeight: '600', color: colors.secondary, marginTop: 8 },
  segment: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.muted,
    borderRadius: 16,
    padding: 6,
  },
  segmentButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: { backgroundColor: colors.ink },
  segmentText: { fontSize: 16, color: colors.secondary, fontWeight: '600' },
  segmentTextActive: { color: colors.card },

  primary: {
    height: 58,
    borderRadius: 16,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  primaryText: { color: colors.card, fontSize: 17, fontWeight: '600' },
  secondary: {
    height: 50,
    borderRadius: 16,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { color: colors.ink, fontSize: 15, fontWeight: '600' },
});
