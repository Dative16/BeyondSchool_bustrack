// src/nav/StopSheet.tsx — the driver's multi-state bottom sheet.
//
// Three states, driven by NavScreen's swipe animation:
//   peek     — one compact action row over the map
//   expanded — per-stop confirmations, manifest and the whole route timeline
//   hidden   — a thin grab handle for maximum road visibility
//
// Asubuhi stops ask for Amepanda / Hayupo, then Amefika shuleni at the school.
// Jioni stops ask "Nani amempokea?" with Amepokelewa / Atabaki kwenye basi.
import type { SessionType } from '../auth/session';
import { DROP_POINTS, type DropPoint } from '../data/dropPoints';
import { colors } from '../ui/theme';
import { Pressable, ScrollView, StyleSheet, Text, View, type ViewProps } from 'react-native';

import { isSchool, studentsForStop, type Progress } from './tripFlow';

export type GuidanceStatus = 'idle' | 'starting' | 'guiding' | 'error';
export type RoadStatus = 'loading' | 'roads' | 'unavailable';
export type SheetMode = 'peek' | 'expanded' | 'hidden';

type Props = {
  mode: SheetMode;
  index: number;
  nextIndex: number;
  session: SessionType;
  route: DropPoint[];
  progress: Progress;
  distance: number | null;
  etaMinutes: number | null;
  roadStatus: RoadStatus;
  status: GuidanceStatus;
  message: string;
  canAdvance: boolean;
  panHandlers?: ViewProps;
  onToggleBoard: (point: DropPoint) => void;
  onToggleAbsent: (point: DropPoint) => void;
  onToggleHandover: (point: DropPoint) => void;
  onToggleRemained: (point: DropPoint) => void;
  onToggleArrived: (point: DropPoint) => void;
  onAdvance: () => void;
  onCloseTrip: () => void;
  onEndTrip: () => void;
  onPromote: (index: number) => void;
  onToggleGuidance: () => void;
  onOpenGps: () => void;
  onFitAll: () => void;
  onRestore: () => void;
  onExpand: () => void;
};

const roadLabel: Record<RoadStatus, string> = {
  loading: 'Inatafuta njia ya barabara…',
  roads: 'Njia inafuata barabara',
  unavailable: 'Njia ya barabara haipatikani',
};

const stopBases = Array.from(new Set(DROP_POINTS.map(p => p.stop.split(' · ')[0].trim())));

// A tap that drifts more than a few pixels should be a swipe, not also a
// button press. Keeping press retention tight stops one gesture firing both.
const pressTuning = { hitSlop: 6, pressRetentionOffset: 0 } as const;

