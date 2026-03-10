import { StyleSheet, Text, View, ScrollView, Pressable, Platform, Image, Modal, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState, useCallback, useEffect, useRef } from "react";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import Colors from "@/constants/colors";
import { useTheme } from "@/lib/theme-context";
import {
  getPrograms, getClients, removeClient, invalidateProgramsCache,
  getNotifications,
  type Program, type ClientInfo,
} from "@/lib/storage";
import { getAvatarUrl } from "@/lib/api";
import { showAlert } from "@/lib/confirm";
import { addWSListener } from "@/lib/websocket";

function ProgramCard({ program }: { program: Program }) {
  const { colors } = useTheme();
  let totalExercises = 0;
  let completedExercises = 0;
  for (const week of program.weeks) {
    for (const day of week.days) {
      for (const ex of day.exercises) {
        if (ex.name) totalExercises++;
        if (ex.isCompleted) completedExercises++;
      }
    }
  }
  const progress = totalExercises > 0 ? Math.round((completedExercises / totalExercises) * 100) : 0;
  const dateStr = new Date(program.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <Pressable
      style={({ pressed }) => [styles.programCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }, pressed && { opacity: 0.85 }]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(`/program/${program.id}`);
      }}
    >
      <View style={styles.programCardTop}>
        <View style={[styles.statusDot, { backgroundColor: program.status === 'active' ? colors.success : colors.warning }]} />
        <Text style={[styles.programTitle, { color: colors.text }]} numberOfLines={1}>{program.title}</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </View>
      <Text style={[styles.programDesc, { color: colors.textMuted }]} numberOfLines={1}>{program.description}</Text>
      <View style={styles.programMeta}>
        <Text style={[styles.programMetaText, { color: colors.textSecondary }]}>{program.weeks.length}W / {program.daysPerWeek}D</Text>
        <Text style={[styles.programMetaDot, { color: colors.textMuted }]}>{'\u00B7'}</Text>
        <Text style={[styles.programMetaText, { color: colors.textSecondary }]}>{dateStr}</Text>
        <View style={styles.progressBarWrap}>
          <View style={[styles.progressBar, { backgroundColor: colors.surfaceLight }]}>
            <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: colors.primary }]} />
          </View>
          <Text style={[styles.progressText, { color: colors.textSecondary }]}>{progress}%</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function ClientDetailScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { id, name: clientName } = useLocalSearchParams<{ id: string; name?: string }>();
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [removeInput, setRemoveInput] = useState('');
  const [removing, setRemoving] = useState(false);
  const [hasUnreadChat, setHasUnreadChat] = useState(false);
  const clientProfileIdRef = useRef('');

  const checkUnread = useCallback(async (cpId: string) => {
    try {
      const notifs = await getNotifications();
      const hasUnread = notifs.some(n => n.type === 'chat' && !n.read && n.fromRole === 'client' && n.programTitle === cpId);
      setHasUnreadChat(hasUnread);
    } catch {}
  }, []);

  const loadData = useCallback(async () => {
    invalidateProgramsCache();
    const [allPrograms, allClients] = await Promise.all([getPrograms(), getClients()]);
    const found = allClients.find(c => c.id === id);
    if (found) {
      setClient(found);
      clientProfileIdRef.current = found.clientProfileId;
      checkUnread(found.clientProfileId);
    }
    const clientProgs = allPrograms
      .filter(p => p.clientId === id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setPrograms(clientProgs);
  }, [id, checkUnread]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  useEffect(() => {
    const removeListener = addWSListener((event: any) => {
      if (event.type === 'new_message' && event.message) {
        const m = event.message;
        if (m.clientProfileId === clientProfileIdRef.current && m.senderRole === 'client') {
          setHasUnreadChat(true);
        }
      }
    });
    return removeListener;
  }, []);

  const handleRemoveClient = async () => {
    if (removeInput !== 'REMOVE') return;
    setRemoving(true);
    try {
      await removeClient(id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowRemoveModal(false);
      showAlert("Client Removed", `${displayName} has been removed from your clients.`);
      router.back();
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to remove client');
    }
    setRemoving(false);
  };

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const displayName = client?.name || clientName || 'Client';
  const joinedStr = client ? new Date(client.joinedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : '';

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset, backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>{displayName}</Text>
        <Pressable
          hitSlop={8}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setHasUnreadChat(false);
            router.push({ pathname: '/conversation', params: { clientId: id, clientName: displayName, clientProfileId: client?.clientProfileId || '' } });
          }}
        >
          <View>
            <Ionicons name="chatbubbles-outline" size={22} color={colors.primary} />
            {hasUnreadChat && <View style={styles.unreadDot} />}
          </View>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
      >
        <Animated.View entering={FadeInDown.duration(350)}>
          <View style={styles.clientHeader}>
            {client?.avatarUrl ? (
              <Image source={{ uri: getAvatarUrl(client.avatarUrl) }} style={[styles.avatarImage, { borderColor: colors.primary }]} />
            ) : (
              <View style={[styles.avatar, { borderColor: colors.primary }]}>
                <Text style={[styles.avatarText, { color: colors.primary }]}>{displayName[0].toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.clientHeaderInfo}>
              <Text style={[styles.clientName, { color: colors.text }]}>{displayName}</Text>
              {joinedStr ? <Text style={[styles.clientJoined, { color: colors.textSecondary }]}>Joined {joinedStr}</Text> : null}
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(350)}>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
              <Text style={[styles.statValue, { color: colors.text }]}>{programs.length}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Programs</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
              <Text style={[styles.statValue, { color: colors.text }]}>{programs.filter(p => p.status === 'active').length}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Active</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {(() => {
                  let t = 0, c = 0;
                  for (const p of programs) for (const w of p.weeks) for (const d of w.days) for (const e of d.exercises) { if (e.name) t++; if (e.isCompleted) c++; }
                  return t > 0 ? Math.round((c / t) * 100) + '%' : '0%';
                })()}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Overall</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(350)}>
          <Pressable
            style={({ pressed }) => [styles.newProgramBtn, { backgroundColor: colors.backgroundCard, borderColor: colors.primary }, pressed && { opacity: 0.85 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push({ pathname: '/create-program', params: { clientId: id, clientName: displayName } });
            }}
          >
            <View style={[styles.newProgramIcon, { backgroundColor: colors.primary }]}>
              <Ionicons name="add" size={20} color="#fff" />
            </View>
            <View style={styles.newProgramInfo}>
              <Text style={[styles.newProgramTitle, { color: colors.text }]}>New Program</Text>
              <Text style={[styles.newProgramDesc, { color: colors.textSecondary }]}>Create a new training program for {displayName}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(350)}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Programs</Text>
          {programs.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
              <Ionicons name="barbell-outline" size={32} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No programs yet</Text>
              <Text style={[styles.emptySubText, { color: colors.textMuted }]}>Create a program for this client to get started</Text>
            </View>
          ) : (
            programs.map((prog, idx) => (
              <Animated.View key={prog.id} entering={FadeInDown.delay(250 + idx * 60).duration(300)}>
                <ProgramCard program={prog} />
              </Animated.View>
            ))
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(350)}>
          <Pressable
            style={({ pressed }) => [styles.removeClientBtn, pressed && { opacity: 0.85 }]}
            onPress={() => { setRemoveInput(''); setShowRemoveModal(true); }}
            accessibilityLabel="Remove client"
            accessibilityRole="button"
          >
            <Ionicons name="person-remove" size={18} color={colors.danger} />
            <Text style={[styles.removeClientText, { color: colors.danger }]}>Remove Client</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>

      <Modal visible={showRemoveModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
            <Ionicons name="person-remove" size={40} color={colors.danger} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>Remove Client</Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              This will remove {displayName} from your clients. Chat messages will be deleted and program assignments will be unlinked. This action cannot be undone.
            </Text>
            <Text style={[styles.modalPrompt, { color: colors.text }]}>Type REMOVE to confirm:</Text>
            <TextInput
              style={[styles.modalInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
              value={removeInput}
              onChangeText={setRemoveInput}
              placeholder="Type REMOVE"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              accessibilityLabel="Type REMOVE to confirm client removal"
            />
            <View style={styles.modalButtons}>
              <Pressable style={[styles.modalCancelBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setShowRemoveModal(false)} accessibilityLabel="Cancel" accessibilityRole="button">
                <Text style={[styles.modalCancelText, { color: colors.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalDeleteBtn, { backgroundColor: colors.danger }, removeInput !== 'REMOVE' && styles.modalDeleteBtnDisabled]}
                onPress={handleRemoveClient}
                disabled={removeInput !== 'REMOVE' || removing}
                accessibilityLabel="Remove client permanently"
                accessibilityRole="button"
              >
                <Text style={styles.modalDeleteText}>{removing ? 'Removing...' : 'Remove Client'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12,
  },
  headerTitle: { flex: 1, fontFamily: 'Rubik_700Bold', fontSize: 20, color: Colors.colors.text },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8 },
  clientHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
  avatar: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(232,81,47,0.15)',
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.colors.primary,
  },
  avatarImage: {
    width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: Colors.colors.primary,
  },
  avatarText: { fontFamily: 'Rubik_700Bold', fontSize: 22, color: Colors.colors.primary },
  clientHeaderInfo: { flex: 1 },
  clientName: { fontFamily: 'Rubik_700Bold', fontSize: 20, color: Colors.colors.text },
  clientJoined: { fontFamily: 'Rubik_400Regular', fontSize: 12, color: Colors.colors.textSecondary, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1, alignItems: 'center', backgroundColor: Colors.colors.backgroundCard,
    borderRadius: 14, paddingVertical: 14, borderWidth: 1, borderColor: Colors.colors.border,
  },
  statValue: { fontFamily: 'Rubik_700Bold', fontSize: 20, color: Colors.colors.text },
  statLabel: { fontFamily: 'Rubik_400Regular', fontSize: 11, color: Colors.colors.textMuted, marginTop: 2 },
  newProgramBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.colors.backgroundCard,
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.colors.primary, gap: 12, marginBottom: 24,
  },
  newProgramIcon: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  newProgramInfo: { flex: 1 },
  newProgramTitle: { fontFamily: 'Rubik_600SemiBold', fontSize: 15, color: Colors.colors.text },
  newProgramDesc: { fontFamily: 'Rubik_400Regular', fontSize: 11, color: Colors.colors.textSecondary, marginTop: 1 },
  sectionTitle: { fontFamily: 'Rubik_700Bold', fontSize: 18, color: Colors.colors.text, marginBottom: 12 },
  programCard: {
    backgroundColor: Colors.colors.backgroundCard, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.colors.border, marginBottom: 10,
  },
  programCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  programTitle: { flex: 1, fontFamily: 'Rubik_600SemiBold', fontSize: 15, color: Colors.colors.text },
  programDesc: { fontFamily: 'Rubik_400Regular', fontSize: 12, color: Colors.colors.textMuted, marginTop: 4 },
  programMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  programMetaText: { fontFamily: 'Rubik_500Medium', fontSize: 11, color: Colors.colors.textSecondary },
  programMetaDot: { color: Colors.colors.textMuted, fontSize: 10 },
  progressBarWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 4 },
  progressBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: Colors.colors.surfaceLight, overflow: 'hidden' as const },
  progressFill: { height: '100%' as const, borderRadius: 2, backgroundColor: Colors.colors.primary },
  progressText: { fontFamily: 'Rubik_500Medium', fontSize: 11, color: Colors.colors.textSecondary, width: 28, textAlign: 'right' },
  emptyCard: {
    alignItems: 'center', backgroundColor: Colors.colors.backgroundCard, borderRadius: 14,
    padding: 30, borderWidth: 1, borderColor: Colors.colors.border, gap: 6,
  },
  emptyText: { fontFamily: 'Rubik_600SemiBold', fontSize: 15, color: Colors.colors.textSecondary },
  emptySubText: { fontFamily: 'Rubik_400Regular', fontSize: 12, color: Colors.colors.textMuted, textAlign: 'center' },
  removeClientBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, marginTop: 24, marginBottom: 20, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255, 59, 48, 0.25)',
    backgroundColor: 'rgba(255, 59, 48, 0.06)',
  },
  removeClientText: { fontFamily: 'Rubik_600SemiBold', fontSize: 15, color: Colors.colors.danger },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: Colors.colors.backgroundCard, borderRadius: 20, padding: 28,
    alignItems: 'center', width: '100%', maxWidth: 360,
    borderWidth: 1, borderColor: Colors.colors.border,
  },
  modalTitle: { fontFamily: 'Rubik_700Bold', fontSize: 20, color: Colors.colors.text, marginTop: 12 },
  modalMessage: {
    fontFamily: 'Rubik_400Regular', fontSize: 14, color: Colors.colors.textSecondary,
    textAlign: 'center', marginTop: 8, lineHeight: 20,
  },
  modalPrompt: { fontFamily: 'Rubik_600SemiBold', fontSize: 14, color: Colors.colors.text, marginTop: 18, alignSelf: 'flex-start' },
  modalInput: {
    fontFamily: 'Rubik_600SemiBold', fontSize: 18, color: Colors.colors.text,
    backgroundColor: Colors.colors.surface, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
    textAlign: 'center', width: '100%', marginTop: 10, borderWidth: 1, borderColor: Colors.colors.border, letterSpacing: 2,
  },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 20, width: '100%' },
  modalCancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center',
    backgroundColor: Colors.colors.surface, borderWidth: 1, borderColor: Colors.colors.border,
  },
  modalCancelText: { fontFamily: 'Rubik_600SemiBold', fontSize: 15, color: Colors.colors.text },
  modalDeleteBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center',
    backgroundColor: Colors.colors.danger,
  },
  modalDeleteBtnDisabled: { opacity: 0.4 },
  modalDeleteText: { fontFamily: 'Rubik_600SemiBold', fontSize: 15, color: '#fff' },
  unreadDot: {
    position: 'absolute' as const, top: -3, right: -3,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: Colors.colors.danger,
    borderWidth: 1.5, borderColor: Colors.colors.background,
  },
});
