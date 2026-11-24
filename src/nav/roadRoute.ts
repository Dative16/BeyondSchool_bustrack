// src/nav/roadRoute.ts — turns raw coordinates into real road geometry.
//
// Uses the Routes API (v2) only. Directions API is legacy and is no longer
// offered on new Google Cloud projects, and a straight line between two drop
// points is not a road — so if Routes cannot answer, the map shows no route
// line at all instead of pretending the fallback is drivable.
import type { LatLng } from '@googlemaps/react-native-navigation-sdk';

const ROUTES_ENDPOINT = 'https://routes.googleapis.com/directions/v2:computeRoutes';

// The Maps key is restricted to this Android app. Web-service calls from the
// device must repeat that identity in headers, otherwise Google returns
// PERMISSION_DENIED even though the same key works for the map SDK.
const ANDROID_PACKAGE = 'tz.co.beyondschools.busspike';
const ANDROID_CERT = '5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25';
const androidHeaders = {
  'X-Android-Package': ANDROID_PACKAGE,
  'X-Android-Cert': ANDROID_CERT,
};

type RoutesResponse = {
  routes?: {
    legs?: { distanceMeters?: number }[];
    polyline?: { encodedPolyline?: string };
  }[];
};

export type RoadRoute = {
  points: LatLng[];
  distanceKm: number | null;
};

/** Decode Google's encoded polyline (precision 1e-5) into LatLng vertices. */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

const asLatLng = (point: LatLng) => ({ latitude: point.lat, longitude: point.lng });

/**
 * Ask the Routes API for a driving route through the remaining drop points.
 * Returns null on any failure; callers must not draw a straight-line "road".
 */
export async function fetchRoadRoute(
  origin: LatLng,
  destinations: LatLng[],
  apiKey: string,
): Promise<RoadRoute | null> {
  if (!apiKey || destinations.length === 0) return null;

  const last = destinations[destinations.length - 1];
  const body = {
    origin: { location: { latLng: asLatLng(origin) } },
    destination: { location: { latLng: asLatLng(last) } },
    // Routes API v2 calls stopovers "intermediates"; "waypoints" is rejected.
    ...(destinations.length > 1
      ? {
          intermediates: destinations.slice(0, -1).map(point => ({
            location: { latLng: asLatLng(point) },
            vehicleStopover: true,
          })),
        }
      : {}),
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_AWARE',
    computeAlternativeRoutes: false,
    languageCode: 'sw',
    units: 'METRIC',
  };

  const response = await fetch(ROUTES_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'routes.legs.distanceMeters,routes.polyline.encodedPolyline',
      ...androidHeaders,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 200);
    throw new Error(`Routes HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
  }

  const data = (await response.json()) as RoutesResponse;
  const route = data.routes?.[0];
  const encoded = route?.polyline?.encodedPolyline;
  if (!encoded) return null;

  const points = decodePolyline(encoded);
  if (points.length < 2) return null;

  // The driver's card shows the distance to the *next* stop, not the total
  // distance of the whole 20-stop route. In a Routes response the first leg is
  // always origin -> first destination (bus -> next drop point).
  const nextLegMetres = route.legs?.[0]?.distanceMeters;
  return {
    points,
    distanceKm: nextLegMetres != null ? nextLegMetres / 1000 : null,
  };
}