export function StopSheet({
  mode,
  index,
  nextIndex,
  session,
  route,
  progress,
  distance,
  etaMinutes,
  roadStatus,
  status,
  message,
  canAdvance,
  panHandlers,
  onToggleBoard,
  onToggleAbsent,
  onToggleHandover,
  onToggleRemained,
  onToggleArrived,
  onAdvance,
  onCloseTrip,
  onEndTrip,
  onPromote,
  onToggleGuidance,
  onOpenGps,
  onFitAll,
  onRestore,
  onExpand,
}: Props) {
  const point = route[index] ?? route[0];
  const isSchoolPoint = isSchool(point);
  const isMorning = session === 'Asubuhi';
  const isFinal = nextIndex >= route.length - 1;
  const students = studentsForStop(route, index);
  const onboard = Object.values(progress.onboard).filter(Boolean).length;
  const eta = etaMinutes != null ? `≈ ${etaMinutes} min · ` : '';
  const distanceLabel = `${eta}${distance != null ? `${distance.toFixed(1)} km` : '—'}`;

  const confirmed = isSchoolPoint
    ? studentsAtSchool(progress)
    : students.filter(s =>
        isMorning
          ? Boolean(progress.onboard[s.id] || progress.absent[s.id])
          : Boolean(progress.handed[s.id] || progress.remained[s.id]),
      ).length;

  const progressLabel = isSchoolPoint
    ? `${confirmed}/${onboard} wamefika shuleni`
    : isMorning
      ? `${confirmed}/${students.length} wamepanda`
      : `${confirmed}/${students.length} wamepokelewa`;

  if (mode === 'hidden') {
    return (
      <Pressable
        {...pressTuning}
        {...panHandlers}
        onPress={onRestore}
        accessibilityRole="button"
        accessibilityLabel="Fungua maelezo ya kituo"
        style={styles.hiddenBar}
      >
        <View style={styles.handle} />
        <Text style={styles.hiddenText}>
          {point.stop.split(' · ')[0]} · {progressLabel}
        </Text>
      </Pressable>
    );
  }

  // The whole peek row is draggable; the expanded sheet keeps a taller
  // header so a swipe does not fight the ScrollView beneath it.
  const dragArea = (
    <View style={styles.dragArea}>
      <View style={styles.handle} />
    </View>
  );

  if (mode === 'peek') {
    return (
      <View {...panHandlers} style={styles.root}>
        {dragArea}
        <View style={styles.peekRow}>
          <Pressable
            {...pressTuning}
            onPress={onExpand}
            accessibilityRole="button"
            accessibilityLabel="Fungua maelezo ya safari"
            style={styles.peekIconButton}
          >
            <Text style={styles.peekIcon}>≡</Text>
          </Pressable>

          <View style={styles.peekInfo}>
            <Text style={styles.peekStop} numberOfLines={1}>
              {point.stop.split(' · ')[0]}
            </Text>
            <Text style={styles.peekMeta} numberOfLines={1}>
              {distanceLabel} · {progressLabel}
            </Text>
          </View>

          <Pressable
            {...pressTuning}
            onPress={onAdvance}
            disabled={!canAdvance || isFinal}
            accessibilityRole="button"
            accessibilityLabel="Fungua kituo kijacho"
            style={[styles.peekNext, (!canAdvance || isFinal) && styles.nextButtonDisabled]}
          >
            <Text style={styles.peekNextText}>‹ Kituo ›</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View {...panHandlers}>{dragArea}</View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.modeRow}>
          <View style={[styles.modePill, styles.modePillActive]}>
            <Text style={[styles.modeText, styles.modeTextActive]}>Ramani ya vituo</Text>
          </View>
          <Pressable
            {...pressTuning}
            onPress={onOpenGps}
            accessibilityRole="button"
            accessibilityLabel="Fungua GPS na foleni"
            style={styles.modePill}
          >
            <Text style={styles.modeText}>GPS na foleni</Text>
          </Pressable>
          <Pressable
            {...pressTuning}
            onPress={onFitAll}
            accessibilityRole="button"
            accessibilityLabel="Ona vituo vyote"
            style={styles.modePill}
          >
            <Text style={styles.modeText}>Njia yote</Text>
          </Pressable>
        </View>

        <View style={styles.stopCard}>
          <View style={styles.stopCardTop}>
            <Text style={styles.stopCardName} numberOfLines={1}>
              {point.stop.split(' · ')[0]}
            </Text>
            <Text style={styles.stopCardDistance}>{distanceLabel}</Text>
          </View>
          <Text style={styles.stopCardMeta}>
            {isMorning ? 'Kuchukua wanafunzi' : 'Kushusha wanafunzi'} · {index + 1} / {route.length} ·{' '}
            {isSchoolPoint ? 'Mwisho wa safari' : `${students.length} wanafunzi`}
          </Text>
          <Text style={styles.roadNote}>{roadLabel[roadStatus]}</Text>
        </View>

        {isSchoolPoint ? (
          <SchoolChecklist progress={progress} onToggleArrived={onToggleArrived} />
        ) : isMorning ? (
          <PickupChecklist
            students={students}
            progress={progress}
            onToggleBoard={onToggleBoard}
            onToggleAbsent={onToggleAbsent}
          />
        ) : (
          <HandoverChecklist
            students={students}
            progress={progress}
            onToggleHandover={onToggleHandover}
            onToggleRemained={onToggleRemained}
          />
        )}

        <View style={styles.statusRow}>
          <Text style={styles.statusText} numberOfLines={2}>{message}</Text>
          <Pressable
            {...pressTuning}
            onPress={onToggleGuidance}
            disabled={status === 'starting'}
            accessibilityRole="button"
            style={[styles.guideButton, status === 'starting' && styles.guideButtonDisabled]}
          >
            <Text style={styles.guideButtonText}>
              {status === 'guiding' ? 'Simamisha' : 'Maelekezo'}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>
          {isMorning ? 'Wanafunzi wote' : 'Wanafunzi wote'} · {onboard}/{DROP_POINTS.length} ndani ya basi
        </Text>
        <View style={styles.manifest}>
          {stopBases.map(base => (
            <View key={base} style={styles.manifestGroup}>
              <Text style={styles.manifestStop}>{base}</Text>
              {DROP_POINTS.filter(p => p.stop.split(' · ')[0].trim() === base).map(student => (
                <View key={student.id} style={styles.studentRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{student.initials}</Text>
                  </View>
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>{student.student}</Text>
                    <Text style={styles.studentClass}>{student.studentClass}</Text>
                  </View>
                  <Text style={styles.manifestMark}>
                    {isMorning
                      ? progress.onboard[student.id]
                        ? '✓'
                        : progress.absent[student.id]
                          ? '×'
                          : ''
                      : progress.handed[student.id]
                        ? '✓'
                        : progress.remained[student.id]
                          ? '↩'
                          : ''}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Ratiba ya safari</Text>
        <View style={styles.queue}>
          {route.map((p, i) => (
            <Pressable
              {...pressTuning}
              key={p.id}
              onPress={() => onPromote(i)}
              accessibilityRole="button"
              style={[styles.queueRow, i === nextIndex && styles.queueRowActive]}
            >
              <View style={[styles.queueDot, i === nextIndex && styles.queueDotActive]} />
              <Text style={[styles.queueName, i === nextIndex && styles.queueNameActive]} numberOfLines={1}>
                {p.stop.split(' · ')[0]}
              </Text>
              <Text style={styles.queueCount}>
                {isSchool(p) ? 'Shule' : studentsForStop(route, i).length}
              </Text>
            </Pressable>
          ))}
        </View>

        {!isFinal ? (
          <Pressable
            {...pressTuning}
            onPress={onAdvance}
            disabled={!canAdvance}
            accessibilityRole="button"
            style={[styles.nextButton, styles.nextButtonWide, !canAdvance && styles.nextButtonDisabled]}
          >
            <Text style={styles.nextButtonText}>
              {canAdvance ? 'Endelea safari' : 'Thibitisha wanafunzi kwanza'}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            {...pressTuning}
            onPress={onCloseTrip}
            disabled={!canAdvance}
            accessibilityRole="button"
            style={[styles.nextButton, styles.nextButtonWide, !canAdvance && styles.nextButtonDisabled]}
          >
            <Text style={styles.nextButtonText}>
              {canAdvance ? 'Thibitisha na funga safari' : 'Thibitisha wanafunzi kwanza'}
            </Text>
          </Pressable>
        )}

        <Pressable
          {...pressTuning}
          onPress={onEndTrip}
          accessibilityRole="button"
          accessibilityLabel="Badilisha safari"
          style={styles.endTripButton}
        >
          <Text style={styles.endTripText}>Badilisha safari</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function studentsAtSchool(progress: Progress): number {
  return DROP_POINTS.filter(p => progress.onboard[p.id] && progress.arrived[p.id]).length;
}

function PickupChecklist({
  students,
  progress,
  onToggleBoard,
  onToggleAbsent,
}: {
  students: DropPoint[];
  progress: Progress;
  onToggleBoard: (point: DropPoint) => void;
  onToggleAbsent: (point: DropPoint) => void;
}) {
  return (
    <>
      <Text style={styles.sectionTitle}>Wanafunzi wa kuchukua · {students.length}</Text>
      <View style={styles.checklist}>
        {students.map(student => (
          <View key={student.id} style={styles.checkRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{student.initials}</Text>
            </View>
            <View style={styles.studentInfo}>
              <Text style={styles.studentName}>{student.student}</Text>
              <Text style={styles.studentClass}>{student.studentClass}</Text>
              {progress.absent[student.id] ? (
                <Text style={styles.noteText}>Hasafiri leo · mzazi ameripoti</Text>
              ) : null}
            </View>
            <View style={styles.actionColumn}>
              <Pressable
                {...pressTuning}
                onPress={() => onToggleBoard(student)}
                accessibilityRole="button"
                style={[styles.actionButton, progress.onboard[student.id] && styles.actionButtonActive]}
              >
                <Text style={[styles.actionText, progress.onboard[student.id] && styles.actionTextActive]}>
                  Amepanda
                </Text>
              </Pressable>
              <Pressable
                {...pressTuning}
                onPress={() => onToggleAbsent(student)}
                accessibilityRole="button"
                style={[styles.actionButton, progress.absent[student.id] && styles.actionButtonActive]}
              >
                <Text style={[styles.actionText, progress.absent[student.id] && styles.actionTextActive]}>
                  Hayupo
                </Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
    </>
  );
}

function HandoverChecklist({
  students,
  progress,
  onToggleHandover,
  onToggleRemained,
}: {
  students: DropPoint[];
  progress: Progress;
  onToggleHandover: (point: DropPoint) => void;
  onToggleRemained: (point: DropPoint) => void;
}) {
  return (
    <>
      <Text style={styles.sectionTitle}>Nani amempokea? · {students.length}</Text>
      <View style={styles.checklist}>
        {students.map(student => {
          const hasGuardian = student.guardian.trim().length > 0;
          return (
            <View key={student.id} style={styles.checkRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{student.initials}</Text>
              </View>
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{student.student}</Text>
                <Text style={styles.studentClass}>{student.studentClass}</Text>
                <Text style={[styles.guardianText, !hasGuardian && styles.warningText]}>
                  {hasGuardian
                    ? `${student.guardian} · ${student.relationship}`
                    : 'Hakuna mlezi aliyeidhinishwa hapa'}
                </Text>
              </View>
              <View style={styles.actionColumn}>
                <Pressable
                  {...pressTuning}
                  onPress={() => onToggleHandover(student)}
                  disabled={!hasGuardian}
                  accessibilityRole="button"
                  style={[
                    styles.actionButton,
                    progress.handed[student.id] && styles.actionButtonActive,
                    !hasGuardian && styles.actionButtonDisabled,
                  ]}
                >
                  <Text style={[styles.actionText, progress.handed[student.id] && styles.actionTextActive]}>
                    Amepokelewa
                  </Text>
                </Pressable>
                <Pressable
                  {...pressTuning}
                  onPress={() => onToggleRemained(student)}
                  accessibilityRole="button"
                  style={[styles.actionButton, progress.remained[student.id] && styles.actionButtonActive]}
                >
                  <Text style={[styles.actionText, progress.remained[student.id] && styles.actionTextActive]}>
                    Atabaki
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>
    </>
  );
}

function SchoolChecklist({
  progress,
  onToggleArrived,
}: {
  progress: Progress;
  onToggleArrived: (point: DropPoint) => void;
}) {
  const onboardStudents = DROP_POINTS.filter(p => progress.onboard[p.id]);
  return (
    <>
      <Text style={styles.sectionTitle}>Kufika shuleni · {studentsAtSchool(progress)}/{onboardStudents.length}</Text>
      <View style={styles.checklist}>
        {onboardStudents.length === 0 ? (
          <Text style={styles.noteText}>Hakuna wanafunzi walioidhinishwa kwenye basi.</Text>
        ) : (
          onboardStudents.map(student => (
            <View key={student.id} style={styles.checkRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{student.initials}</Text>
              </View>
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{student.student}</Text>
                <Text style={styles.studentClass}>{student.studentClass}</Text>
              </View>
              <Pressable
                {...pressTuning}
                onPress={() => onToggleArrived(student)}
                accessibilityRole="button"
                style={[styles.actionButton, progress.arrived[student.id] && styles.actionButtonActive]}
              >
                <Text style={[styles.actionText, progress.arrived[student.id] && styles.actionTextActive]}>
                  Amefika shuleni
                </Text>
              </Pressable>
            </View>
          ))
        )}
        <Text style={styles.noteText}>
          Tembea hadi kiti cha mwisho ukakague viti kabla ya kufunga safari.
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.card },
  handle: { alignSelf: 'center', width: 48, height: 6, borderRadius: 3, backgroundColor: colors.line },
  dragArea: {
    height: 36,
    paddingTop: 12,
    paddingBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  hiddenBar: { height: 34, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  hiddenText: { fontSize: 12, color: colors.secondary, marginTop: 3 },

  peekRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingBottom: 12 },
  peekIconButton: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  peekIcon: { fontSize: 24, color: colors.ink, lineHeight: 26 },
  peekInfo: { flex: 1, minWidth: 0 },
  peekStop: { fontSize: 17, fontWeight: '600', color: colors.ink },
  peekMeta: { fontSize: 12, color: colors.secondary, marginTop: 2 },
  peekNext: {
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  peekNextText: { color: colors.card, fontSize: 14, fontWeight: '600' },
  nextButtonDisabled: { backgroundColor: colors.muted },

  content: { paddingHorizontal: 16, paddingBottom: 28, gap: 12 },
  modeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  modePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.muted,
  },
  modePillActive: { backgroundColor: colors.ink },
  modeText: { fontSize: 13, fontWeight: '500', color: colors.ink },
  modeTextActive: { color: colors.card },

  stopCard: {
    backgroundColor: colors.muted,
    borderRadius: 20,
    padding: 14,
    gap: 4,
  },
  stopCardTop: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  stopCardName: { flex: 1, fontSize: 21, fontWeight: '600', color: colors.ink },
  stopCardDistance: { fontSize: 17, fontWeight: '600', color: colors.ink },
  stopCardMeta: { fontSize: 12, color: colors.secondary },
  roadNote: { fontSize: 11, color: colors.secondary, paddingTop: 4 },

  checklist: {
    backgroundColor: colors.chip,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  actionColumn: { gap: 6 },
  actionButton: {
    minWidth: 100,
    minHeight: 36,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  actionButtonDisabled: { opacity: 0.45 },
  actionText: { fontSize: 13, fontWeight: '600', color: colors.ink },
  actionTextActive: { color: colors.card },
  guardianText: { fontSize: 12, color: colors.secondary },
  warningText: { color: colors.warn },
  noteText: { fontSize: 12, color: colors.secondary, lineHeight: 17 },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { flex: 1, fontSize: 13, color: colors.secondary },
  guideButton: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideButtonDisabled: { opacity: 0.5 },
  guideButtonText: { fontSize: 14, fontWeight: '600', color: colors.ink },

  sectionTitle: { fontSize: 13, fontWeight: '600', color: colors.secondary, marginTop: 4 },
  manifest: { backgroundColor: colors.chip, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  manifestGroup: { paddingVertical: 4 },
  manifestStop: { fontSize: 12, fontWeight: '600', color: colors.ink, paddingTop: 6, paddingBottom: 2 },
  studentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.card, fontSize: 13, fontWeight: '600' },
  studentInfo: { flex: 1, minWidth: 0 },
  studentName: { fontSize: 16, fontWeight: '500', color: colors.ink },
  studentClass: { fontSize: 12, color: colors.secondary },
  manifestMark: { fontSize: 18, fontWeight: '600', color: colors.ink, minWidth: 22, textAlign: 'center' },

  queue: { backgroundColor: colors.chip, borderRadius: 20, padding: 8, gap: 2 },
  queueRow: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 38, paddingHorizontal: 6 },
  queueRowActive: { backgroundColor: colors.card, borderRadius: 14 },
  queueDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.line },
  queueDotActive: { backgroundColor: colors.ink },
  queueName: { flex: 1, fontSize: 14, color: colors.secondary },
  queueNameActive: { color: colors.ink, fontWeight: '600' },
  queueCount: { fontSize: 13, color: colors.secondary },

  nextButton: {
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonWide: { width: '100%' },
  nextButtonText: { color: colors.card, fontSize: 15, fontWeight: '600' },

  endTripButton: {
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  endTripText: { color: colors.ink, fontSize: 15, fontWeight: '600' },
});
