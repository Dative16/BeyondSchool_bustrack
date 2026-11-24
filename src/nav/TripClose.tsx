// src/nav/TripClose.tsx — final confirmation before a trip is closed.
import type { TripContext } from '../auth/session';
import { DROP_POINTS } from '../data/dropPoints';
import { colors } from '../ui/theme';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  absentCount,
  arrivalCount,
  handedCount,
  notArrived,
  notHanded,
  onboardCount,
  remainedCount,
  type Progress,
} from './tripFlow';

type Props = {
  visible: boolean;
  trip: TripContext;
  progress: Progress;
  onCancel: () => void;
  onConfirm: () => void;
};

export function TripClose({ visible, trip, progress, onCancel, onConfirm }: Props) {
  const isMorning = trip.session === 'Asubuhi';
  const picked = onboardCount(progress);
  const arrived = arrivalCount(progress);
  const handed = handedCount(progress);
  const missing = isMorning ? notArrived(progress) : notHanded(progress);
  const canClose = missing.length === 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.eyebrow}>HATUA YA MWISHO</Text>
            <Text style={styles.title}>
              {isMorning ? 'Funga safari ya asubuhi' : 'Funga safari ya jioni'}
            </Text>
            <Text style={styles.subtitle}>
              {trip.route} · {trip.session} · {trip.driver.name}
            </Text>

            <View style={styles.stats}>
              {isMorning ? (
                <>
                  <Stat label="Wamepanda" value={`${picked}/${DROP_POINTS.length}`} />
                  <Stat label="Hayupo" value={`${absentCount(progress)}`} />
                  <Stat label="Wamefika shuleni" value={`${arrived}/${picked}`} />
                </>
              ) : (
                <>
                  <Stat label="Wamepokelewa" value={`${handed}/${DROP_POINTS.length}`} />
                  <Stat label="Waliobaki kwenye basi" value={`${remainedCount(progress)}`} />
                  <Stat label="Bado kushushwa" value={`${missing.length}`} />
                </>
              )}
            </View>

            {missing.length > 0 ? (
              <View style={styles.warning}>
                <Text style={styles.warningTitle}>
                  {isMorning ? 'Bado hawajafika shuleni:' : 'Bado hawajashushwa:'}
                </Text>
                {missing.map(p => (
                  <Text key={p.id} style={styles.warningRow}>• {p.student} · {p.stop}</Text>
                ))}
              </View>
            ) : (
              <View style={styles.okBox}>
                <Text style={styles.okText}>
                  {isMorning
                    ? 'Kila aliyepanda amefika shuleni. Safari iko tayari kufungwa.'
                    : 'Kila mwanafunzi ameshushwa kwenye kituo chake kilichosajiliwa.'}
                </Text>
              </View>
            )}

            <View style={styles.actions}>
              <Pressable
                onPress={onCancel}
                accessibilityRole="button"
                style={styles.secondary}
              >
                <Text style={styles.secondaryText}>Rudi kwenye ramani</Text>
              </Pressable>
              <Pressable
                onPress={onConfirm}
                disabled={!canClose}
                accessibilityRole="button"
                style={[styles.primary, !canClose && styles.primaryDisabled]}
              >
                <Text style={styles.primaryText}>Thibitisha na funga safari</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  card: {
    maxHeight: '88%',
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  content: { padding: 20, paddingBottom: 28, gap: 12 },
  eyebrow: { fontSize: 12, fontWeight: '700', color: colors.secondary, letterSpacing: 1 },
  title: { fontSize: 26, fontWeight: '700', color: colors.ink },
  subtitle: { fontSize: 14, color: colors.secondary },

  stats: { flexDirection: 'row', gap: 8, marginTop: 8 },
  stat: {
    flex: 1,
    backgroundColor: colors.muted,
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
  },
  statValue: { fontSize: 22, fontWeight: '700', color: colors.ink },
  statLabel: { fontSize: 11, color: colors.secondary, textAlign: 'center', marginTop: 3 },

  okBox: { backgroundColor: colors.muted, borderRadius: 18, padding: 14 },
  okText: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  warning: { backgroundColor: colors.warningChip, borderRadius: 18, padding: 14, gap: 3 },
  warningTitle: { fontSize: 14, fontWeight: '600', color: colors.warningInk },
  warningRow: { fontSize: 13, color: colors.warningInk },

  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  secondary: {
    flex: 1,
    height: 54,
    borderRadius: 16,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { fontSize: 14, fontWeight: '600', color: colors.ink },
  primary: {
    flex: 2,
    height: 54,
    borderRadius: 16,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryDisabled: { backgroundColor: colors.muted },
  primaryText: { fontSize: 14, fontWeight: '600', color: colors.card },
});
