import { StyleSheet, Text, View, ScrollView, Pressable, Platform, ActivityIndicator } from "react-native";
import { confirmAction } from "@/lib/confirm";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState, useMemo } from "react";
import { router, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import Colors from "@/constants/colors";
import NetworkError from "@/components/NetworkError";
import { getPRs, deletePR, getProfile, getBestPR, getPrograms, getClients, getCachedPRs, getCachedProfile, getCachedPrograms, getCachedClients, type LiftPR, type Program, type ClientInfo } from "@/lib/storage";

const LIFT_COLORS: Record<string, string> = {
  squat: Colors.colors.squat,
  deadlift: Colors.colors.deadlift,
  bench: Colors.colors.bench,
};

const LIFT_LABELS: Record<string, string> = {
  squat: 'Squat',
  deadlift: 'Deadlift',
  bench: 'Bench Press',
};

function ClientProgressCard({ client, programs, delay }: { client: ClientInfo; programs: Program[]; delay: number }) {
  const clientPrograms = programs.filter(p => p.clientId === client.id);
  let totalEx = 0, completedEx = 0, notesCount = 0, videosCount = 0;
  for (const prog of clientPrograms) {
    for (const week of prog.weeks) {
      for (const day of week.days) {
        for (const ex of day.exercises) {
          if (ex.name) totalEx++;
          if (ex.isCompleted) completedEx++;
          if (ex.clientNotes) notesCount++;
          if (ex.videoUrl) videosCount++;
        }
      }
    }
  }
  const progress = totalEx > 0 ? Math.round((completedEx / totalEx) * 100) : 0;

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(400)}>
      <Pressable
        style={({ pressed }) => [styles.clientProgressCard, pressed && { opacity: 0.85 }]}
        accessibilityLabel={`View ${client.name || 'client'} progress`}
        accessibilityRole="button"
        onPress={() => {
          if (clientPrograms.length > 0) {
            router.push(`/program/${clientPrograms[0].id}`);
          }
        }}
      >
        <View style={styles.clientHeader}>
          <View style={styles.clientAvatar}>
            <Text style={styles.clientAvatarText}>{(client.name || '?')[0].toUpperCase()}</Text>
          </View>
          <View style={styles.clientHeaderInfo}>
            <Text style={styles.clientNameText}>{client.name || 'Client'}</Text>
            <Text style={styles.clientJoined}>Joined {new Date(client.joinedAt).toLocaleDateString()}</Text>
          </View>
        </View>

        <View style={styles.clientStatsRow}>
          <View style={styles.clientStatBox}>
            <Text style={styles.clientStatNum}>{clientPrograms.length}</Text>
            <Text style={styles.clientStatLabel} numberOfLines={1}>Programs</Text>
          </View>
          <View style={styles.clientStatBox}>
            <Text style={[styles.clientStatNum, { color: Colors.colors.success }]}>{completedEx}</Text>
            <Text style={styles.clientStatLabel} numberOfLines={1}>Done</Text>
          </View>
          <View style={styles.clientStatBox}>
            <Text style={[styles.clientStatNum, { color: Colors.colors.accent }]}>{notesCount}</Text>
            <Text style={styles.clientStatLabel} numberOfLines={1}>Notes</Text>
          </View>
          <View style={styles.clientStatBox}>
            <Text style={[styles.clientStatNum, { color: Colors.colors.primary }]}>{videosCount}</Text>
            <Text style={styles.clientStatLabel} numberOfLines={1}>Videos</Text>
          </View>
        </View>

        <View style={styles.clientProgressRow}>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.clientProgressText}>{progress}%</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const [prs, setPRs] = useState<LiftPR[]>(getCachedPRs());
  const [unit, setUnit] = useState<'kg' | 'lbs'>((getCachedProfile()?.weightUnit as 'kg' | 'lbs') || 'kg');
  const [isCoach, setIsCoach] = useState(getCachedProfile()?.role === 'coach');
  const [programs, setPrograms] = useState<Program[]>(getCachedPrograms());
  const [clients, setClients] = useState<ClientInfo[]>(getCachedClients());

  const [loading, setLoading] = useState(!getCachedProfile());
  const [error, setError] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [prData, profile, progs, cl] = await Promise.all([getPRs(), getProfile(), getPrograms(), getClients()]);
      setPRs(prData);
      setUnit(profile.weightUnit);
      setIsCoach(profile.role === 'coach');
      setPrograms(progs);
      setClients(cl);
      setError(false);
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const bestSquat = getBestPR(prs, 'squat');
  const bestDeadlift = getBestPR(prs, 'deadlift');
  const bestBench = getBestPR(prs, 'bench');

  const total = (bestSquat?.weight || 0) + (bestDeadlift?.weight || 0) + (bestBench?.weight || 0);

  const sortedPRs = useMemo(() =>
    [...prs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  [prs]);

  const handleDelete = (pr: LiftPR) => {
    confirmAction("Delete PR", `Remove ${LIFT_LABELS[pr.liftType]} ${pr.weight}${pr.unit}?`, async () => {
      await deletePR(pr.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadData();
    }, "Delete");
  };

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const webBottomInset = Platform.OS === 'web' ? 84 : 0;

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.colors.background }}>
        <ActivityIndicator size="large" color={Colors.colors.primary} />
      </View>
    );
  }

  if (error && !getCachedProfile()) {
    return <NetworkError onRetry={loadData} />;
  }

  if (isCoach) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + webTopInset + 16, paddingBottom: insets.bottom + webBottomInset + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Client Progress</Text>

        <Animated.View entering={FadeInDown.duration(400)}>
          <View style={styles.overviewRow}>
            <View style={styles.overviewCard}>
              <Text style={styles.overviewValue}>{clients.length}</Text>
              <Text style={styles.overviewLabel}>Total Clients</Text>
            </View>
            <View style={styles.overviewCard}>
              <Text style={styles.overviewValue}>{programs.length}</Text>
              <Text style={styles.overviewLabel}>Programs</Text>
            </View>
            <View style={styles.overviewCard}>
              <Text style={[styles.overviewValue, { color: Colors.colors.success }]}>
                {programs.filter(p => p.status === 'active').length}
              </Text>
              <Text style={styles.overviewLabel}>Active</Text>
            </View>
          </View>
        </Animated.View>

        <Text style={styles.sectionTitle}>Clients</Text>

        {clients.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={40} color={Colors.colors.textMuted} />
            <Text style={styles.emptyText}>No clients yet</Text>
            <Text style={styles.emptyDesc}>Share your coach code with clients to start tracking their progress</Text>
          </View>
        ) : (
          clients.map((client, idx) => (
            <ClientProgressCard key={client.id} client={client} programs={programs} delay={idx * 60} />
          ))
        )}
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: insets.top + webTopInset + 16, paddingBottom: insets.bottom + webBottomInset + 20 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <Text style={styles.pageTitle}>Progress</Text>
        <Pressable
          style={styles.addBtn}
          accessibilityLabel="Log a new PR"
          accessibilityRole="button"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/add-pr');
          }}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addBtnText}>Log PR</Text>
        </Pressable>
      </View>

      {total > 0 && (
        <Animated.View entering={FadeInDown.duration(400)}>
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Estimated Total</Text>
            <Text style={styles.totalValue}>{total}<Text style={styles.totalUnit}> {unit}</Text></Text>
            <View style={styles.totalBreakdown}>
              {bestSquat && (
                <View style={styles.breakdownItem}>
                  <View style={[styles.breakdownDot, { backgroundColor: Colors.colors.squat }]} />
                  <Text style={styles.breakdownText}>S: {bestSquat.weight}</Text>
                </View>
              )}
              {bestBench && (
                <View style={styles.breakdownItem}>
                  <View style={[styles.breakdownDot, { backgroundColor: Colors.colors.bench }]} />
                  <Text style={styles.breakdownText}>B: {bestBench.weight}</Text>
                </View>
              )}
              {bestDeadlift && (
                <View style={styles.breakdownItem}>
                  <View style={[styles.breakdownDot, { backgroundColor: Colors.colors.deadlift }]} />
                  <Text style={styles.breakdownText}>D: {bestDeadlift.weight}</Text>
                </View>
              )}
            </View>
          </View>
        </Animated.View>
      )}

      <Animated.View entering={FadeInDown.delay(100).duration(400)}>
        <View style={styles.bestLiftsRow}>
          {(['squat', 'bench', 'deadlift'] as const).map(lift => {
            const best = getBestPR(prs, lift);
            return (
              <View key={lift} style={[styles.bestLiftCard, { borderLeftColor: LIFT_COLORS[lift] }]}>
                <Text style={[styles.bestLiftLabel, { color: LIFT_COLORS[lift] }]}>{LIFT_LABELS[lift]}</Text>
                <Text style={styles.bestLiftValue}>{best ? best.weight : '-'}</Text>
                <Text style={styles.bestLiftUnit}>{best ? best.unit : unit}</Text>
              </View>
            );
          })}
        </View>
      </Animated.View>

      <Text style={styles.sectionTitle}>PR History</Text>

      {sortedPRs.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="trophy-outline" size={40} color={Colors.colors.textMuted} />
          <Text style={styles.emptyText}>No PRs logged yet</Text>
          <Text style={styles.emptyDesc}>Track your squat, bench, and deadlift personal records</Text>
        </View>
      ) : (
        sortedPRs.map((pr, idx) => (
          <Animated.View key={pr.id} entering={FadeInDown.delay(idx * 40).duration(300)}>
            <Pressable
              style={({ pressed }) => [styles.prRow, pressed && { opacity: 0.8 }]}
              accessibilityLabel={`${LIFT_LABELS[pr.liftType]} ${pr.weight} ${pr.unit}`}
              accessibilityRole="button"
              onLongPress={() => handleDelete(pr)}
            >
              <View style={[styles.prDot, { backgroundColor: LIFT_COLORS[pr.liftType] }]} />
              <View style={styles.prInfo}>
                <Text style={styles.prLiftName}>{LIFT_LABELS[pr.liftType]}</Text>
                <Text style={styles.prDate}>{new Date(pr.date).toLocaleDateString()}</Text>
                {!!pr.notes && <Text style={styles.prNotes} numberOfLines={1}>{pr.notes}</Text>}
              </View>
              <Text style={styles.prWeight}>{pr.weight}<Text style={styles.prUnit}> {pr.unit}</Text></Text>
            </Pressable>
          </Animated.View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.colors.background },
  scrollContent: { paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  pageTitle: { fontFamily: 'Rubik_700Bold', fontSize: 28, color: Colors.colors.text, marginBottom: 20 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
  },
  addBtnText: { fontFamily: 'Rubik_600SemiBold', fontSize: 13, color: '#fff' },
  overviewRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  overviewCard: {
    flex: 1, alignItems: 'center', backgroundColor: Colors.colors.backgroundCard,
    borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.colors.border,
  },
  overviewValue: { fontFamily: 'Rubik_700Bold', fontSize: 24, color: Colors.colors.text },
  overviewLabel: { fontFamily: 'Rubik_400Regular', fontSize: 13, color: Colors.colors.textMuted, marginTop: 4 },
  clientProgressCard: {
    backgroundColor: Colors.colors.backgroundCard, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: Colors.colors.border, marginBottom: 12,
  },
  clientHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  clientAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(232,81,47,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  clientAvatarText: { fontFamily: 'Rubik_700Bold', fontSize: 18, color: Colors.colors.primary },
  clientHeaderInfo: { flex: 1 },
  clientNameText: { fontFamily: 'Rubik_600SemiBold', fontSize: 16, color: Colors.colors.text },
  clientJoined: { fontFamily: 'Rubik_400Regular', fontSize: 13, color: Colors.colors.textMuted, marginTop: 2 },
  clientStatsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  clientStatBox: {
    flex: 1, alignItems: 'center', backgroundColor: Colors.colors.surface, borderRadius: 8, paddingVertical: 8,
  },
  clientStatNum: { fontFamily: 'Rubik_700Bold', fontSize: 18, color: Colors.colors.text },
  clientStatLabel: { fontFamily: 'Rubik_400Regular', fontSize: 13, color: Colors.colors.textMuted, marginTop: 2 },
  clientProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clientProgressText: { fontFamily: 'Rubik_600SemiBold', fontSize: 13, color: Colors.colors.textSecondary, width: 32, textAlign: 'right' },
  totalCard: {
    alignItems: 'center', backgroundColor: Colors.colors.backgroundCard, borderRadius: 12,
    padding: 24, borderWidth: 1, borderColor: Colors.colors.border, marginBottom: 16,
  },
  totalLabel: { fontFamily: 'Rubik_500Medium', fontSize: 13, color: Colors.colors.textMuted },
  totalValue: { fontFamily: 'Rubik_700Bold', fontSize: 40, color: Colors.colors.text, marginTop: 4 },
  totalUnit: { fontFamily: 'Rubik_400Regular', fontSize: 16, color: Colors.colors.textSecondary },
  totalBreakdown: { flexDirection: 'row', gap: 16, marginTop: 12 },
  breakdownItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  breakdownDot: { width: 8, height: 8, borderRadius: 4 },
  breakdownText: { fontFamily: 'Rubik_500Medium', fontSize: 13, color: Colors.colors.textSecondary },
  bestLiftsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  bestLiftCard: {
    flex: 1, alignItems: 'center', backgroundColor: Colors.colors.backgroundCard,
    borderRadius: 12, paddingVertical: 14, borderLeftWidth: 3,
  },
  bestLiftLabel: { fontFamily: 'Rubik_600SemiBold', fontSize: 13 },
  bestLiftValue: { fontFamily: 'Rubik_700Bold', fontSize: 24, color: Colors.colors.text, marginTop: 4 },
  bestLiftUnit: { fontFamily: 'Rubik_400Regular', fontSize: 13, color: Colors.colors.textMuted },
  sectionTitle: { fontFamily: 'Rubik_700Bold', fontSize: 18, color: Colors.colors.text, marginBottom: 12 },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontFamily: 'Rubik_600SemiBold', fontSize: 15, color: Colors.colors.text },
  emptyDesc: { fontFamily: 'Rubik_400Regular', fontSize: 13, color: Colors.colors.textMuted, textAlign: 'center', paddingHorizontal: 20 },
  prRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.colors.backgroundCard, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.colors.border, marginBottom: 8,
  },
  prDot: { width: 10, height: 10, borderRadius: 5 },
  prInfo: { flex: 1 },
  prLiftName: { fontFamily: 'Rubik_600SemiBold', fontSize: 14, color: Colors.colors.text },
  prDate: { fontFamily: 'Rubik_400Regular', fontSize: 13, color: Colors.colors.textMuted, marginTop: 1 },
  prNotes: { fontFamily: 'Rubik_400Regular', fontSize: 13, color: Colors.colors.textSecondary, marginTop: 2 },
  prWeight: { fontFamily: 'Rubik_700Bold', fontSize: 18, color: Colors.colors.text },
  prUnit: { fontFamily: 'Rubik_400Regular', fontSize: 13, color: Colors.colors.textMuted },
  progressBarBg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: Colors.colors.surfaceLight, overflow: 'hidden' as const },
  progressBarFill: { height: '100%' as const, borderRadius: 2, backgroundColor: Colors.colors.primary },
});
