// src/ui/SignInScreen.tsx — step 1 of the driver flow.
import { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { signInLocal, type Driver } from '../auth/session';
import { colors } from './theme';

type Props = {
  topInset: number;
  onSignedIn: (driver: Driver) => void;
};

export function SignInScreen({ topInset, onSignedIn }: Props) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const driver = signInLocal(phone, password);
    if (!driver) {
      setError('Weka nambari ya Tanzania (mfano 0712345678) na nywila ya angalau herufi 6.');
      return;
    }
    setError(null);
    Keyboard.dismiss();
    onSignedIn(driver);
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior="padding">
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: topInset + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <View style={styles.mark}>
            <Text style={styles.markText}>BS</Text>
          </View>
          <Text style={styles.title}>Karibu, dereva</Text>
          <Text style={styles.subtitle}>Ingia ili uanze safari yako.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Nambari ya simu</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="0712 345 678"
            placeholderTextColor={colors.secondary}
            keyboardType="phone-pad"
            autoComplete="tel"
            maxLength={16}
            returnKeyType="next"
          />

          <Text style={styles.label}>Nywila</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Nywila"
            placeholderTextColor={colors.secondary}
            secureTextEntry
            autoComplete="current-password"
            returnKeyType="done"
            onSubmitEditing={submit}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            onPress={submit}
            accessibilityRole="button"
            accessibilityLabel="Ingia"
            style={styles.primary}
          >
            <Text style={styles.primaryText}>Ingia</Text>
          </Pressable>

          <Text style={styles.hint}>
            Kwa majaribio: nambari yoyote ya Tanzania iliyo sawa, nywila angalau herufi 6.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  content: { paddingHorizontal: 20, paddingBottom: 32, gap: 24 },
  brand: { gap: 6 },
  mark: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  markText: { color: colors.card, fontSize: 20, fontWeight: '700' },
  title: { fontSize: 30, fontWeight: '700', color: colors.ink },
  subtitle: { fontSize: 16, color: colors.secondary },

  card: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 20,
    gap: 10,
  },
  label: { fontSize: 14, fontWeight: '600', color: colors.secondary, marginTop: 4 },
  input: {
    height: 54,
    borderRadius: 16,
    backgroundColor: colors.muted,
    paddingHorizontal: 16,
    fontSize: 17,
    color: colors.ink,
  },
  error: { fontSize: 13, color: colors.warn, lineHeight: 18 },
  primary: {
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryText: { color: colors.card, fontSize: 17, fontWeight: '600' },
  hint: { fontSize: 12, color: colors.secondary, lineHeight: 17, marginTop: 2 },
});
