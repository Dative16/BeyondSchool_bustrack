// src/ui/HomeScreen.tsx — start/stop tracking and watch the numbers.
//
// RN vs web, the three things you'll notice here:
// - <View> is <div>, <Text> is <p>/<span>. ALL text must be inside <Text>.
// - <Pressable onPress> is <button onClick>.
// - <ScrollView> is needed for scrolling; a plain View never scrolls.
import * as Crypto from 'expo-crypto';
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { counts, insertEvent, type Counts } from '../db/db';
import { isTracking, startTracking, stopTracking } from '../location/task';
import { trySync, type SyncResult } from '../sync/uploader';
import { colors } from './theme';

export function HomeScreen() {
  const [tracking, setTracking] = useState(false);
  const [stats, setStats] = useState<Counts>(counts());
  const [lastSync, setLastSync] = useState<SyncResult | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStats(counts());
    setTracking(await isTracking());
  }, []);

  // Refresh the numbers every 5 s and try an upload every 15 s while the
  // screen is open. (In the background, the GPS task triggers uploads itself.)
  useEffect(() => {
    // Defer the first read: effects should subscribe/update external systems,
    // not set state synchronously in their body.
    const kickoff = setTimeout(() => void refresh(), 0);
    const tick = setInterval(() => void refresh(), 5_000);
    const sync = setInterval(() => void trySync().then(setLastSync), 15_000);
    return () => {
      clearTimeout(kickoff);
      clearInterval(tick);
      clearInterval(sync);
    };
  }, [refresh]);

  const onStart = async () => {
    const result = await startTracking();
    if (result === 'no-background-permission') {
      setNote('Ruhusa ya ‘Allow all the time’ inahitajika. Fungua Settings → Location → Allow all the time.');
    } else if (result === 'no-foreground-permission') {
      setNote('Ruhusa ya mahali imekataliwa.');
    } else {
      setNote(null);
    }
    void refresh();
  };

  const onStop = async () => {
    await stopTracking();
    void refresh();
  };

  // Simulates a roll-call tap, to test the offline event queue.
  const onTestEvent = async () => {
    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const pos = await Location.getLastKnownPositionAsync();
      lat = pos?.coords.latitude ?? null;
      lng = pos?.coords.longitude ?? null;
    } catch {
      // No position yet is fine for a test event.
    }
    insertEvent({
      client_id: Crypto.randomUUID(),
      type: 'boarded',
      label: 'Mwanafunzi wa majaribio',
      occurred_at: new Date().toISOString(),
      lat,
      lng,
    });
    void refresh();
  };

  const onSyncNow = async () => {
    setLastSync(await trySync());
    void refresh();
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>Majaribio ya basi</Text>
        <Text style={styles.sub}>{tracking ? 'GPS inarekodi kila sekunde 10' : 'GPS imesimama'}</Text>
        <Pressable
          onPress={tracking ? onStop : onStart}
          style={[styles.primary, tracking && { backgroundColor: colors.muted }]}
          accessibilityRole="button"
        >
          <Text style={[styles.primaryText, tracking && { color: colors.ink }]}>
            {tracking ? 'Simamisha GPS' : '›››  Anza GPS  ›››'}
          </Text>
        </Pressable>
        {note ? <Text style={[styles.sub, { color: colors.warn }]}>{note}</Text> : null}
      </View>

      <View style={styles.grid}>
        <Stat label="Pointi za GPS" value={stats.points} />
        <Stat label="Hazijatumwa" value={stats.pendingPoints} warn={stats.pendingPoints > 30} />
        <Stat label="Matukio" value={stats.events} />
        <Stat label="Matukio hayajatumwa" value={stats.pendingEvents} warn={stats.pendingEvents > 0} />
      </View>

      <View style={styles.card}>
        <Row label="Pointi ya mwisho" value={stats.lastPointAt ? new Date(stats.lastPointAt).toLocaleTimeString() : '—'} />
        <Row label="Usawazishaji wa mwisho" value={lastSync ?? '—'} />
        <View style={styles.buttons}>
          <Pressable onPress={onTestEvent} style={styles.secondaryBtn} accessibilityRole="button">
            <Text style={styles.secondaryText}>Tukio la majaribio</Text>
          </Pressable>
          <Pressable onPress={onSyncNow} style={styles.secondaryBtn} accessibilityRole="button">
            <Text style={styles.secondaryText}>Tuma sasa</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Kabla ya safari ya majaribio</Text>
        <Text style={styles.sub}>
          Zima ‘battery optimisation’ kwa programu hii, na kwenye Tecno/Infinix ruhusu ‘Auto-start’. Tazama README.
        </Text>
        <Pressable onPress={() => void Linking.openSettings()} style={styles.secondaryBtn} accessibilityRole="button">
          <Text style={styles.secondaryText}>Fungua Settings za programu</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, warn && { color: colors.warn }]}>{value}</Text>
      <Text style={styles.sub}>{label}</Text>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.sub}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 12,
  },
  card: { backgroundColor: colors.card, borderRadius: 24, padding: 20, gap: 10 },
  title: { fontSize: 26, fontWeight: '600', color: colors.ink },
  cardTitle: { fontSize: 18, fontWeight: '600', color: colors.ink },
  sub: { fontSize: 15, color: colors.secondary },
  primary: { height: 64, borderRadius: 18, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 19, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: { flexGrow: 1, flexBasis: 150, backgroundColor: colors.card, borderRadius: 20, padding: 16 },
  statValue: { fontSize: 30, fontWeight: '600', color: colors.ink },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowValue: { fontSize: 15, fontWeight: '500', color: colors.ink },
  buttons: { flexDirection: 'row', gap: 10 },
  secondaryBtn: { flex: 1, height: 52, borderRadius: 16, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 15, fontWeight: '500', color: colors.ink },
});
