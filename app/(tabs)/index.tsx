import { StyleSheet, Text, View, ScrollView, Pressable, Platform, TextInput, ActivityIndicator, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState, useCallback, useRef } from "react";
import { router, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import Colors from "@/constants/colors";
import NetworkError from "@/components/NetworkError";
import {
  getProfile, getPrograms, getPRs, getBestPR, getClients, getNotifications,
  clearAllNotifications, deleteNotification, getLatestMessages,
  getCachedProfile, getCachedPrograms, getCachedPRs, getCachedClients, getCachedNotifications,
  type Program, type LiftPR, type UserProfile, type ClientInfo, type AppNotification, type LatestMessages,
} from "@/lib/storage";
import { getAvatarUrl } from "@/lib/api";

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{label}</Text>
    </View>
  );
}

function ClientCard({ client, programs, hasUnread }: { client: ClientInfo; programs: Program[]; hasUnread: boolean }) {
  const clientPrograms = programs.filter(p => p.clientId === client.id);
  let totalEx = 0, completedEx = 0;
  for (const prog of clientPrograms) {
    for (const week of prog.weeks) {
      for (const day of week.days) {
        for (const ex of day.exercises) {
          if (ex.name) totalEx++;
          if (ex.isCompleted) completedEx++;
        }
      }
    }
  }
  const progress = totalEx > 0 ? Math.round((completedEx / totalEx) * 100) : 0;

  return (
    <Pressable
      style={({ pressed }) => [styles.clientCard, pressed && { opacity: 0.85 }]}
      accessibilityLabel={`View client ${client.name || 'details'}`}
      accessibilityRole="button"
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: '/client/[id]', params: { id: client.id, name: client.name } });
      }}
    >
      <View style={styles.clientCardHeader}>
        {client.avatarUrl ? (
          <Image source={{ uri: getAvatarUrl(client.avatarUrl) }} style={styles.clientAvatarImage} />
        ) : (
          <View style={styles.clientAvatar}>
            <Text style={styles.clientAvatarText}>{(client.name || '?')[0].toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.clientInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.clientName}>{client.name || 'Client'}</Text>
            {hasUnread && <View style={styles.clientUnreadDot} />}
          </View>
          <Text style={styles.clientMeta}>{clientPrograms.length} program{clientPrograms.length !== 1 ? 's' : ''}</Text>
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
      accessibilityLabel={`Open program ${program.title}`}
      accessibilityRole="button"
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

function NotificationItem({ notification, onDelete }: { notification: AppNotification; onDelete: (id: string) => void }) {
  const icon = notification.type === 'video' ? 'videocam' :
    notification.type === 'notes' ? 'chatbubble' :
    notification.type === 'comment' ? 'school' :
    notification.type === 'chat' ? 'chatbubbles' : 'checkmark-circle';
  const color = notification.type === 'video' ? Colors.colors.primary :
    notification.type === 'notes' ? Colors.colors.accent :
    notification.type === 'comment' ? Colors.colors.accent :
    notification.type === 'chat' ? Colors.colors.primary : Colors.colors.success;

  return (
    <Pressable
      style={[styles.notifItem, !notification.read && styles.notifItemUnread]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onDelete(notification.id);
        if (notification.type === 'chat') {
          router.push({
            pathname: '/conversation',
            params: {
              coachId: notification.programId,
              clientProfileId: notification.programTitle,
              clientName: notification.exerciseName,
            },
          });
        } else if (notification.programId) {
          router.push(`/program/${notification.programId}`);
        }
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

function HomeCoachCodeCard({ coachCode }: { coachCode: string }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <View style={styles.coachCodeCard}>
      <View style={styles.coachCodeLeft}>
        <Text style={styles.coachCodeLabel}>Your Coach Code</Text>
        <Text style={styles.coachCodeDesc}>Share this with clients to connect</Text>
      </View>
      <Pressable
        style={styles.coachCodeBadge}
        onPress={() => {
          setRevealed(!revealed);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
      >
        {revealed ? (
          <>
            <Text style={styles.coachCodeValue}>{coachCode}</Text>
            <Ionicons name="eye-off-outline" size={14} color={Colors.colors.primary} />
          </>
        ) : (
          <>
            <Ionicons name="eye-outline" size={14} color={Colors.colors.textMuted} />
            <Text style={styles.coachCodeHiddenText}>Tap to reveal</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<UserProfile | null>(getCachedProfile());
  const [programs, setPrograms] = useState<Program[]>(getCachedPrograms());
  const [prs, setPRs] = useState<LiftPR[]>(getCachedPRs());
  const [clients, setClients] = useState<ClientInfo[]>(getCachedClients());
  const [notifications, setNotifications] = useState<AppNotification[]>(getCachedNotifications());
  const [clientSearch, setClientSearch] = useState('');
  const [latestMsgs, setLatestMsgs] = useState<LatestMessages>({});
  const [loading, setLoading] = useState(!getCachedProfile());
  const [error, setError] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const p = await getProfile();
      setProfile(p);
      const [progs, prData, cl, notifs, latest] = await Promise.all([
        getPrograms().catch(() => [] as Program[]),
        getPRs().catch(() => [] as LiftPR[]),
        getClients().catch(() => [] as ClientInfo[]),
        getNotifications().catch(() => [] as AppNotification[]),
        p.role === 'coach' ? getLatestMessages().catch(() => ({} as LatestMessages)) : Promise.resolve({} as LatestMessages),
      ]);
      setPrograms(progs);
      setPRs(prData);
      setClients(cl);
      setNotifications(notifs);
      setLatestMsgs(latest);
      setError(false);
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useFocusEffect(useCallback(() => {
    loadData();
    pollRef.current = setInterval(async () => {
      try {
        const notifs = await getNotifications();
        setNotifications(notifs);
      } catch (e) {}
    }, 10000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadData]));

  const handleDeleteNotification = async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    try { await deleteNotification(id); } catch (e) { console.warn('Failed to delete notification:', e); }
  };

  const handleClearAllNotifications = async () => {
    await clearAllNotifications();
    setNotifications([]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const bestSquat = getBestPR(prs, 'squat');
  const bestDeadlift = getBestPR(prs, 'deadlift');
  const bestBench = getBestPR(prs, 'bench');

  const isCoach = profile?.role === 'coach';
  const activePrograms = programs.filter(p => p.status === 'active');
  const recentPrograms = programs.slice(0, 3);
  const unreadNotifs = notifications.filter(n => !n.read);
  const clientNotifs = isCoach
    ? notifications.filter(n => n.fromRole === 'client' && n.type !== 'completion')
    : notifications;
  const recentNotifs = clientNotifs.slice(0, 5);
  const sortedClients = isCoach ? [...clients].sort((a, b) => {
    const aMsg = latestMsgs[a.clientProfileId || ''];
    const bMsg = latestMsgs[b.clientProfileId || ''];
    if (aMsg && bMsg) return new Date(bMsg.createdAt).getTime() - new Date(aMsg.createdAt).getTime();
    if (aMsg) return -1;
    if (bMsg) return 1;
    return 0;
  }) : clients;
  const filteredClients = clientSearch.trim()
    ? sortedClients.filter(c => c.name.toLowerCase().includes(clientSearch.trim().toLowerCase()))
    : sortedClients;

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
          <View style={styles.greetingLeft}>
            <Text style={styles.greeting} numberOfLines={1}>
              {isCoach ? 'Dashboard' : 'My Training'}
            </Text>
            <Text style={styles.greetingSub} numberOfLines={1}>
              {profile?.name ? `Welcome, ${profile.name}` : 'Welcome to LiftFlow'}
            </Text>
          </View>
          <View style={styles.roleChipRow}>
            {isCoach && (
              <View style={[styles.planBadge, profile?.plan !== 'free' && styles.planBadgePremium]}>
                <Ionicons
                  name={profile?.plan !== 'free' ? 'star' : 'star-outline'}
                  size={12}
                  color={profile?.plan !== 'free' ? '#FFD700' : Colors.colors.textMuted}
                />
                <Text style={[styles.planBadgeText, profile?.plan !== 'free' && styles.planBadgeTextPremium]}>
                  {profile?.plan === 'free' ? 'Free' : profile?.plan === 'tier_5' ? 'Starter' : profile?.plan === 'tier_10' ? 'Growth' : profile?.plan === 'saas' ? 'SaaS' : 'Premium'}
                </Text>
              </View>
            )}
            <Pressable
              style={styles.roleChip}
              accessibilityLabel={`Role: ${isCoach ? 'Coach' : 'Client'}. View profile`}
              accessibilityRole="button"
              onPress={() => router.push('/(tabs)/profile')}
            >
              <Ionicons name={isCoach ? 'school' : 'fitness'} size={14} color={Colors.colors.primary} />
              <Text style={styles.roleChipText}>{isCoach ? 'Coach' : 'Client'}</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>

      {isCoach && profile?.coachCode && (
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <HomeCoachCodeCard coachCode={profile.coachCode} />
        </Animated.View>
      )}

      <Animated.View entering={FadeInDown.delay(150).duration(400)}>
        <View style={styles.statsRow}>
          {isCoach ? (
            <>
              <StatCard icon="people" label="Clients" value={String(clients.length)} color={Colors.colors.primary} />
              <StatCard icon="barbell" label="Active Programs" value={String(activePrograms.length)} color={Colors.colors.accent} />
              <StatCard icon="notifications" label="Needs Review" value={String(unreadNotifs.length)} color={Colors.colors.warning} />
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
              <Text style={styles.sectionTitle}>Clients</Text>
              <Pressable
                style={styles.addBtn}
                accessibilityLabel="View all clients"
                accessibilityRole="button"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/(tabs)/programs');
                }}
              >
                <Ionicons name="eye-outline" size={18} color={Colors.colors.primary} />
              </Pressable>
            </View>

            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color={Colors.colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search clients..."
                placeholderTextColor={Colors.colors.textMuted}
                value={clientSearch}
                onChangeText={setClientSearch}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Search clients"
              />
              {clientSearch.length > 0 && (
                <Pressable onPress={() => setClientSearch('')} hitSlop={8} accessibilityLabel="Clear search" accessibilityRole="button">
                  <Ionicons name="close-circle" size={16} color={Colors.colors.textMuted} />
                </Pressable>
              )}
            </View>

            {clients.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="people-outline" size={32} color={Colors.colors.textMuted} />
                <Text style={styles.emptyText}>No clients connected yet</Text>
                <Text style={styles.emptySubText}>Share your coach code so clients can find you</Text>
              </View>
            ) : filteredClients.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="search-outline" size={24} color={Colors.colors.textMuted} />
                <Text style={styles.emptyText}>No matching clients</Text>
              </View>
            ) : (
              filteredClients.map((client) => (
                <ClientCard
                  key={client.id}
                  client={client}
                  programs={programs}
                  hasUnread={notifications.some(n => !n.read && n.title.toLowerCase().includes(client.name.toLowerCase()))}
                />
              ))
            )}
          </Animated.View>

          {recentNotifs.length > 0 && (
            <Animated.View entering={FadeInDown.delay(250).duration(400)}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Activity</Text>
                <Pressable
                  style={styles.clearBtn}
                  onPress={handleClearAllNotifications}
                  hitSlop={8}
                  accessibilityLabel="Clear all notifications"
                  accessibilityRole="button"
                >
                  <Ionicons name="close" size={16} color={Colors.colors.textMuted} />
                </Pressable>
              </View>
              {recentNotifs.map(n => (
                <NotificationItem key={n.id} notification={n} onDelete={handleDeleteNotification} />
              ))}
            </Animated.View>
          )}
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
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Activity</Text>
                <Pressable
                  style={styles.clearBtn}
                  onPress={handleClearAllNotifications}
                  hitSlop={8}
                  accessibilityLabel="Clear all notifications"
                  accessibilityRole="button"
                >
                  <Ionicons name="close" size={16} color={Colors.colors.textMuted} />
                </Pressable>
              </View>
              {recentNotifs.map(n => (
                <NotificationItem key={n.id} notification={n} onDelete={handleDeleteNotification} />
              ))}
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.delay(250).duration(400)}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Programs</Text>
              <Pressable
                style={styles.addBtn}
                accessibilityLabel="Create new program"
                accessibilityRole="button"
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
                <Ionicons name="barbell-outline" size={32} color={Colors.colors.textMuted} />
                <Text style={styles.emptyText}>No programs yet</Text>
                <Text style={styles.emptySubText}>Connect with your coach to receive your first program</Text>
                <Pressable
                  style={styles.emptyBtn}
                  accessibilityLabel="Join a coach"
                  accessibilityRole="button"
                  onPress={() => router.push('/join-coach')}
                >
                  <Text style={styles.emptyBtnText}>Join Coach</Text>
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
                accessibilityLabel="See all programs"
                accessibilityRole="button"
                onPress={() => router.push('/(tabs)/programs')}
              >
                <Text style={styles.seeAllText}>See all programs</Text>
                <Ionicons name="arrow-forward" size={16} color={Colors.colors.primary} />
              </Pressable>
            )}
          </Animated.View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.colors.background },
  scrollContent: { paddingHorizontal: 20 },
  greetingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 12 },
  greetingLeft: { flex: 1 },
  greeting: { fontFamily: 'Rubik_700Bold', fontSize: 28, color: Colors.colors.text },
  greetingSub: { fontFamily: 'Rubik_400Regular', fontSize: 15, color: Colors.colors.textSecondary, marginTop: 4 },
  roleChipRow: { flexDirection: 'column', alignItems: 'flex-end', gap: 6 },
  planBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.colors.surface, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.colors.border,
  },
  planBadgePremium: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)', borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  planBadgeText: { fontFamily: 'Rubik_500Medium', fontSize: 11, color: Colors.colors.textMuted },
  planBadgeTextPremium: { color: '#FFD700' },
  roleChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(232,81,47,0.1)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
  },
  roleChipText: { fontFamily: 'Rubik_500Medium', fontSize: 13, color: Colors.colors.primary },
  coachCodeCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    backgroundColor: Colors.colors.backgroundCard, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: Colors.colors.border, marginBottom: 16,
  },
  coachCodeLeft: { flex: 1 },
  coachCodeLabel: { fontFamily: 'Rubik_600SemiBold', fontSize: 15, color: Colors.colors.text },
  coachCodeDesc: { fontFamily: 'Rubik_400Regular', fontSize: 13, color: Colors.colors.textMuted, marginTop: 4 },
  coachCodeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(232,81,47,0.1)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  },
  coachCodeValue: { fontFamily: 'Rubik_700Bold', fontSize: 16, color: Colors.colors.primary, letterSpacing: 2 },
  coachCodeHiddenText: { fontFamily: 'Rubik_500Medium', fontSize: 13, color: Colors.colors.textMuted },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: {
    flex: 1, alignItems: 'center', backgroundColor: Colors.colors.backgroundCard,
    borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.colors.border, gap: 8,
  },
  statIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontFamily: 'Rubik_700Bold', fontSize: 20, color: Colors.colors.text },
  statLabel: { fontFamily: 'Rubik_400Regular', fontSize: 13, color: Colors.colors.textMuted, textAlign: 'center' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.colors.backgroundCard, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12,
    borderWidth: 1, borderColor: Colors.colors.border, marginBottom: 12,
  },
  searchInput: {
    flex: 1, fontFamily: 'Rubik_400Regular', fontSize: 15, color: Colors.colors.text, padding: 0,
  },
  clientCard: {
    backgroundColor: Colors.colors.backgroundCard, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: Colors.colors.border, marginBottom: 12,
  },
  clientCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clientAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(232,81,47,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  clientAvatarImage: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.colors.primary,
  },
  clientAvatarText: { fontFamily: 'Rubik_700Bold', fontSize: 16, color: Colors.colors.primary },
  clientInfo: { flex: 1 },
  clientName: { fontFamily: 'Rubik_600SemiBold', fontSize: 15, color: Colors.colors.text },
  clientMeta: { fontFamily: 'Rubik_400Regular', fontSize: 13, color: Colors.colors.textMuted, marginTop: 4 },
  clientUnreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.colors.primary },
  clientProgress: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  clientProgressText: { fontFamily: 'Rubik_500Medium', fontSize: 13, color: Colors.colors.textSecondary, width: 72, textAlign: 'right' },
  notifItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.colors.backgroundCard, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: Colors.colors.border, marginBottom: 8,
  },
  notifItemUnread: { borderColor: Colors.colors.primary, backgroundColor: 'rgba(232,81,47,0.04)' },
  notifIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  notifContent: { flex: 1 },
  notifTitle: { fontFamily: 'Rubik_600SemiBold', fontSize: 13, color: Colors.colors.text },
  notifMsg: { fontFamily: 'Rubik_400Regular', fontSize: 13, color: Colors.colors.textMuted, marginTop: 4 },
  notifDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.colors.primary },
  prRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  prCard: {
    flex: 1, alignItems: 'center', backgroundColor: Colors.colors.backgroundCard,
    borderRadius: 12, paddingVertical: 12, borderLeftWidth: 3, paddingHorizontal: 8,
  },
  prLift: { fontFamily: 'Rubik_600SemiBold', fontSize: 13 },
  prWeight: { fontFamily: 'Rubik_700Bold', fontSize: 22, color: Colors.colors.text, marginTop: 4 },
  prUnit: { fontFamily: 'Rubik_400Regular', fontSize: 13, color: Colors.colors.textMuted },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontFamily: 'Rubik_700Bold', fontSize: 18, color: Colors.colors.text, marginBottom: 12 },
  addBtn: {
    width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(232,81,47,0.1)', marginBottom: 12,
  },
  clearBtn: {
    width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.colors.surfaceLight, marginBottom: 12,
  },
  programCard: {
    backgroundColor: Colors.colors.backgroundCard, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: Colors.colors.border, marginBottom: 12,
  },
  programCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  programTitle: { flex: 1, fontFamily: 'Rubik_600SemiBold', fontSize: 15, color: Colors.colors.text },
  programDesc: { fontFamily: 'Rubik_400Regular', fontSize: 13, color: Colors.colors.textMuted, marginTop: 4 },
  programMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  programMetaText: { fontFamily: 'Rubik_500Medium', fontSize: 13, color: Colors.colors.textSecondary },
  progressBar: {
    flex: 1, height: 4, borderRadius: 2, backgroundColor: Colors.colors.surfaceLight, overflow: 'hidden' as const,
  },
  progressFill: { height: '100%' as const, borderRadius: 2, backgroundColor: Colors.colors.primary },
  emptyCard: {
    alignItems: 'center', backgroundColor: Colors.colors.backgroundCard, borderRadius: 12,
    padding: 32, borderWidth: 1, borderColor: Colors.colors.border, gap: 8, marginBottom: 12,
  },
  emptyText: { fontFamily: 'Rubik_500Medium', fontSize: 15, color: Colors.colors.textSecondary, textAlign: 'center' },
  emptySubText: { fontFamily: 'Rubik_400Regular', fontSize: 13, color: Colors.colors.textMuted, textAlign: 'center' },
  emptyBtn: {
    backgroundColor: Colors.colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12,
  },
  emptyBtnText: { fontFamily: 'Rubik_600SemiBold', fontSize: 13, color: '#fff' },
  seeAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 12, marginTop: 4,
  },
  seeAllText: { fontFamily: 'Rubik_500Medium', fontSize: 13, color: Colors.colors.primary },
});
