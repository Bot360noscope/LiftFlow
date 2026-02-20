import { StyleSheet, Text, View, ScrollView, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState, useCallback } from "react";
import { router, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import Colors from "@/constants/colors";
import {
  getProfile, getPrograms, getPRs, getBestPR, getClients, getNotifications,
  type Program, type LiftPR, type UserProfile, type ClientInfo, type AppNotification,
} from "@/lib/storage";

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ClientCard({ client, programs }: { client: ClientInfo; programs: Program[] }) {
  const clientPrograms = programs.filter(p => p.clientId === client.id);
  let totalEx = 0, completedEx = 0, hasNotes = false, hasVideo = false;
  for (const prog of clientPrograms) {
    for (const week of prog.weeks) {
      for (const day of week.days) {
        for (const ex of day.exercises) {
          if (ex.name) totalEx++;
          if (ex.isCompleted) completedEx++;
          if (ex.clientNotes) hasNotes = true;
          if (ex.videoUrl) hasVideo = true;
        }
      }
    }
  }
  const progress = totalEx > 0 ? Math.round((completedEx / totalEx) * 100) : 0;

  return (
    <Pressable
      style={({ pressed }) => [styles.clientCard, pressed && { opacity: 0.85 }]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (clientPrograms.length > 0) {
          router.push(`/program/${clientPrograms[0].id}`);
        }
      }}
    >
      <View style={styles.clientCardHeader}>
        <View style={styles.clientAvatar}>
          <Text style={styles.clientAvatarText}>{(client.name || '?')[0].toUpperCase()}</Text>
        </View>
        <View style={styles.clientInfo}>
          <Text style={styles.clientName}>{client.name || 'Client'}</Text>
          <Text style={styles.clientMeta}>{clientPrograms.length} program{clientPrograms.length !== 1 ? 's' : ''}</Text>
        </View>
        <View style={styles.clientIndicators}>
          {hasNotes && <Ionicons name="chatbubble" size={14} color={Colors.colors.accent} />}
          {hasVideo && <Ionicons name="videocam" size={14} color={Colors.colors.primary} />}
        </View>
      </View>
      {totalEx > 0 && (
        <View style={styles.clientProgress}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.clientProgressText}>{progress}% complete</Text>
        </View>
      )}
    </Pressable>
  );
}

function ProgramCard({ program }: { program: Program }) {
  let totalExercises = 0;
  let completedExercises = 0;
  for (const week of program.weeks) {
    for (const day of week.days) {
      for (const ex of day.exercises) {
        totalExercises++;
        if (ex.isCompleted) completedExercises++;
      }
    }
  }
  const progress = totalExercises > 0 ? Math.round((completedExercises / totalExercises) * 100) : 0;

  return (
    <Pressable
      style={({ pressed }) => [styles.programCard, pressed && { opacity: 0.8 }]}
      onPress={() => router.push(`/program/${program.id}`)}
    >
      <View style={styles.programCardHeader}>
        <View style={[styles.statusDot, { backgroundColor: program.status === 'active' ? Colors.colors.success : Colors.colors.warning }]} />
        <Text style={styles.programTitle} numberOfLines={1}>{program.title}</Text>
        <Ionicons name="chevron-forward" size={16} color={Colors.colors.textMuted} />
      </View>
      <Text style={styles.programDesc} numberOfLines={1}>{program.description}</Text>
      <View style={styles.programMeta}>
        <Text style={styles.programMetaText}>{program.weeks.length}W / {program.daysPerWeek}D</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.programMetaText}>{progress}%</Text>
      </View>
    </Pressable>
  );
}

