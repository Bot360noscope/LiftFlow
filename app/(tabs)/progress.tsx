import { StyleSheet, Text, View, ScrollView, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState, useMemo, useRef } from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import Colors from "@/constants/colors";
import { useTheme } from "@/lib/theme-context";
import NetworkError from "@/components/NetworkError";
import { ProgressSkeleton } from "@/components/SkeletonLoader";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { getBestPR, getDashboard, getCachedPRs, getCachedProfile, getCachedPrograms, getCachedClients, invalidateProgramsCache, type Program, type ClientInfo } from "@/lib/storage";

function calcDots(totalKg: number, bwKg: number): number {
  if (bwKg < 40 || bwKg > 210) return 0;
  const d = -0.000001093 * Math.pow(bwKg, 4) + 0.0007391293 * Math.pow(bwKg, 3) - 0.1918759221 * Math.pow(bwKg, 2) + 24.0900756 * bwKg - 307.75076;
  if (d <= 0) return 0;
  return Math.round(totalKg * (500 / d));
}

const LIFT_COLORS: Record<string, string> = {
  squat: Colors.colors.squat,
  deadlift: Colors.colors.deadlift,
  bench: Colors.colors.bench,
};

const LIFT_LABELS: Record<string, string> = {
  squat: 'Squat',
  deadlift: 'Deadlift',
  bench: 'Bench',
};

// ─── Coach helpers ────────────────────────────────────────────────────────────

function getWeeklyAdherence(programs: Program[]): number {
  const weekAdherences: number[] = [];
  for (const prog of programs) {
    for (const week of (prog.weeks || [])) {
      const exercises = week.days.flatMap(d => d.exercises.filter(e => e.name));
      if (exercises.length === 0) continue;
      const completed = exercises.filter(e => e.isCompleted).length;
      weekAdherences.push((completed / exercises.length) * 100);
    }
  }
  if (weekAdherences.length === 0) return 0;
  let score = weekAdherences[0];
  for (let i = 1; i < weekAdherences.length; i++) score = score * 0.7 + weekAdherences[i] * 0.3;
  return Math.max(0, Math.round(score));
}

function getPendingReviews(programs: Program[], seenMap: Record<string, string>): number {
  let count = 0;
  for (const prog of programs) {
    if (!prog.clientId) continue;
    for (const week of (prog.weeks || [])) {
      for (const day of week.days) {
        for (const ex of day.exercises) {
          if ((ex.videoUrl || ex.clientNotes) && !ex.coachComment) {
            const key = `${ex.clientNotes || ''}::${ex.videoUrl || ''}`;
            if (seenMap[ex.id] !== key) count++;
          }
        }
      }
    }
  }
  return count;
}

function getLastActive(programs: Program[]): Date | null {
  let latest: Date | null = null;
  for (const prog of programs) {
    const d = prog.updatedAt ? new Date(prog.updatedAt) : new Date(prog.createdAt);
    if (!latest || d > latest) latest = d;
  }
  return latest;
}

