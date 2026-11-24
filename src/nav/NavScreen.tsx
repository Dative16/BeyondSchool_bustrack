// src/nav/NavScreen.tsx — the driver's map.
//
// Design goals for this pass:
//   • the blue route follows real roads (Google Routes API polyline)
//   • drop points are normal Google blue, not green
//   • the map is edge-to-edge; every control floats over it
//   • the bottom sheet has peek / expanded / hidden states
import {
  AudioGuidanceMode,
  NavigationNightMode,
  NavigationSessionStatus,
  NavigationView,
  RouteStatus,
  TravelMode,
  useNavigation,
  type ArrivalEvent,
  type Circle,
  type MapViewController,
  type Waypoint,
} from '@googlemaps/react-native-navigation-sdk';
import * as Crypto from 'expo-crypto';
import * as Location from 'expo-location';
import {
  Animated,
  Easing,
  PanResponder,
  Platform,
  Pressable,
  StatusBar as NativeStatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewProps,
} from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { TripContext } from '../auth/session';
import { distanceKm, DROP_POINTS, type DropPoint } from '../data/dropPoints';
import { insertEvent } from '../db/db';
import { MAP_STYLE_JSON } from '../ui/mapStyle';
import { colors } from '../ui/theme';
import { fetchRoadRoute } from './roadRoute';
import {
  StopSheet,
  type GuidanceStatus,
  type RoadStatus,
  type SheetMode,
} from './StopSheet';
import { TripClose } from './TripClose';
import {
  emptyProgress,
  isSchool,
  onboardCount,
  routeFor,
  stopIsDone,
  studentsForStop,
  type Progress,
} from './tripFlow';

type Point = { lat: number; lng: number };

const MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
const ROUTE_REFRESH_METRES = 0.05; // don't re-request Routes every GPS tick
const topInset = Platform.OS === 'android' ? Math.max(NativeStatusBar.currentHeight ?? 24, 24) : 0;
const bottomInset = Platform.OS === 'android' ? 12 : 0;