function NotificationItem({ notification }: { notification: AppNotification }) {
  const icon = notification.type === 'video' ? 'videocam' :
    notification.type === 'notes' ? 'chatbubble' :
    notification.type === 'comment' ? 'school' : 'checkmark-circle';
  const color = notification.type === 'video' ? Colors.colors.primary :
    notification.type === 'notes' ? Colors.colors.accent :
    notification.type === 'comment' ? Colors.colors.accent : Colors.colors.success;

  return (
    <Pressable
      style={[styles.notifItem, !notification.read && styles.notifItemUnread]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(`/program/${notification.programId}`);
      }}
    >
      <View style={[styles.notifIcon, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon as any} size={16} color={color} />
      </View>
      <View style={styles.notifContent}>
        <Text style={styles.notifTitle} numberOfLines={1}>{notification.title}</Text>
        <Text style={styles.notifMsg} numberOfLines={2}>{notification.message}</Text>
      </View>
      {!notification.read && <View style={styles.notifDot} />}
    </Pressable>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [prs, setPRs] = useState<LiftPR[]>([]);
  const [clients, setClients] = useState<ClientInfo[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const loadData = useCallback(async () => {
    const [p, progs, prData, cl, notifs] = await Promise.all([
      getProfile(), getPrograms(), getPRs(), getClients(), getNotifications(),
    ]);
    setProfile(p);
    setPrograms(progs);
    setPRs(prData);
    setClients(cl);
    setNotifications(notifs);
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const bestSquat = getBestPR(prs, 'squat');
  const bestDeadlift = getBestPR(prs, 'deadlift');
  const bestBench = getBestPR(prs, 'bench');

  const activePrograms = programs.filter(p => p.status === 'active');
  const recentPrograms = programs.slice(0, 3);
  const unreadNotifs = notifications.filter(n => !n.read);
  const recentNotifs = notifications.slice(0, 5);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const webBottomInset = Platform.OS === 'web' ? 84 : 0;
  const isCoach = profile?.role === 'coach';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: insets.top + webTopInset + 16, paddingBottom: insets.bottom + webBottomInset + 20 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeInDown.duration(400)}>
        <View style={styles.greetingRow}>
          <View>
            <Text style={styles.greeting}>
              {isCoach ? 'Coach Dashboard' : 'My Training'}
            </Text>
            <Text style={styles.greetingSub}>
              {profile?.name ? `Welcome, ${profile.name}` : 'Welcome to LiftFlow'}
            </Text>
          </View>
          <Pressable
            style={styles.roleChip}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <Ionicons name={isCoach ? 'school' : 'fitness'} size={14} color={Colors.colors.primary} />
            <Text style={styles.roleChipText}>{isCoach ? 'Coach' : 'Client'}</Text>
          </Pressable>
        </View>
      </Animated.View>

      {isCoach && profile?.coachCode && (
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <View style={styles.coachCodeCard}>
            <View style={styles.coachCodeLeft}>
              <Text style={styles.coachCodeLabel}>Your Coach Code</Text>
              <Text style={styles.coachCodeDesc}>Share this with clients to connect</Text>
            </View>
            <Pressable
              style={styles.coachCodeBadge}
              onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            >
              <Text style={styles.coachCodeValue}>{profile.coachCode}</Text>
              <Ionicons name="copy-outline" size={14} color={Colors.colors.primary} />
            </Pressable>
          </View>
        </Animated.View>
      )}

      <Animated.View entering={FadeInDown.delay(150).duration(400)}>
        <View style={styles.statsRow}>
          {isCoach ? (
            <>
              <StatCard icon="people" label="Clients" value={String(clients.length)} color={Colors.colors.primary} />
              <StatCard icon="barbell" label="Programs" value={String(programs.length)} color={Colors.colors.accent} />
              <StatCard icon="notifications" label="Unread" value={String(unreadNotifs.length)} color={Colors.colors.warning} />
            </>
          ) : (
            <>
              <StatCard icon="barbell" label="Programs" value={String(programs.length)} color={Colors.colors.primary} />
              <StatCard icon="checkmark-circle" label="Active" value={String(activePrograms.length)} color={Colors.colors.success} />
              <StatCard icon="trophy" label="PRs" value={String(prs.length)} color={Colors.colors.accent} />
            </>
          )}
        </View>
      </Animated.View>

      {isCoach ? (
        <>
          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Clients</Text>
              <Pressable
                style={styles.addBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/(tabs)/programs');
                }}
              >
                <Ionicons name="eye-outline" size={18} color={Colors.colors.primary} />
              </Pressable>
            </View>

            {clients.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="people-outline" size={32} color={Colors.colors.textMuted} />
                <Text style={styles.emptyText}>No clients yet</Text>
                <Text style={styles.emptySubText}>Share your coach code to connect with clients</Text>
              </View>
            ) : (
              clients.map((client) => (
                <ClientCard key={client.id} client={client} programs={programs} />
              ))
            )}
          </Animated.View>

          {recentNotifs.length > 0 && (
            <Animated.View entering={FadeInDown.delay(250).duration(400)}>
              <Text style={styles.sectionTitle}>Recent Activity</Text>
              {recentNotifs.map(n => (
                <NotificationItem key={n.id} notification={n} />
              ))}
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            <View style={styles.quickActions}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.actionsGrid}>
                <Pressable
                  style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.8 }]}
                  onPress={() => router.push('/create-program')}
                >
                  <Ionicons name="grid-outline" size={22} color={Colors.colors.primary} />
                  <Text style={styles.actionText}>Build Program</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.8 }]}
                  onPress={() => router.push('/(tabs)/programs')}
                >
                  <Ionicons name="barbell-outline" size={22} color={Colors.colors.accent} />
                  <Text style={styles.actionText}>Programs</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.8 }]}
                  onPress={() => router.push('/(tabs)/progress')}
                >
                  <Ionicons name="analytics-outline" size={22} color={Colors.colors.success} />
                  <Text style={styles.actionText}>Client Progress</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.8 }]}
                  onPress={() => router.push('/(tabs)/profile')}
                >
                  <Ionicons name="settings-outline" size={22} color={Colors.colors.textSecondary} />
                  <Text style={styles.actionText}>Settings</Text>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </>
      ) : (
        <>
          {prs.length > 0 && (
            <Animated.View entering={FadeInDown.delay(200).duration(400)}>
              <Text style={styles.sectionTitle}>Best Lifts</Text>
              <View style={styles.prRow}>
                {bestSquat && (
                  <View style={[styles.prCard, { borderColor: Colors.colors.squat }]}>
                    <Text style={[styles.prLift, { color: Colors.colors.squat }]}>Squat</Text>
                    <Text style={styles.prWeight}>{bestSquat.weight}</Text>
                    <Text style={styles.prUnit}>{bestSquat.unit}</Text>
                  </View>
                )}
                {bestBench && (
                  <View style={[styles.prCard, { borderColor: Colors.colors.bench }]}>
                    <Text style={[styles.prLift, { color: Colors.colors.bench }]}>Bench</Text>
                    <Text style={styles.prWeight}>{bestBench.weight}</Text>
                    <Text style={styles.prUnit}>{bestBench.unit}</Text>
                  </View>
                )}
                {bestDeadlift && (
                  <View style={[styles.prCard, { borderColor: Colors.colors.deadlift }]}>
                    <Text style={[styles.prLift, { color: Colors.colors.deadlift }]}>Deadlift</Text>
                    <Text style={styles.prWeight}>{bestDeadlift.weight}</Text>
                    <Text style={styles.prUnit}>{bestDeadlift.unit}</Text>
                  </View>
                )}
              </View>
            </Animated.View>
          )}

          {recentNotifs.length > 0 && (
            <Animated.View entering={FadeInDown.delay(220).duration(400)}>
              <Text style={styles.sectionTitle}>Recent Activity</Text>
              {recentNotifs.map(n => (
                <NotificationItem key={n.id} notification={n} />
              ))}
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.delay(250).duration(400)}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Programs</Text>
              <Pressable
                style={styles.addBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/create-program');
                }}
              >
                <Ionicons name="add" size={20} color={Colors.colors.primary} />
              </Pressable>
            </View>

            {recentPrograms.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="document-text-outline" size={32} color={Colors.colors.textMuted} />
                <Text style={styles.emptyText}>No programs assigned yet</Text>
                <Pressable
                  style={styles.emptyBtn}
                  onPress={() => router.push('/create-program')}
                >
                  <Text style={styles.emptyBtnText}>Create Training Plan</Text>
                </Pressable>
              </View>
            ) : (
              recentPrograms.map((prog) => (
                <ProgramCard key={prog.id} program={prog} />
              ))
            )}

            {programs.length > 3 && (
              <Pressable
                style={styles.seeAllBtn}
                onPress={() => router.push('/(tabs)/programs')}
              >
                <Text style={styles.seeAllText}>See all programs</Text>
                <Ionicons name="arrow-forward" size={16} color={Colors.colors.primary} />
              </Pressable>
            )}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            <View style={styles.quickActions}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.actionsGrid}>
                <Pressable
                  style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.8 }]}
                  onPress={() => router.push('/create-program')}
                >
                  <Ionicons name="grid-outline" size={22} color={Colors.colors.primary} />
                  <Text style={styles.actionText}>New Plan</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.8 }]}
                  onPress={() => router.push('/add-pr')}
                >
                  <Ionicons name="trophy-outline" size={22} color={Colors.colors.accent} />
                  <Text style={styles.actionText}>Log PR</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.8 }]}
                  onPress={() => router.push('/(tabs)/progress')}
                >
                  <Ionicons name="trending-up" size={22} color={Colors.colors.success} />
                  <Text style={styles.actionText}>View Progress</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.8 }]}
                  onPress={() => router.push('/(tabs)/profile')}
                >
                  <Ionicons name="settings-outline" size={22} color={Colors.colors.textSecondary} />
                  <Text style={styles.actionText}>Settings</Text>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.colors.background },
  scrollContent: { paddingHorizontal: 20 },
  greetingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  greeting: { fontFamily: 'Rubik_700Bold', fontSize: 26, color: Colors.colors.text },
  greetingSub: { fontFamily: 'Rubik_400Regular', fontSize: 14, color: Colors.colors.textSecondary, marginTop: 2 },
  roleChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(232,81,47,0.1)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
  },
  roleChipText: { fontFamily: 'Rubik_500Medium', fontSize: 12, color: Colors.colors.primary },
  coachCodeCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.colors.backgroundCard, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.colors.border, marginBottom: 16,
  },
  coachCodeLeft: {},
  coachCodeLabel: { fontFamily: 'Rubik_600SemiBold', fontSize: 14, color: Colors.colors.text },
  coachCodeDesc: { fontFamily: 'Rubik_400Regular', fontSize: 11, color: Colors.colors.textMuted, marginTop: 2 },
  coachCodeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(232,81,47,0.1)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
  },
  coachCodeValue: { fontFamily: 'Rubik_700Bold', fontSize: 16, color: Colors.colors.primary, letterSpacing: 2 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1, alignItems: 'center', backgroundColor: Colors.colors.backgroundCard,
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.colors.border, gap: 6,
  },
  statIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontFamily: 'Rubik_700Bold', fontSize: 20, color: Colors.colors.text },
  statLabel: { fontFamily: 'Rubik_400Regular', fontSize: 11, color: Colors.colors.textMuted },
  clientCard: {
    backgroundColor: Colors.colors.backgroundCard, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.colors.border, marginBottom: 10,
  },
  clientCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clientAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(232,81,47,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  clientAvatarText: { fontFamily: 'Rubik_700Bold', fontSize: 16, color: Colors.colors.primary },
  clientInfo: { flex: 1 },
  clientName: { fontFamily: 'Rubik_600SemiBold', fontSize: 15, color: Colors.colors.text },
  clientMeta: { fontFamily: 'Rubik_400Regular', fontSize: 11, color: Colors.colors.textMuted, marginTop: 1 },
  clientIndicators: { flexDirection: 'row', gap: 6 },
  clientProgress: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  clientProgressText: { fontFamily: 'Rubik_500Medium', fontSize: 11, color: Colors.colors.textSecondary, width: 72, textAlign: 'right' },
  notifItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.colors.backgroundCard, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: Colors.colors.border, marginBottom: 6,
  },
  notifItemUnread: { borderColor: Colors.colors.primary, backgroundColor: 'rgba(232,81,47,0.04)' },
  notifIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  notifContent: { flex: 1 },
  notifTitle: { fontFamily: 'Rubik_600SemiBold', fontSize: 13, color: Colors.colors.text },
  notifMsg: { fontFamily: 'Rubik_400Regular', fontSize: 11, color: Colors.colors.textMuted, marginTop: 1 },
  notifDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.colors.primary },
  prRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  prCard: {
    flex: 1, alignItems: 'center', backgroundColor: Colors.colors.backgroundCard,
    borderRadius: 12, paddingVertical: 12, borderLeftWidth: 3, paddingHorizontal: 8,
  },
  prLift: { fontFamily: 'Rubik_600SemiBold', fontSize: 12 },
  prWeight: { fontFamily: 'Rubik_700Bold', fontSize: 22, color: Colors.colors.text, marginTop: 2 },
  prUnit: { fontFamily: 'Rubik_400Regular', fontSize: 11, color: Colors.colors.textMuted },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontFamily: 'Rubik_700Bold', fontSize: 18, color: Colors.colors.text, marginBottom: 12 },
  addBtn: {
    width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(232,81,47,0.1)', marginBottom: 12,
  },
  programCard: {
    backgroundColor: Colors.colors.backgroundCard, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.colors.border, marginBottom: 10,
  },
  programCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  programTitle: { flex: 1, fontFamily: 'Rubik_600SemiBold', fontSize: 15, color: Colors.colors.text },
  programDesc: { fontFamily: 'Rubik_400Regular', fontSize: 12, color: Colors.colors.textMuted, marginTop: 4 },
  programMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  programMetaText: { fontFamily: 'Rubik_500Medium', fontSize: 11, color: Colors.colors.textSecondary },
  progressBar: {
    flex: 1, height: 4, borderRadius: 2, backgroundColor: Colors.colors.surfaceLight, overflow: 'hidden' as const,
  },
  progressFill: { height: '100%' as const, borderRadius: 2, backgroundColor: Colors.colors.primary },
  emptyCard: {
    alignItems: 'center', backgroundColor: Colors.colors.backgroundCard, borderRadius: 14,
    padding: 30, borderWidth: 1, borderColor: Colors.colors.border, gap: 10, marginBottom: 10,
  },
  emptyText: { fontFamily: 'Rubik_500Medium', fontSize: 14, color: Colors.colors.textSecondary, textAlign: 'center' },
  emptySubText: { fontFamily: 'Rubik_400Regular', fontSize: 12, color: Colors.colors.textMuted, textAlign: 'center' },
  emptyBtn: {
    backgroundColor: Colors.colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10,
  },
  emptyBtnText: { fontFamily: 'Rubik_600SemiBold', fontSize: 13, color: '#fff' },
  seeAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 12, marginTop: 4,
  },
  seeAllText: { fontFamily: 'Rubik_500Medium', fontSize: 13, color: Colors.colors.primary },
  quickActions: { marginTop: 8 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionCard: {
    width: '48%' as any, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.colors.backgroundCard, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.colors.border,
  },
  actionText: { fontFamily: 'Rubik_500Medium', fontSize: 13, color: Colors.colors.text },
});
