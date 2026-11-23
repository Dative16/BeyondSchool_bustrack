// src/nav/NavScreen.tsx — Google turn-by-turn directions through test stops.
//
// What this proves: the Navigation SDK runs inside OUR app (not by jumping to
// the Google Maps app), routes through several stops in order, reroutes when
// the driver goes off route, and tells us when we arrive at each stop.
//
// RN note: <NavigationView> is a NATIVE view (Android code drawing the map),
// embedded in our React layout. It must sit inside a parent with a fixed size
// (flex: 1 in a sized container) — an unbounded parent makes it misbehave.
import {
  NavigationSessionStatus,
  NavigationView,
  RouteStatus,
  TravelMode,
  useNavigation,
  type ArrivalEvent,
  type Waypoint,
} from '@googlemaps/react-native-navigation-sdk';
import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { insertEvent } from '../db/db';
import { colors } from '../ui/theme';

// REPLACE with two real stops on a route you can drive. Approximate points in
// Dar es Salaam, for illustration only — check them on a map first.
const TEST_STOPS: Waypoint[] = [
  { title: 'Kituo cha majaribio 1', position: { lat: -6.7705, lng: 39.2395 }, vehicleStopover: true },
  { title: 'Kituo cha majaribio 2', position: { lat: -6.7613, lng: 39.2310 }, vehicleStopover: true },
];

type Status = 'idle' | 'starting' | 'guiding' | 'error';

export function NavScreen() {
  const { navigationController, setOnArrival, removeAllListeners } = useNavigation();
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('Bonyeza "Anza maelekezo" kuanza.');

  // Listeners are registered once and removed when the screen closes.
  useEffect(() => {
    setOnArrival((event: ArrivalEvent) => {
      // Record arrival in the same offline queue as everything else.
      insertEvent({
        client_id: Crypto.randomUUID(),
        type: 'arrived_stop',
        label: event.waypoint.title ?? null,
        occurred_at: new Date().toISOString(),
        lat: event.waypoint.position?.lat ?? null,
        lng: event.waypoint.position?.lng ?? null,
      });
      if (event.isFinalDestination) {
        setMessage('Umefika kituo cha mwisho.');
        void navigationController.stopGuidance();
        setStatus('idle');
      } else {
        setMessage(`Umefika: ${event.waypoint.title ?? 'kituo'}. Kuendelea…`);
        void navigationController.continueToNextDestination();
        void navigationController.startGuidance();
      }
    });
    return () => removeAllListeners();
  }, [navigationController, setOnArrival, removeAllListeners]);

  const start = useCallback(async () => {
    setStatus('starting');
    try {
      // Google requires the driver to accept their terms once before navigating.
      const accepted = await navigationController.showTermsAndConditionsDialog();
      if (!accepted) {
        setStatus('error');
        setMessage('Masharti hayakukubaliwa.');
        return;
      }
      const session = await navigationController.init();
      if (session !== NavigationSessionStatus.OK) {
        setStatus('error');
        setMessage(`Imeshindwa kuanza: ${session}`); // e.g. notAuthorized = API key problem
        return;
      }
      const route = await navigationController.setDestinations(TEST_STOPS, {
        routingOptions: { travelMode: TravelMode.DRIVING },
        displayOptions: { showDestinationMarkers: true },
      });
      if (route !== RouteStatus.OK) {
        // LOCATION_DISABLED here usually means no GPS fix yet: wait and retry.
        setStatus('error');
        setMessage(`Njia haikupatikana: ${route}`);
        return;
      }
      await navigationController.startGuidance();
      setStatus('guiding');
      setMessage('Maelekezo yanaendelea.');
    } catch (e) {
      setStatus('error');
      setMessage(`Hitilafu: ${String(e)}`);
    }
  }, [navigationController]);

  const stop = useCallback(async () => {
    await navigationController.stopGuidance();
    setStatus('idle');
    setMessage('Maelekezo yamesimamishwa.');
  }, [navigationController]);

  return (
    <View style={styles.root}>
      <View style={styles.map}>
        <NavigationView />
      </View>
      <View style={styles.bar}>
        <Text style={styles.message} numberOfLines={2}>{message}</Text>
        {status === 'guiding' ? (
          <Pressable style={[styles.button, styles.secondary]} onPress={stop} accessibilityRole="button">
            <Text style={[styles.buttonText, { color: colors.ink }]}>Simamisha</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.button, status === 'starting' && { opacity: 0.5 }]}
            onPress={start}
            disabled={status === 'starting'}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>Anza maelekezo</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  map: { flex: 1, margin: 12, borderRadius: 24, overflow: 'hidden' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 12,
    borderRadius: 24,
    backgroundColor: colors.card,
  },
  message: { flex: 1, fontSize: 16, color: colors.ink },
  button: {
    height: 56,
    paddingHorizontal: 24,
    borderRadius: 18,
    backgroundColor: colors.ink,
    justifyContent: 'center',
  },
  secondary: { backgroundColor: colors.muted },
  buttonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
});
