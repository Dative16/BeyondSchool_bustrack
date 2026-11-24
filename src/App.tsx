// src/App.tsx — app shell and the exact driver flow:
//   sign in → confirm assignment → drive mode → (temporary GPS panel)
import { NavigationProvider, TaskRemovedBehavior } from '@googlemaps/react-native-navigation-sdk';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Platform, Pressable, StatusBar as NativeStatusBar, StyleSheet, Text, View } from 'react-native';

import type { Driver, TripContext } from './auth/session';
import { NavScreen } from './nav/NavScreen';
import { AssignmentScreen } from './ui/AssignmentScreen';
import { HomeScreen } from './ui/HomeScreen';
import { SignInScreen } from './ui/SignInScreen';
import { colors } from './ui/theme';

type Stage = 'signin' | 'assign' | 'drive' | 'gps';

// Android's status-bar height keeps overlays below the notification bar. The
// map itself stays edge-to-edge; only the floating cards use these insets.
const topInset = Platform.OS === 'android' ? Math.max(NativeStatusBar.currentHeight ?? 24, 24) : 0;

export default function App() {
  const [stage, setStage] = useState<Stage>('signin');
  const [driver, setDriver] = useState<Driver | null>(null);
  const [trip, setTrip] = useState<TripContext | null>(null);

  const signOut = () => {
    setDriver(null);
    setTrip(null);
    setStage('signin');
  };

  return (
    <NavigationProvider
      termsAndConditionsDialogOptions={{
        title: 'Masharti ya maelekezo',
        companyName: 'BeyondSchools',
        showOnlyDisclaimer: false,
      }}
      // Keep navigation running if the app is swiped away from recent apps.
      taskRemovedBehavior={TaskRemovedBehavior.CONTINUE_SERVICE}
    >
      <StatusBar style="dark" />
      <View style={styles.root}>
        {stage === 'signin' ? (
          <SignInScreen
            topInset={topInset}
            onSignedIn={nextDriver => {
              setDriver(nextDriver);
              setStage('assign');
            }}
          />
        ) : stage === 'assign' && driver ? (
          <AssignmentScreen
            topInset={topInset}
            driver={driver}
            onConfirm={nextTrip => {
              setTrip(nextTrip);
              setStage('drive');
            }}
            onSignOut={signOut}
          />
        ) : stage === 'gps' ? (
          <View style={[styles.gpsWrap, { paddingTop: topInset + 20 }]}>
            <Pressable
              onPress={() => setStage('drive')}
              accessibilityRole="button"
              accessibilityLabel="Rudi kwenye ramani"
              style={styles.backPill}
            >
              <Text style={styles.backText}>‹ Ramani ya vituo</Text>
            </Pressable>
            <HomeScreen />
          </View>
        ) : trip ? (
          <NavScreen
            trip={trip}
            onOpenGps={() => setStage('gps')}
            onEndTrip={() => setStage('assign')}
          />
        ) : null}
      </View>
    </NavigationProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  // The GPS screen keeps the back button in normal flow. Absolute positioning
  // let it sit under the status bar and on top of the first white card.
  gpsWrap: { flex: 1, backgroundColor: colors.ground },
  backPill: {
    alignSelf: 'flex-start',
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.ink,
  },
  backText: { color: colors.card, fontSize: 15, fontWeight: '600' },
});
