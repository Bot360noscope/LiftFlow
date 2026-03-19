import { StyleSheet, Text, View, ScrollView, Pressable, Platform, ActivityIndicator } from "react-native";
import { confirmAction } from "@/lib/confirm";
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
import { getPRs, deletePR, getBestPR, getDashboard, getCachedPRs, getCachedProfile, getCachedPrograms, getCachedClients, invalidateProgramsCache, type LiftPR, type Program, type ClientInfo, type Exercise } from "@/lib/storage";

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
  for (let i = 1; i < weekAdherences.length; i++) {
    score = score * 0.7 + weekAdherences[i] * 0.3;
  }
  return Math.max(0, Math.round(score));
}

function getActiveWeek(prog: Program) {
  if (!prog.weeks?.length) return null;
  for (const week of prog.weeks) {
    const hasIncomplete = week.days.some(d => d.exercises.some(e => e.name && !e.isCompleted));
    if (hasIncomplete) return week;
  }
  return prog.weeks[prog.weeks.length - 1];
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

function ClientProgressCard({ client, programs, delay, colors, seenMap }: { client: ClientInfo; programs: Program[]; delay: number; colors: any; seenMap: Record<string, string> }) {
  const clientPrograms = programs.filter(p => p.clientId === client.id);
  const adherence = getWeeklyAdherence(clientPrograms);
  const pendingReviews = getPendingReviews(clientPrograms, seenMap);
  const lastActive = getLastActive(clientPrograms);
  const status = getStatus(adherence, lastActive);

  const statusColor = status === 'green' ? colors.success : status === 'yellow' ? colors.warning : colors.danger;
  const statusLabel = status === 'green' ? 'On track' : status === 'yellow' ? 'Needs check-in' : 'At risk';

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

// ─── Client helpers ───────────────────────────────────────────────────────────

function getPRGain(prs: LiftPR[], liftType: string): number | null {
  const sorted = prs.filter(p => p.liftType === liftType).sort((a, b) => b.weight - a.weight);
  if (sorted.length < 2) return null;
  return sorted[0].weight - sorted[1].weight;
}

function getDaysSinceLastPR(prs: LiftPR[]): number | null {
  if (prs.length === 0) return null;
  const latest = prs.reduce((a, b) => new Date(a.date) > new Date(b.date) ? a : b);
  return Math.floor((Date.now() - new Date(latest.date).getTime()) / (1000 * 60 * 60 * 24));
}

interface ClientStats {
  thisWeekDone: number;
  thisWeekTotal: number;
  videosSent: number;
  awaitingReview: number;
  feedbackReceived: number;
  totalCompleted: number;
}

function getClientStats(programs: Program[]): ClientStats {
  let thisWeekDone = 0, thisWeekTotal = 0;
  let videosSent = 0, awaitingReview = 0, feedbackReceived = 0, totalCompleted = 0;

  for (const prog of programs) {
    const activeWeek = getActiveWeek(prog);
    if (activeWeek) {
      for (const day of activeWeek.days) {
        for (const ex of day.exercises) {
          if (!ex.name) continue;
          thisWeekTotal++;
          if (ex.isCompleted) thisWeekDone++;
        }
      }
    }
    for (const week of (prog.weeks || [])) {
      for (const day of week.days) {
        for (const ex of day.exercises) {
          if (!ex.name) continue;
          if (ex.isCompleted) totalCompleted++;
          if (ex.videoUrl) {
            videosSent++;
            if (!ex.coachComment) awaitingReview++;
            else feedbackReceived++;
          }
        }
      }
    }
  }

  return { thisWeekDone, thisWeekTotal, videosSent, awaitingReview, feedbackReceived, totalCompleted };
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ProgressScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [prs, setPRs] = useState<LiftPR[]>(getCachedPRs());
  const [unit, setUnit] = useState<'kg' | 'lbs'>((getCachedProfile()?.weightUnit as 'kg' | 'lbs') || 'kg');
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
      setIsCoach(dashboard.profile.role === 'coach');
      setPrograms(dashboard.programs);
      setClients(dashboard.clients);
      setError(false);
    } catch (e) {
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
  const total = (bestSquat?.weight || 0) + (bestDeadlift?.weight || 0) + (bestBench?.weight || 0);
  const sortedPRs = useMemo(() => [...prs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [prs]);

  const handleDelete = (pr: LiftPR) => {
    confirmAction("Delete PR", `Remove ${LIFT_LABELS[pr.liftType]} ${pr.weight}${pr.unit}?`, async () => {
      await deletePR(pr.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadData();
    }, "Delete");
  };

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const activeThisWeek = useMemo(() => {
    return clients.filter(client => {
      const clientProgs = programs.filter(p => p.clientId === client.id);
      const last = getLastActive(clientProgs);
      if (!last) return false;
      return Date.now() - last.getTime() < 7 * 24 * 60 * 60 * 1000;
    }).length;
  }, [clients, programs]);

  const rosterAdherence = useMemo(() => {
    if (clients.length === 0) return 0;
    let sum = 0;
    for (const client of clients) {
      const clientProgs = programs.filter(p => p.clientId === client.id);
      sum += getWeeklyAdherence(clientProgs);
    }
    return Math.round(sum / clients.length);
  }, [clients, programs]);

  const needsAttention = useMemo(() => {
    return clients.filter(client => {
      const clientProgs = programs.filter(p => p.clientId === client.id);
      const last = getLastActive(clientProgs);
      const adherence = getWeeklyAdherence(clientProgs);
      return getStatus(adherence, last) === 'red';
    }).length;
  }, [clients, programs]);

  const sortedClients = useMemo(() => {
    return [...clients].sort((a, b) => {
      const aProgs = programs.filter(p => p.clientId === a.id);
      const bProgs = programs.filter(p => p.clientId === b.id);
      const aStatus = getStatus(getWeeklyAdherence(aProgs), getLastActive(aProgs));
      const bStatus = getStatus(getWeeklyAdherence(bProgs), getLastActive(bProgs));
      const order = { red: 0, yellow: 1, green: 2 };
      return order[aStatus] - order[bStatus];
    });
  }, [clients, programs]);

  const clientStats = useMemo(() => getClientStats(programs), [programs]);
  const daysSinceLastPR = useMemo(() => getDaysSinceLastPR(prs), [prs]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + webTopInset + 16 }}>
        <ProgressSkeleton />
      </View>
    );
  }

  if (error && !getCachedProfile()) {
    return <NetworkError onRetry={loadData} />;
  }

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
              <Text style={[styles.overviewValue, { color: needsAttention > 0 ? colors.danger : colors.textMuted }]}>{needsAttention}</Text>
              <Text style={[styles.overviewLabel, { color: colors.textMuted }]}>At Risk</Text>
            </View>
          </View>
        </Animated.View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Clients
          {needsAttention > 0 && (
            <Text style={{ color: colors.danger }}> · {needsAttention} need attention</Text>
          )}
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

  // ─── Client view ─────────────────────────────────────────────────────────────
  const lifts = [
    { key: 'squat' as const, best: bestSquat },
    { key: 'bench' as const, best: bestBench },
    { key: 'deadlift' as const, best: bestDeadlift },
  ];

  const weekPct = clientStats.thisWeekTotal > 0
    ? clientStats.thisWeekDone / clientStats.thisWeekTotal
    : 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + webTopInset + 16, paddingBottom: tabBarHeight + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.pageTitle, { color: colors.text }]}>My Progress</Text>

      {/* ── The Big 3 ── */}
      <Animated.View entering={FadeInDown.duration(350)}>
        <View style={[styles.big3Card, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
          <Text style={[styles.big3Header, { color: colors.textMuted }]}>THE BIG 3</Text>
          <View style={styles.big3Row}>
            {lifts.map(({ key, best }) => {
              const gain = getPRGain(prs, key);
              return (
                <Pressable
                  key={key}
                  style={({ pressed }) => [styles.liftCol, pressed && { opacity: 0.7 }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push(`/add-pr?lift=${key}`);
                  }}
                >
                  <Text style={[styles.liftColLabel, { color: LIFT_COLORS[key] }]}>{LIFT_LABELS[key].toUpperCase()}</Text>
                  <Text style={[styles.liftColWeight, { color: best ? colors.text : colors.textMuted }]}>
                    {best ? best.weight : '—'}
                  </Text>
                  {best && (
                    <Text style={[styles.liftColUnit, { color: colors.textMuted }]}>{best.unit}</Text>
                  )}
                  {gain !== null && gain > 0 && (
                    <View style={styles.gainBadge}>
                      <Ionicons name="arrow-up" size={10} color={colors.success} />
                      <Text style={[styles.gainText, { color: colors.success }]}>+{gain}</Text>
                    </View>
                  )}
                  {!best && (
                    <View style={[styles.tapToLog, { borderColor: LIFT_COLORS[key] }]}>
                      <Text style={[styles.tapToLogText, { color: LIFT_COLORS[key] }]}>Log</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          {total > 0 && (
            <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.totalLabel, { color: colors.textMuted }]}>Total</Text>
              <Text style={[styles.totalValue, { color: colors.text }]}>
                {total}<Text style={[styles.totalUnit, { color: colors.textMuted }]}> {unit}</Text>
              </Text>
            </View>
          )}
        </View>
      </Animated.View>

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

      {/* ── This Week ── */}
      {clientStats.thisWeekTotal > 0 && (
        <Animated.View entering={FadeInDown.delay(120).duration(350)}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>This Week</Text>
          <View style={[styles.statCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
            <View style={styles.weekTopRow}>
              <Text style={[styles.weekFraction, { color: colors.text }]}>
                {clientStats.thisWeekDone}
                <Text style={[styles.weekFractionOf, { color: colors.textMuted }]}>/{clientStats.thisWeekTotal}</Text>
              </Text>
              <Text style={[styles.weekLabel, { color: colors.textMuted }]}>exercises done</Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: colors.surfaceLight }]}>
              <View style={[
                styles.progressFill,
                {
                  width: `${Math.round(weekPct * 100)}%` as any,
                  backgroundColor: weekPct >= 0.8 ? colors.success : weekPct >= 0.5 ? colors.primary : colors.warning,
                },
              ]} />
            </View>
            <View style={styles.weekStatsRow}>
              <View style={styles.weekStat}>
                <Text style={[styles.weekStatValue, { color: colors.text }]}>{clientStats.videosSent}</Text>
                <Text style={[styles.weekStatLabel, { color: colors.textMuted }]}>Videos Sent</Text>
              </View>
              <View style={[styles.weekStatDivider, { backgroundColor: colors.border }]} />
              <View style={styles.weekStat}>
                <Text style={[styles.weekStatValue, { color: clientStats.awaitingReview > 0 ? colors.warning : colors.text }]}>{clientStats.awaitingReview}</Text>
                <Text style={[styles.weekStatLabel, { color: colors.textMuted }]}>Awaiting Review</Text>
              </View>
              <View style={[styles.weekStatDivider, { backgroundColor: colors.border }]} />
              <View style={styles.weekStat}>
                <Text style={[styles.weekStatValue, { color: clientStats.feedbackReceived > 0 ? colors.success : colors.text }]}>{clientStats.feedbackReceived}</Text>
                <Text style={[styles.weekStatLabel, { color: colors.textMuted }]}>Feedback</Text>
              </View>
            </View>
          </View>
        </Animated.View>
      )}

      {/* ── All Time ── */}
      <Animated.View entering={FadeInDown.delay(180).duration(350)}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>All Time</Text>
        <View style={styles.allTimeRow}>
          <View style={[styles.allTimeCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
            <Ionicons name="trophy" size={20} color={Colors.colors.squat} />
            <Text style={[styles.allTimeValue, { color: colors.text }]}>{prs.length}</Text>
            <Text style={[styles.allTimeLabel, { color: colors.textMuted }]}>PRs Logged</Text>
          </View>
          <View style={[styles.allTimeCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
            <Ionicons name="videocam" size={20} color={Colors.colors.bench} />
            <Text style={[styles.allTimeValue, { color: colors.text }]}>{clientStats.videosSent}</Text>
            <Text style={[styles.allTimeLabel, { color: colors.textMuted }]}>Videos Sent</Text>
          </View>
          <View style={[styles.allTimeCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.colors.deadlift} />
            <Text style={[styles.allTimeValue, { color: colors.text }]}>{clientStats.totalCompleted}</Text>
            <Text style={[styles.allTimeLabel, { color: colors.textMuted }]}>Exercises Done</Text>
          </View>
        </View>
        {daysSinceLastPR !== null && (
          <View style={[styles.lastPRBanner, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
            <Ionicons name="time-outline" size={16} color={colors.textMuted} />
            <Text style={[styles.lastPRText, { color: colors.textMuted }]}>
              {daysSinceLastPR === 0 ? 'PR logged today' : daysSinceLastPR === 1 ? 'Last PR yesterday' : `Last PR ${daysSinceLastPR} days ago`}
            </Text>
          </View>
        )}
      </Animated.View>

      {/* ── PR History ── */}
      <Animated.View entering={FadeInDown.delay(240).duration(350)}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>PR History</Text>
        {sortedPRs.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="trophy-outline" size={40} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.text }]}>No PRs yet</Text>
            <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>Tap a lift above or "Log New PR" to start tracking</Text>
          </View>
        ) : (
          sortedPRs.map((pr, idx) => (
            <Animated.View key={pr.id} entering={FadeInDown.delay(idx * 35).duration(280)}>
              <Pressable
                style={({ pressed }) => [styles.prRow, { backgroundColor: colors.backgroundCard, borderColor: colors.border }, pressed && { opacity: 0.8 }]}
                onLongPress={() => handleDelete(pr)}
              >
                <View style={[styles.prDot, { backgroundColor: LIFT_COLORS[pr.liftType] }]} />
                <View style={styles.prInfo}>
                  <Text style={[styles.prLiftName, { color: colors.text }]}>{LIFT_LABELS[pr.liftType]}</Text>
                  <Text style={[styles.prDate, { color: colors.textMuted }]}>{new Date(pr.date).toLocaleDateString()}</Text>
                  {!!pr.notes && <Text style={[styles.prNotes, { color: colors.textSecondary }]} numberOfLines={1}>{pr.notes}</Text>}
                </View>
                <Text style={[styles.prWeight, { color: colors.text }]}>{pr.weight}<Text style={[styles.prUnit, { color: colors.textMuted }]}> {pr.unit}</Text></Text>
              </Pressable>
            </Animated.View>
          ))
        )}
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

  // Big 3
  big3Card: { borderRadius: 16, borderWidth: 1, padding: 20, marginBottom: 12 },
  big3Header: { fontFamily: 'Rubik_600SemiBold', fontSize: 11, letterSpacing: 1.5, marginBottom: 16, textAlign: 'center' },
  big3Row: { flexDirection: 'row' },
  liftCol: { flex: 1, alignItems: 'center', gap: 4 },
  liftColLabel: { fontFamily: 'Rubik_700Bold', fontSize: 10, letterSpacing: 1 },
  liftColWeight: { fontFamily: 'Rubik_700Bold', fontSize: 32, lineHeight: 38 },
  liftColUnit: { fontFamily: 'Rubik_400Regular', fontSize: 12, marginTop: -2 },
  gainBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4 },
  gainText: { fontFamily: 'Rubik_600SemiBold', fontSize: 11 },
  tapToLog: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3, marginTop: 6 },
  tapToLogText: { fontFamily: 'Rubik_600SemiBold', fontSize: 11 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, paddingTop: 14, borderTopWidth: 1 },
  totalLabel: { fontFamily: 'Rubik_500Medium', fontSize: 13 },
  totalValue: { fontFamily: 'Rubik_700Bold', fontSize: 22 },
  totalUnit: { fontFamily: 'Rubik_400Regular', fontSize: 14 },

  // Log PR button
  logPRBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, marginBottom: 4 },
  logPRBtnText: { fontFamily: 'Rubik_700Bold', fontSize: 15, color: '#fff' },

  // This Week
  statCard: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 4 },
  weekTopRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 10 },
  weekFraction: { fontFamily: 'Rubik_700Bold', fontSize: 28 },
  weekFractionOf: { fontFamily: 'Rubik_400Regular', fontSize: 18 },
  weekLabel: { fontFamily: 'Rubik_400Regular', fontSize: 13 },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 16 },
  progressFill: { height: '100%' as const, borderRadius: 3 },
  weekStatsRow: { flexDirection: 'row', alignItems: 'center' },
  weekStat: { flex: 1, alignItems: 'center' },
  weekStatValue: { fontFamily: 'Rubik_700Bold', fontSize: 20 },
  weekStatLabel: { fontFamily: 'Rubik_400Regular', fontSize: 10, marginTop: 2, textAlign: 'center' },
  weekStatDivider: { width: 1, height: 32 },

  // All Time
  allTimeRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  allTimeCard: { flex: 1, alignItems: 'center', borderRadius: 14, borderWidth: 1, paddingVertical: 16, gap: 6 },
  allTimeValue: { fontFamily: 'Rubik_700Bold', fontSize: 22 },
  allTimeLabel: { fontFamily: 'Rubik_400Regular', fontSize: 10, textAlign: 'center' },
  lastPRBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  lastPRText: { fontFamily: 'Rubik_400Regular', fontSize: 13 },

  // PR history
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontFamily: 'Rubik_600SemiBold', fontSize: 15 },
  emptyDesc: { fontFamily: 'Rubik_400Regular', fontSize: 13, textAlign: 'center', paddingHorizontal: 20 },
  prRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, padding: 14, borderWidth: 1, marginBottom: 8 },
  prDot: { width: 10, height: 10, borderRadius: 5 },
  prInfo: { flex: 1 },
  prLiftName: { fontFamily: 'Rubik_600SemiBold', fontSize: 14 },
  prDate: { fontFamily: 'Rubik_400Regular', fontSize: 13, marginTop: 1 },
  prNotes: { fontFamily: 'Rubik_400Regular', fontSize: 13, marginTop: 2 },
  prWeight: { fontFamily: 'Rubik_700Bold', fontSize: 18 },
  prUnit: { fontFamily: 'Rubik_400Regular', fontSize: 13 },
});