function formatLastActive(date: Date | null): string {
  if (!date) return 'Never';
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

function getStatus(adherence: number, lastActive: Date | null): 'green' | 'yellow' | 'red' {
  const daysInactive = lastActive ? Math.floor((Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24)) : 999;
  if (adherence >= 70 && daysInactive <= 7) return 'green';
  if (adherence < 40 || daysInactive > 14) return 'red';
  return 'yellow';
}

function getOverallAdherence(programs: Program[]): { pct: number; done: number; total: number } {
  let done = 0, total = 0;
  for (const prog of programs) {
    for (const week of (prog.weeks || [])) {
      for (const day of week.days) {
        const named = day.exercises.filter(e => e.name);
        total += named.length;
        done += named.filter(e => e.isCompleted).length;
      }
    }
  }
  return { pct: total === 0 ? 0 : Math.round((done / total) * 100), done, total };
}

function ClientProgressCard({ client, programs, delay, colors, seenMap }: {
  client: ClientInfo; programs: Program[]; delay: number; colors: any; seenMap: Record<string, string>;
}) {
  const clientPrograms = programs.filter(p => p.clientId === client.id);
  const adherence = getWeeklyAdherence(clientPrograms);
  const pendingReviews = getPendingReviews(clientPrograms, seenMap);
  const lastActive = getLastActive(clientPrograms);
  const status = getStatus(adherence, lastActive);
  const statusColor = status === 'green' ? colors.success : status === 'yellow' ? colors.warning : colors.danger;
  const statusLabel = status === 'green' ? 'On track' : status === 'yellow' ? 'Needs check-in' : 'Gone quiet';

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(400)}>
      <Pressable
        style={({ pressed }) => [styles.clientCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }, pressed && { opacity: 0.85 }]}
        onPress={() => router.push(`/client/${client.id}?name=${encodeURIComponent(client.name || '')}`)}
      >
        <View style={styles.clientTop}>
          <View style={styles.clientAvatar}>
            <Text style={[styles.clientAvatarText, { color: colors.primary }]}>{(client.name || '?')[0].toUpperCase()}</Text>
          </View>
          <View style={styles.clientInfo}>
            <Text style={[styles.clientName, { color: colors.text }]}>{client.name || 'Client'}</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusLabel, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>
          <Text style={[styles.lastActive, { color: colors.textMuted }]}>{formatLastActive(lastActive)}</Text>
        </View>
        <View style={styles.metricsRow}>
          <View style={[styles.metricBox, { backgroundColor: colors.surface }]}>
            <Text style={[styles.metricValue, { color: adherence >= 70 ? colors.success : adherence >= 40 ? colors.warning : colors.danger }]}>{adherence}%</Text>
            <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Adherence</Text>
          </View>
          <View style={[styles.metricBox, { backgroundColor: colors.surface }]}>
            <Text style={[styles.metricValue, { color: pendingReviews > 0 ? colors.primary : colors.textMuted }]}>{pendingReviews}</Text>
            <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Pending Reviews</Text>
          </View>
          <View style={[styles.metricBox, { backgroundColor: colors.surface }]}>
            <Text style={[styles.metricValue, { color: colors.text }]}>{clientPrograms.length}</Text>
            <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Programs</Text>
          </View>
        </View>
        <View style={[styles.adherenceBar, { backgroundColor: colors.surfaceLight }]}>
          <View style={[styles.adherenceFill, { width: `${adherence}%` as any, backgroundColor: statusColor }]} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ProgressScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [prs, setPRs] = useState(getCachedPRs());
  const [unit, setUnit] = useState<'kg' | 'lbs'>((getCachedProfile()?.weightUnit as 'kg' | 'lbs') || 'kg');
  const [bodyWeight, setBodyWeight] = useState<number | undefined>(getCachedProfile()?.bodyWeight);
  const [isCoach, setIsCoach] = useState(getCachedProfile()?.role === 'coach');
  const [programs, setPrograms] = useState<Program[]>(getCachedPrograms());
  const [clients, setClients] = useState<ClientInfo[]>(getCachedClients());
  const [loading, setLoading] = useState(!getCachedProfile());
  const [error, setError] = useState(false);
  const [seenMap, setSeenMap] = useState<Record<string, string>>({});
  const lastRefetchRef = useRef<number>(0);

  const loadData = useCallback(async () => {
    try {
      const dashboard = await getDashboard();
      setPRs(dashboard.prs);
      setUnit(dashboard.profile.weightUnit);
      setBodyWeight(dashboard.profile.bodyWeight);
      setIsCoach(dashboard.profile.role === 'coach');
      setPrograms(dashboard.programs);
      setClients(dashboard.clients);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    const cachedProgs = getCachedPrograms();
    if (cachedProgs.length > 0) setPrograms(cachedProgs);
    const cachedCls = getCachedClients();
    if (cachedCls.length > 0) setClients(cachedCls);
    AsyncStorage.getItem('liftflow_seen_exercises').then(stored => {
      if (stored) setSeenMap(JSON.parse(stored));
    });
    const now = Date.now();
    if (now - lastRefetchRef.current < 2000) return;
    lastRefetchRef.current = now;
    invalidateProgramsCache();
    loadData();
  }, [loadData]));

  const bestSquat = getBestPR(prs, 'squat');
  const bestDeadlift = getBestPR(prs, 'deadlift');
  const bestBench = getBestPR(prs, 'bench');

  const adherence = useMemo(() => getOverallAdherence(programs), [programs]);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const activeThisWeek = useMemo(() => clients.filter(client => {
    const clientProgs = programs.filter(p => p.clientId === client.id);
    const last = getLastActive(clientProgs);
    return last ? Date.now() - last.getTime() < 7 * 24 * 60 * 60 * 1000 : false;
  }).length, [clients, programs]);

  const rosterAdherence = useMemo(() => {
    if (clients.length === 0) return 0;
    return Math.round(clients.reduce((sum, c) => sum + getWeeklyAdherence(programs.filter(p => p.clientId === c.id)), 0) / clients.length);
  }, [clients, programs]);

  const needsAttention = useMemo(() => clients.filter(c => {
    const cp = programs.filter(p => p.clientId === c.id);
    return getStatus(getWeeklyAdherence(cp), getLastActive(cp)) === 'red';
  }).length, [clients, programs]);

  const sortedClients = useMemo(() => [...clients].sort((a, b) => {
    const aS = getStatus(getWeeklyAdherence(programs.filter(p => p.clientId === a.id)), getLastActive(programs.filter(p => p.clientId === a.id)));
    const bS = getStatus(getWeeklyAdherence(programs.filter(p => p.clientId === b.id)), getLastActive(programs.filter(p => p.clientId === b.id)));
    return ({ red: 0, yellow: 1, green: 2 })[aS] - ({ red: 0, yellow: 1, green: 2 })[bS];
  }), [clients, programs]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + webTopInset + 16 }}>
        <ProgressSkeleton />
      </View>
    );
  }

  if (error && !getCachedProfile()) return <NetworkError onRetry={loadData} />;

  // ─── Coach view ───────────────────────────────────────────────────────────────
  if (isCoach) {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingTop: insets.top + webTopInset + 16, paddingBottom: tabBarHeight + 20, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.pageTitle, { color: colors.text }]}>Client Progress</Text>
        <Animated.View entering={FadeInDown.duration(400)}>
          <View style={styles.overviewRow}>
            <View style={[styles.overviewCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
              <Text style={[styles.overviewValue, { color: colors.success }]}>{activeThisWeek}</Text>
              <Text style={[styles.overviewLabel, { color: colors.textMuted }]}>Active This Week</Text>
            </View>
            <View style={[styles.overviewCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
              <Text style={[styles.overviewValue, { color: rosterAdherence >= 70 ? colors.success : rosterAdherence >= 40 ? colors.warning : colors.danger }]}>{rosterAdherence}%</Text>
              <Text style={[styles.overviewLabel, { color: colors.textMuted }]}>Roster Adherence</Text>
            </View>
            <View style={[styles.overviewCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
              <Text style={[styles.overviewValue, { color: needsAttention > 0 ? colors.warning : colors.textMuted }]}>{needsAttention}</Text>
              <Text style={[styles.overviewLabel, { color: colors.textMuted }]}>Gone Quiet</Text>
            </View>
          </View>
        </Animated.View>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Clients{needsAttention > 0 && <Text style={{ color: colors.warning }}> · {needsAttention} gone quiet</Text>}
        </Text>
        {sortedClients.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={40} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.text }]}>No clients yet</Text>
            <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>Share your coach code with clients to start tracking their progress</Text>
          </View>
        ) : (
          sortedClients.map((client, idx) => (
            <ClientProgressCard key={client.id} client={client} programs={programs} delay={idx * 60} colors={colors} seenMap={seenMap} />
          ))
        )}
      </ScrollView>
    );
  }

  // ─── Client view ──────────────────────────────────────────────────────────────
  const totalKg = unit === 'lbs'
    ? ((bestSquat?.weight || 0) + (bestBench?.weight || 0) + (bestDeadlift?.weight || 0)) / 2.205
    : (bestSquat?.weight || 0) + (bestBench?.weight || 0) + (bestDeadlift?.weight || 0);
  const total = (bestSquat?.weight || 0) + (bestBench?.weight || 0) + (bestDeadlift?.weight || 0);

  const bwKg = bodyWeight
    ? (unit === 'lbs' ? bodyWeight / 2.205 : bodyWeight)
    : undefined;
  const dots = bwKg && totalKg > 0 ? calcDots(totalKg, bwKg) : 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + webTopInset + 16, paddingBottom: tabBarHeight + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.pageTitle, { color: colors.text }]}>My Progress</Text>

      {/* ── Strength total ── */}
      {total > 0 && (
        <Animated.View entering={FadeInDown.duration(350)}>
          <View style={[styles.strengthCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
            <View style={styles.strengthRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.strengthLabel, { color: colors.textMuted }]}>SBD TOTAL</Text>
                <Text style={[styles.strengthValue, { color: colors.text }]}>
                  {total}<Text style={[styles.strengthUnit, { color: colors.textMuted }]}> {unit}</Text>
                </Text>
              </View>
              {dots > 0 && (
                <View style={[styles.dotsDivider, { backgroundColor: colors.border }]} />
              )}
              {dots > 0 && (
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={[styles.strengthLabel, { color: colors.textMuted }]}>DOTS</Text>
                  <Text style={[styles.strengthValue, { color: colors.primary }]}>{dots}</Text>
                </View>
              )}
            </View>
          </View>
        </Animated.View>
      )}

      {/* ── Log New PR ── */}
      <Animated.View entering={FadeInDown.delay(60).duration(350)}>
        <Pressable
          style={[styles.logPRBtn, { backgroundColor: colors.primary }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push('/add-pr');
          }}
        >
          <Ionicons name="trophy" size={18} color="#fff" />
          <Text style={styles.logPRBtnText}>Log New PR</Text>
        </Pressable>
      </Animated.View>

      {/* ── Consistency ── */}
      <Animated.View entering={FadeInDown.delay(120).duration(350)}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Consistency</Text>
        <View style={[styles.adherenceCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
          {adherence.total === 0 ? (
            <View style={styles.adherenceEmpty}>
              <Ionicons name="barbell-outline" size={28} color={colors.textMuted} />
              <Text style={[styles.adherenceEmptyText, { color: colors.textMuted }]}>No program data yet</Text>
            </View>
          ) : (
            <>
              <View style={styles.adherenceTopRow}>
                <Text style={[styles.adherencePct, {
                  color: adherence.pct >= 70 ? colors.success : adherence.pct >= 40 ? colors.warning : colors.danger,
                }]}>{adherence.pct}%</Text>
                <View style={{ flex: 1, marginLeft: 16 }}>
                  <Text style={[styles.adherenceLabel, { color: colors.text }]}>Overall adherence</Text>
                  <Text style={[styles.adherenceSub, { color: colors.textMuted }]}>
                    {adherence.done} of {adherence.total} exercises completed
                  </Text>
                </View>
              </View>
              <View style={[styles.adherenceTrack, { backgroundColor: colors.surfaceLight }]}>
                <View style={[styles.adherenceFill, {
                  width: `${adherence.pct}%` as any,
                  backgroundColor: adherence.pct >= 70 ? colors.success : adherence.pct >= 40 ? colors.warning : colors.danger,
                }]} />
              </View>
            </>
          )}
        </View>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  pageTitle: { fontFamily: 'Rubik_700Bold', fontSize: 28, marginBottom: 20 },

  // Coach
  overviewRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  overviewCard: { flex: 1, alignItems: 'center', borderRadius: 12, padding: 14, borderWidth: 1 },
  overviewValue: { fontFamily: 'Rubik_700Bold', fontSize: 22 },
  overviewLabel: { fontFamily: 'Rubik_400Regular', fontSize: 11, marginTop: 4, textAlign: 'center' },
  sectionTitle: { fontFamily: 'Rubik_700Bold', fontSize: 18, marginBottom: 12, marginTop: 24 },
  clientCard: { borderRadius: 14, padding: 16, borderWidth: 1, marginBottom: 12 },
  clientTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  clientAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(232,81,47,0.15)', alignItems: 'center', justifyContent: 'center' },
  clientAvatarText: { fontFamily: 'Rubik_700Bold', fontSize: 17 },
  clientInfo: { flex: 1 },
  clientName: { fontFamily: 'Rubik_600SemiBold', fontSize: 15 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusLabel: { fontFamily: 'Rubik_500Medium', fontSize: 12 },
  lastActive: { fontFamily: 'Rubik_400Regular', fontSize: 12 },
  metricsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  metricBox: { flex: 1, alignItems: 'center', borderRadius: 10, paddingVertical: 10 },
  metricValue: { fontFamily: 'Rubik_700Bold', fontSize: 18 },
  metricLabel: { fontFamily: 'Rubik_400Regular', fontSize: 10, marginTop: 2, textAlign: 'center' },
  adherenceBar: { height: 3, borderRadius: 2, overflow: 'hidden' },
  adherenceFill: { height: '100%' as const, borderRadius: 2 },

  // Strength card
  strengthCard: { borderRadius: 16, borderWidth: 1, padding: 20, marginBottom: 12 },
  strengthRow: { flexDirection: 'row', alignItems: 'center' },
  strengthLabel: { fontFamily: 'Rubik_600SemiBold', fontSize: 10, letterSpacing: 1.5, marginBottom: 4 },
  strengthValue: { fontFamily: 'Rubik_700Bold', fontSize: 38, lineHeight: 42 },
  strengthUnit: { fontFamily: 'Rubik_400Regular', fontSize: 18 },
  dotsDivider: { width: 1, height: 50, marginHorizontal: 20 },

  // Log PR
  logPRBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, marginBottom: 4 },
  logPRBtnText: { fontFamily: 'Rubik_700Bold', fontSize: 15, color: '#fff' },

  // Consistency card
  adherenceCard: { borderRadius: 16, borderWidth: 1, padding: 20 },
  adherenceTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  adherencePct: { fontFamily: 'Rubik_700Bold', fontSize: 44, lineHeight: 48 },
  adherenceLabel: { fontFamily: 'Rubik_600SemiBold', fontSize: 15 },
  adherenceSub: { fontFamily: 'Rubik_400Regular', fontSize: 13, marginTop: 3 },
  adherenceTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  adherenceFill: { height: '100%' as const, borderRadius: 3 },
  adherenceEmpty: { alignItems: 'center', gap: 8, paddingVertical: 12 },
  adherenceEmptyText: { fontFamily: 'Rubik_400Regular', fontSize: 13 },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontFamily: 'Rubik_600SemiBold', fontSize: 15 },
  emptyDesc: { fontFamily: 'Rubik_400Regular', fontSize: 13, textAlign: 'center', paddingHorizontal: 20 },
});
