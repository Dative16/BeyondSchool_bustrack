// src/App.tsx — the app shell: two tabs, wrapped in Google's NavigationProvider.
//
// The real app will use Expo Router (file-based screens, like Next.js). For a
// two-screen spike, a simple useState switch is easier to read.
import { NavigationProvider, TaskRemovedBehavior } from '@googlemaps/react-native-navigation-sdk';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { NavScreen } from './nav/NavScreen';
import { HomeScreen } from './ui/HomeScreen';
import { colors } from './ui/theme';

type Tab = 'home' | 'nav';

export default function App() {
  const [tab, setTab] = useState<Tab>('home');

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
      <SafeAreaView style={styles.root}>
        <StatusBar style="dark" />
        <View style={styles.tabs}>
          <TabButton label="GPS na foleni" active={tab === 'home'} onPress={() => setTab('home')} />
          <TabButton label="Maelekezo" active={tab === 'nav'} onPress={() => setTab('nav')} />
        </View>
        <View style={styles.body}>{tab === 'home' ? <HomeScreen /> : <NavScreen />}</View>
      </SafeAreaView>
    </NavigationProvider>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={[styles.tab, active && styles.tabActive]}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  tab: { height: 44, paddingHorizontal: 18, borderRadius: 999, backgroundColor: colors.muted, justifyContent: 'center' },
  tabActive: { backgroundColor: colors.ink },
  tabText: { fontSize: 15, fontWeight: '500', color: colors.ink },
  tabTextActive: { color: '#FFFFFF' },
  body: { flex: 1 },
});
