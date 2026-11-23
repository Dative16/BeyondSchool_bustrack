// app.config.ts — the app's native configuration.
//
// RN/Expo note: we never edit the android/ folder by hand. `npx expo prebuild`
// GENERATES it from this file and the "plugins" below. If you need a native
// setting, it goes here (or in a config plugin), then you re-run prebuild.
import type { ConfigContext, ExpoConfig } from 'expo/config';

const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY ?? '';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Bus Spike',
  slug: 'bus-spike',
  version: '0.1.0',
  // The dashboard tablet is mounted landscape; the spike works either way.
  orientation: 'default',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  android: {
    package: 'tz.co.beyondschools.busspike',
    adaptiveIcon: {
      backgroundColor: '#ECECEE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    // Read by the Navigation SDK plugin and written into AndroidManifest.xml.
    config: { googleMaps: { apiKey: googleMapsApiKey } },
    permissions: [
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION',
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_LOCATION',
      'POST_NOTIFICATIONS',
    ],
  },
  plugins: [
    [
      'expo-location',
      {
        // Android: lets the app keep receiving GPS when the screen is off.
        isAndroidBackgroundLocationEnabled: true,
        // Android: runs location as a "foreground service" — the permanent
        // notification that tells Android "don't kill me, I'm working".
        isAndroidForegroundServiceEnabled: true,
      },
    ],
    'expo-sqlite',
    [
      'expo-build-properties',
      {
        android: {
          // Navigation SDK needs Android 7.0 (API 24) or newer.
          minSdkVersion: 24,
          // Navigation SDK needs Kotlin 2.3+; React Native 0.88 ships 2.2.0.
          // Without this override the Android build fails to compile.
          kotlinVersion: '2.3.21',
        },
      },
    ],
    // Adds desugaring + Jetifier to the Android build, and checks the API key.
    '@googlemaps/react-native-navigation-sdk',
  ],
});