export function NavScreen({
  trip,
  onOpenGps,
  onEndTrip,
}: {
  trip: TripContext;
  onOpenGps: () => void;
  onEndTrip: () => void;
}) {
  const { navigationController, setOnArrival, removeAllListeners } = useNavigation();
  const { width, height } = useWindowDimensions();
  const isWide = width >= 700;
  // Asubuhi ends at the school; Jioni starts there and visits every drop point.
  const route = useMemo(() => routeFor(trip.session), [trip.session]);

  const [nextIndex, setNextIndex] = useState(0);
  // null means "follow the active stop"; a number means a marker was tapped.
  const [selectedOverride, setSelectedOverride] = useState<number | null>(null);
  const [mapController, setMapController] = useState<MapViewController | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [status, setStatus] = useState<GuidanceStatus>('idle');
  const [message, setMessage] = useState('Bonyeza "Maelekezo" kwa njia inayofuata barabara.');
  const [progress, setProgress] = useState<Progress>(() => emptyProgress(trip.session));
  const [showClose, setShowClose] = useState(false);
  const [roadDistance, setRoadDistance] = useState<number | null>(null);
  const [speedKmh, setSpeedKmh] = useState<number | null>(null);
  const [busPosition, setBusPosition] = useState<Point | null>(null);
  const [roadPoints, setRoadPoints] = useState<Point[] | null>(null);
  const [roadStatus, setRoadStatus] = useState<RoadStatus>(
    MAPS_KEY ? 'loading' : 'unavailable',
  );
  const [soundOn, setSoundOn] = useState(true);
  const [sheetMode, setSheetMode] = useState<SheetMode>('peek');

  const lastRouteOrigin = useRef<Point | null>(null);
  const lastRouteIndex = useRef(-1);
  const lastCircleTap = useRef(0);
  const guidanceStarted = useRef(false);

  const next = route[nextIndex] ?? route[route.length - 1];
  const selectedIndex = selectedOverride ?? nextIndex;
  const onboard = onboardCount(progress);
  const stopStudents = useMemo(() => studentsForStop(route, nextIndex), [route, nextIndex]);
  const canAdvance = stopIsDone(trip.session, route, nextIndex, progress);
  const isFinalStop = nextIndex >= route.length - 1;
  const distance = roadDistance ?? (busPosition ? distanceKm(busPosition, next.position) : null);
  const etaMinutes =
    distance != null && speedKmh != null && speedKmh > 4
      ? Math.max(1, Math.round((distance / speedKmh) * 60))
      : null;

  // Live bus position for the bus dot, speed badge and road-route origin.
  useEffect(() => {
    let alive = true;
    let subscription: Location.LocationSubscription | null = null;

    const apply = (pos: Location.LocationObject) => {
      if (!alive) return;
      setBusPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setSpeedKmh(pos.coords.speed != null ? Math.round(pos.coords.speed * 3.6) : null);
    };

    const start = async () => {
      // Ask here, not only in the background task: without foreground
      // permission there is no bus position and therefore no road route.
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted || !alive) return;
      try {
        const last = await Location.getLastKnownPositionAsync();
        if (last) apply(last);
      } catch {
        // A missing last-known fix is normal on a cold start.
      }
      try {
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 15000,
            distanceInterval: 40,
          },
          apply,
        );
      } catch {
        // The map still works with the cached position or no bus dot.
      }
    };

    void start();
    return () => {
      alive = false;
      subscription?.remove();
    };
  }, []);

  // Draw one continuous road-following path through every remaining stop.
  // The origin is the bus when GPS is available. Before the first fix (or if
  // permission is denied) it is the current stop, so the driver still sees a
  // connected road instead of isolated blue dots.
  useEffect(() => {
    if (!MAPS_KEY || route.length === 0) return;

    const hasGps = busPosition != null;
    const sameStop = lastRouteIndex.current === nextIndex;
    const last = lastRouteOrigin.current;
    if (hasGps && sameStop && last && distanceKm(last, busPosition!) < ROUTE_REFRESH_METRES) return;

    // A refresh keeps the previously drawn road line on screen. Clearing it
    // on every GPS tick makes the route blink and the sheet read "loading".
    const isRefresh = hasGps && sameStop && last != null;
    const origin = busPosition ?? route[nextIndex].position;
    // Without GPS the first destination would duplicate the origin.
    const destinations = hasGps ? route.slice(nextIndex) : route.slice(nextIndex + 1);
    if (destinations.length === 0) return;

    lastRouteIndex.current = nextIndex;
    if (hasGps) lastRouteOrigin.current = busPosition;
    let cancelled = false;

    const load = async () => {
      if (!isRefresh) {
        setRoadPoints(null);
        setRoadDistance(null);
        setRoadStatus('loading');
      }
      try {
        const roadRoute = await fetchRoadRoute(
          origin,
          destinations.map(p => p.position),
          MAPS_KEY,
        );
        if (cancelled) return;
        if (!roadRoute) {
          if (!isRefresh) {
            // No road geometry: show the blue stop dots, but never fake a road.
            setRoadPoints(null);
            setRoadStatus('unavailable');
          }
          return;
        }
        setRoadPoints(roadRoute.points);
        // The fallback origin is the stop itself, so its first leg is not the
        // distance from the bus — leave the distance blank until GPS returns.
        setRoadDistance(hasGps ? (roadRoute.distanceKm ?? null) : null);
        setRoadStatus('roads');
      } catch (error) {
        if (cancelled) return;
        console.warn('[NavScreen] road route refresh failed:', String(error).slice(0, 200));
        if (!isRefresh) {
          setRoadPoints(null);
          setRoadStatus('unavailable');
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [busPosition, nextIndex, route]);

  // Draw all 20 blue stops and the road-following route when Routes answers.
  // A straight line between stops is not a road, so none is drawn as fallback.
  useEffect(() => {
    if (!mapController || !mapReady) return;
    let cancelled = false;

    const draw = async () => {
      await mapController.clearMapView();
      if (cancelled) return;

      if (roadPoints && roadPoints.length > 1) {
        await mapController.addPolyline({
          id: 'route-upcoming',
          points: roadPoints,
          color: colors.route,
          width: 9,
        });
      }

      for (const [index, point] of route.entries()) {
        const isNext = index === nextIndex;
        await mapController.addCircle({
          id: `drop-${point.id}`,
          center: point.position,
          radius: isNext ? 16 : 9,
          strokeWidth: isNext ? 7 : 3,
          strokeColor: isNext ? colors.route : colors.card,
          fillColor: isNext ? colors.card : colors.route,
          clickable: true,
        });
        if (cancelled) return;
      }

      await mapController.addCircle({
        id: 'next-halo',
        center: next.position,
        radius: 36,
        strokeWidth: 0,
        fillColor: colors.routeSoft,
      });

      if (busPosition) {
        await mapController.addCircle({
          id: 'bus-position',
          center: busPosition,
          radius: 7,
          strokeWidth: 3,
          strokeColor: colors.card,
          fillColor: colors.ink,
        });
      }
    };

    void draw();
    return () => {
      cancelled = true;
    };
  }, [mapController, mapReady, nextIndex, next.position, roadPoints, busPosition, route]);

  // Camera moves on stop changes only — not on every GPS tick.
  useEffect(() => {
    if (!mapController || !mapReady) return;
    void mapController.moveCamera({ target: next.position, zoom: 14.5, tilt: 0, bearing: 0 });
  }, [mapController, mapReady, nextIndex, next.position]);

  // Arrivals from the Navigation SDK advance the highlight as well.
  useEffect(() => {
    setOnArrival((event: ArrivalEvent) => {
      const id = event.waypoint.title ?? '';
      const arrivedIndex = route.findIndex(p => p.id === id);
      if (arrivedIndex >= 0) setNextIndex(Math.min(arrivedIndex + 1, route.length - 1));
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
  }, [navigationController, setOnArrival, removeAllListeners, route]);

  const setDestinations = useCallback(
    async (fromIndex: number) => {
      // Give the Navigation SDK the whole ordered journey, not a short batch.
      // It then knows every pickup/drop in sequence and keeps guidance going
      // after the driver confirms a stop.
      const options = {
        routingOptions: { travelMode: TravelMode.DRIVING },
        displayOptions: { showDestinationMarkers: true },
      };
      const asWaypoints = (points: DropPoint[]): Waypoint[] =>
        points.map(p => ({ title: p.id, position: p.position, vehicleStopover: true }));

      const result = await navigationController.setDestinations(
        asWaypoints(route.slice(fromIndex)),
        options,
      );
      if (result === RouteStatus.OK) return result;
      // A few SDK versions cap the waypoint count. Keep a shorter horizon and
      // rebuild it from the driver's current stop as each stop is confirmed.
      return navigationController.setDestinations(
        asWaypoints(route.slice(fromIndex, fromIndex + 10)),
        options,
      );
    },
    [navigationController, route],
  );

  const start = useCallback(async () => {
    setStatus('starting');
    try {
      const accepted = await navigationController.showTermsAndConditionsDialog();
      if (!accepted) {
        setStatus('error');
        setMessage('Masharti hayakukubaliwa.');
        return;
      }
      const session = await navigationController.init();
      if (session !== NavigationSessionStatus.OK) {
        setStatus('error');
        setMessage(`Imeshindwa kuanza: ${String(session)}`);
        return;
      }
      const route = await setDestinations(nextIndex);
      if (route !== RouteStatus.OK) {
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
  }, [navigationController, nextIndex, setDestinations]);

  const stop = useCallback(async () => {
    await navigationController.stopGuidance();
    setStatus('idle');
    setMessage('Maelekezo yamesimamishwa.');
  }, [navigationController]);

  const toggleGuidance = useCallback(() => {
    if (status === 'guiding') void stop();
    else void start();
  }, [start, status, stop]);

  // A driver may not know the route, so guidance begins as soon as the trip
  // opens. The sheet's Maelekezo button stays as a manual retry.
  useEffect(() => {
    if (guidanceStarted.current) return;
    guidanceStarted.current = true;
    const begin = async () => {
      try {
        const accepted = await navigationController.showTermsAndConditionsDialog();
        if (!accepted) {
          setMessage('Kubali masharti ili maelekezo yaendeshe.');
          return;
        }
        const session = await navigationController.init();
        if (session !== NavigationSessionStatus.OK) {
          setMessage('Maelekezo hayakuweza kuanzishwa.');
          return;
        }
        const result = await setDestinations(0);
        if (result !== RouteStatus.OK) {
          setMessage('Njia ya maelekezo haikupatikana.');
          return;
        }
        await navigationController.startGuidance();
        setStatus('guiding');
        setMessage('Maelekezo yanaendelea · fuata njia kwenye ramani.');
      } catch {
        setMessage('Bonyeza Maelekezo kujaribu tena.');
      }
    };
    void begin();
  }, [navigationController, setDestinations]);

  const advance = useCallback(() => {
    const current = route[nextIndex];
    if (!current || !canAdvance || isFinalStop) return;
    insertEvent({
      client_id: Crypto.randomUUID(),
      type: 'arrived_stop',
      label: current.stop,
      occurred_at: new Date().toISOString(),
      lat: current.position.lat,
      lng: current.position.lng,
    });
    setNextIndex(nextIndex + 1);
    setSelectedOverride(null);
    if (status === 'guiding') {
      void setDestinations(nextIndex + 1);
      void navigationController.startGuidance();
    }
  }, [canAdvance, isFinalStop, navigationController, nextIndex, route, setDestinations, status]);

  const promote = useCallback(
    (index: number) => {
      if (index === nextIndex || !route[index]) return;
      setNextIndex(index);
      setSelectedOverride(null);
      setMessage(`Kituo kijacho: ${route[index].stop}.`);
      if (status === 'guiding') {
        void setDestinations(index);
        void navigationController.startGuidance();
      }
    },
    [navigationController, nextIndex, route, setDestinations, status],
  );

  const record = useCallback((type: string, point: DropPoint) => {
    insertEvent({
      client_id: Crypto.randomUUID(),
      type,
      label: point.student,
      occurred_at: new Date().toISOString(),
      lat: point.position.lat,
      lng: point.position.lng,
    });
  }, []);

  // Asubuhi: confirm who got in, or who is absent with a parent's report.
  const markBoard = useCallback(
    (point: DropPoint) => {
      setProgress(prev => {
        const value = !prev.onboard[point.id];
        record(value ? 'boarded' : 'alighted', point);
        return {
          ...prev,
          onboard: { ...prev.onboard, [point.id]: value },
          absent: value ? { ...prev.absent, [point.id]: false } : prev.absent,
        };
      });
    },
    [record],
  );

  const markAbsent = useCallback((point: DropPoint) => {
    setProgress(prev => {
      const value = !prev.absent[point.id];
      return {
        ...prev,
        absent: { ...prev.absent, [point.id]: value },
        onboard: value ? { ...prev.onboard, [point.id]: false } : prev.onboard,
      };
    });
  }, []);

  // Jioni: confirm the guardian who collected the child, or that no
  // authorised guardian was present so the child stays on the bus.
  const markHandover = useCallback(
    (point: DropPoint) => {
      setProgress(prev => {
        const value = !prev.handed[point.id];
        record(value ? 'alighted' : 'boarded', point);
        return {
          ...prev,
          handed: { ...prev.handed, [point.id]: value },
          onboard: { ...prev.onboard, [point.id]: !value },
          remained: value ? { ...prev.remained, [point.id]: false } : prev.remained,
        };
      });
    },
    [record],
  );

  const markRemained = useCallback((point: DropPoint) => {
    setProgress(prev => {
      const value = !prev.remained[point.id];
      return {
        ...prev,
        remained: { ...prev.remained, [point.id]: value },
        handed: value ? { ...prev.handed, [point.id]: false } : prev.handed,
      };
    });
  }, []);

  const markArrived = useCallback((point: DropPoint) => {
    setProgress(prev => ({
      ...prev,
      arrived: { ...prev.arrived, [point.id]: !prev.arrived[point.id] },
    }));
  }, []);

  const toggleSound = useCallback(async () => {
    const enabled = !soundOn;
    setSoundOn(enabled);
    try {
      await navigationController.setAudioGuidanceSettings({
        guidanceMode: enabled ? AudioGuidanceMode.VOICE_ALERTS_AND_GUIDANCE : AudioGuidanceMode.SILENT,
        vibrationEnabled: true,
        bluetoothAudioEnabled: true,
      });
    } catch {
      // Voice settings are unavailable until a navigation session starts.
    }
  }, [navigationController, soundOn]);

  // --- Three-state bottom sheet -------------------------------------------
  const expandedHeight = Math.min(Math.round(height * 0.82), 720);
  const peekHeight = 132 + bottomInset;
  const hiddenHeight = 34 + bottomInset;
  const offsetFor = useCallback(
    (mode: SheetMode) =>
      mode === 'expanded' ? 0 : mode === 'peek' ? expandedHeight - peekHeight : expandedHeight - hiddenHeight,
    [expandedHeight, hiddenHeight, peekHeight],
  );
  // Keep one Animated.Value for the gesture animation. The old
  // setValue-in-an-effect snapped the sheet back and fought the native driver.
  const [sheetY] = useState(() => new Animated.Value(expandedHeight - peekHeight));

  const animateSheet = useCallback(
    (mode: SheetMode) => {
      setSheetMode(mode);
      Animated.timing(sheetY, {
        toValue: offsetFor(mode),
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    },
    [offsetFor, sheetY],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Pressables win on touch-down. Only a deliberate vertical drag takes over.
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dy) > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.2,
        onPanResponderGrant: () => sheetY.stopAnimation(),
        onPanResponderMove: (_event, gesture) => {
          const base = offsetFor(sheetMode);
          sheetY.setValue(Math.min(expandedHeight - hiddenHeight, Math.max(0, base + gesture.dy)));
        },
        onPanResponderRelease: (_event, gesture) => {
          const up = gesture.dy < -36 || gesture.vy < -0.5;
          const down = gesture.dy > 36 || gesture.vy > 0.5;
          if (up) {
            animateSheet(sheetMode === 'hidden' ? 'peek' : 'expanded');
          } else if (down) {
            animateSheet(sheetMode === 'expanded' ? 'peek' : 'hidden');
          } else {
            animateSheet(sheetMode);
          }
        },
        onPanResponderTerminate: () => animateSheet(sheetMode),
      }),
    [animateSheet, expandedHeight, hiddenHeight, offsetFor, sheetMode, sheetY],
  );

  const onMapController = useCallback((controller: MapViewController) => setMapController(controller), []);
  const onMapReady = useCallback(() => setMapReady(true), []);
  const onCircleClick = useCallback(
    (circle: Circle) => {
      const index = route.findIndex(p => `drop-${p.id}` === circle.id);
      if (index < 0) return;
      lastCircleTap.current = Date.now();
      setSelectedOverride(index);
      animateSheet('peek');
    },
    [animateSheet, route],
  );
  const onMapClick = useCallback(() => {
    // A tap on a marker can also surface as a map click; don't hide the sheet
    // immediately after showing the tapped stop.
    if (Date.now() - lastCircleTap.current < 400) return;
    if (sheetMode !== 'hidden') animateSheet('hidden');
  }, [animateSheet, sheetMode]);

  const fitAll = useCallback(() => {
    if (!mapController) return;
    const lats = route.map(p => p.position.lat);
    const lngs = route.map(p => p.position.lng);
    void mapController.moveCamera({
      target: {
        lat: (Math.min(...lats) + Math.max(...lats)) / 2,
        lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
      },
      zoom: 11.5,
      tilt: 0,
      bearing: 0,
    });
    // The expanded sheet covers most of the map; collapse it so the driver
    // can actually see the full route the button just fitted.
    animateSheet('hidden');
  }, [animateSheet, mapController, route]);

  const recenterBus = useCallback(() => {
    if (!mapController) return;
    void mapController.moveCamera({
      target: busPosition ?? next.position,
      zoom: 15.5,
      tilt: 0,
      bearing: 0,
    });
  }, [busPosition, mapController, next.position]);

  const faceNorth = useCallback(() => {
    if (!mapController) return;
    void mapController.moveCamera({
      target: busPosition ?? next.position,
      zoom: 14.5,
      tilt: 0,
      bearing: 0,
    });
  }, [busPosition, mapController, next.position]);

  const visibleSheetHeight = sheetMode === 'expanded' ? expandedHeight : sheetMode === 'peek' ? peekHeight : hiddenHeight;
  const overlayBottom = sheetMode === 'expanded' ? undefined : visibleSheetHeight + 12;

  const sheetProps = {
    mode: sheetMode,
    canAdvance,
    distance,
    etaMinutes,
    index: selectedIndex,
    message,
    nextIndex,
    onAdvance: advance,
    onCloseTrip: () => setShowClose(true),
    onEndTrip,
    onExpand: () => animateSheet('expanded'),
    onFitAll: fitAll,
    onOpenGps,
    onPromote: promote,
    onRestore: () => animateSheet('peek'),
    onToggleAbsent: markAbsent,
    onToggleArrived: markArrived,
    onToggleBoard: markBoard,
    onToggleGuidance: toggleGuidance,
    onToggleHandover: markHandover,
    onToggleRemained: markRemained,
    progress,
    roadStatus,
    route,
    session: trip.session,
    status,
  };

  return (
    <View style={styles.root}>
      <View style={styles.mapWrap}>
        <NavigationView
          style={styles.map}
          mapStyle={MAP_STYLE_JSON}
          navigationNightMode={NavigationNightMode.FORCE_DAY}
          androidStylingOptions={{
            primaryDayModeThemeColor: colors.route,
            secondaryDayModeThemeColor: colors.ink,
            headerLargeManeuverIconColor: '#FFFFFF',
            headerSmallManeuverIconColor: '#FFFFFF',
            headerNextStepTextColor: '#FFFFFF',
            headerDistanceValueTextColor: '#FFFFFF',
            headerDistanceUnitsTextColor: '#CFCFD6',
            headerInstructionsTextColor: '#FFFFFF',
          }}
          headerEnabled={false}
          footerEnabled={false}
          tripProgressBarEnabled={false}
          speedLimitIconEnabled={false}
          recenterButtonEnabled={false}
          reportIncidentButtonEnabled={false}
          mapToolbarEnabled={false}
          compassEnabled={false}
          myLocationButtonEnabled={false}
          onMapReady={onMapReady}
          onMapViewControllerCreated={onMapController}
          onCircleClick={onCircleClick}
          onMapClick={onMapClick}
        />
      </View>

      {/* Dynamic drop-off banner — replaces the old fixed app bar. */}
      <Pressable
        onPress={() => animateSheet('expanded')}
        accessibilityRole="button"
        accessibilityLabel="Fungua maelezo ya kituo kijacho"
        style={[styles.banner, { top: topInset + 10 }]}
      >
        <View style={styles.bannerDistance}>
          <Text style={styles.bannerValue}>{distance != null ? distance.toFixed(1) : '—'}</Text>
          <Text style={styles.bannerUnit}>km</Text>
        </View>
        <View style={styles.bannerInfo}>
          <Text style={styles.bannerStop} numberOfLines={1}>{next.stop.split(' · ')[0]}</Text>
          <Text style={styles.bannerVehicle} numberOfLines={1}>
            {trip.plate} · {trip.vehicle}
          </Text>
          <Text style={styles.bannerMeta} numberOfLines={1}>
            {trip.route} · {trip.session} · Kituo {nextIndex + 1}/{route.length} ·{' '}
            {isSchool(next) ? 'Shule' : `${stopStudents.length} wanafunzi`}
          </Text>
        </View>
        <Text style={styles.bannerChevron}>⌄</Text>
      </Pressable>

      {sheetMode !== 'expanded' && (
        <>
          {/* Speed indicator sits just above the sheet, bottom-left. */}
          <View style={[styles.speedPill, { bottom: overlayBottom }]} pointerEvents="none">
            <Text style={styles.speedValue}>{speedKmh ?? '—'}</Text>
            <Text style={styles.speedUnit}>km/h</Text>
          </View>

          {/* Telemetry and map controls float in compact pills on the right. */}
          <View style={[styles.rightRail, { bottom: overlayBottom }]}>
            <View style={styles.onboardPill} pointerEvents="none">
              <Text style={styles.onboardLabel}>Ndani ya basi</Text>
              <Text style={styles.onboardValue}>
                {onboard} <Text style={styles.onboardTotal}>/ {DROP_POINTS.length}</Text>
              </Text>
            </View>
            <View style={styles.controlStack}>
              <Pressable
                onPress={() => void toggleSound()}
                accessibilityRole="button"
                accessibilityLabel={soundOn ? 'Zima sauti' : 'Washa sauti'}
                style={styles.controlButton}
              >
                <Text style={styles.controlIcon}>{soundOn ? 'S' : 'X'}</Text>
              </Pressable>
              <Pressable
                onPress={recenterBus}
                accessibilityRole="button"
                accessibilityLabel="Rudi kwenye basi"
                style={styles.controlButton}
              >
                <Text style={styles.controlIcon}>B</Text>
              </Pressable>
              <Pressable
                onPress={fitAll}
                accessibilityRole="button"
                accessibilityLabel="Ona vituo vyote"
                style={styles.controlButton}
              >
                <Text style={styles.controlIcon}>20</Text>
              </Pressable>
              <Pressable
                onPress={faceNorth}
                accessibilityRole="button"
                accessibilityLabel="Elekeza kaskazini"
                style={styles.controlButton}
              >
                <Text style={styles.controlIcon}>C</Text>
              </Pressable>
              <Pressable
                onPress={() => animateSheet('peek')}
                accessibilityRole="button"
                accessibilityLabel="Fungua maelezo ya safari"
                style={styles.controlButton}
              >
                <Text style={styles.controlIcon}>◎</Text>
              </Pressable>
            </View>
          </View>
        </>
      )}

      {isWide ? (
        <View style={styles.panelWide}>
          <StopSheet {...sheetProps} mode="expanded" />
        </View>
      ) : (
        <Animated.View
          style={[
            styles.sheet,
            { height: expandedHeight, transform: [{ translateY: sheetY }] },
          ]}
        >
          <StopSheet {...sheetProps} panHandlers={panResponder.panHandlers as ViewProps} />
        </Animated.View>
      )}

      <TripClose
        visible={showClose}
        trip={trip}
        progress={progress}
        onCancel={() => setShowClose(false)}
        onConfirm={() => {
          setShowClose(false);
          onEndTrip();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  mapWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  map: { flex: 1 },

  banner: {
    position: 'absolute',
    left: 12,
    right: 12,
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 22,
    backgroundColor: colors.banner,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
    zIndex: 5,
  },
  bannerDistance: { minWidth: 78, alignItems: 'center' },
  bannerValue: { fontSize: 34, fontWeight: '700', color: colors.bannerInk, lineHeight: 38 },
  bannerUnit: { fontSize: 13, color: colors.bannerMuted },
  bannerInfo: { flex: 1, minWidth: 0 },
  bannerStop: { fontSize: 19, fontWeight: '600', color: colors.bannerInk },
  bannerVehicle: { fontSize: 12, fontWeight: '600', color: colors.bannerInk, marginTop: 2 },
  bannerMeta: { fontSize: 12, color: colors.bannerMuted, marginTop: 2 },
  bannerChevron: { fontSize: 22, color: colors.bannerMuted },

  speedPill: {
    position: 'absolute',
    left: 12,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    zIndex: 4,
  },
  speedValue: { fontSize: 28, fontWeight: '700', color: colors.ink },
  speedUnit: { fontSize: 13, color: colors.secondary },

  rightRail: { position: 'absolute', right: 12, alignItems: 'flex-end', gap: 8, zIndex: 4 },
  onboardPill: {
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
  },
  onboardLabel: { fontSize: 11, color: colors.secondary },
  onboardValue: { fontSize: 18, fontWeight: '600', color: colors.ink },
  onboardTotal: { fontSize: 12, color: colors.secondary },
  controlStack: {
    padding: 6,
    gap: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(17, 17, 20, 0.55)',
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlIcon: { color: colors.card, fontSize: 16, fontWeight: '700' },

  panelWide: {
    position: 'absolute',
    top: 120,
    right: 12,
    bottom: 12,
    width: 380,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.card,
    zIndex: 5,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -4 },
    // No Android elevation on this transformed view: elevation + translateY
    // was shifting touch targets and swallowing sheet button presses.
    zIndex: 6,
  },
});
