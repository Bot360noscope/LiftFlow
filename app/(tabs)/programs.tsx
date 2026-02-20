import { StyleSheet, Text, View, ScrollView, Pressable, Platform, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState, useCallback } from "react";
import { router, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import Colors from "@/constants/colors";
import { getPrograms, deleteProgram, getProfile, type Program } from "@/lib/storage";

export default function ProgramsScreen() {
  const insets = useSafeAreaInsets();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [role, setRole] = useState<string>('coach');

  const loadData = useCallback(async () => {
    const [progs, profile] = await Promise.all([getPrograms(), getProfile()]);
    setPrograms(progs);
    setRole(profile.role);
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleDelete = (id: string, title: string) => {
    Alert.alert("Delete Program", `Delete "${title}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          await deleteProgram(id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          loadData();
        },
      },
    ]);
  };

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const webBottomInset = Platform.OS === 'web' ? 84 : 0;

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
        <Text style={styles.pageTitle}>Programs</Text>
        <Pressable
          style={styles.newBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/create-program');
          }}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.newBtnText}>New</Text>
        </Pressable>
      </View>

      {programs.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="grid-outline" size={48} color={Colors.colors.textMuted} />
          <Text style={styles.emptyTitle}>No programs yet</Text>
          <Text style={styles.emptyDesc}>
            {role === 'coach'
              ? 'Create a program with the spreadsheet builder and share it with clients'
              : 'Ask your coach for a program share code to get started'}
          </Text>
          <Pressable style={styles.createBtn} onPress={() => router.push('/create-program')}>
            <Ionicons name="add-circle" size={18} color="#fff" />
            <Text style={styles.createBtnText}>Create Program</Text>
          </Pressable>
        </View>
      ) : (
        programs.map((prog, idx) => {
          const totalCells = Object.keys(prog.cells).length;
          const completedCells = Object.values(prog.cells).filter(c => c.isCompleted).length;
          const progress = totalCells > 0 ? Math.round((completedCells / totalCells) * 100) : 0;
          const hasComments = Object.values(prog.cells).some(c => c.coachComment);
          const hasVideos = Object.values(prog.cells).some(c => c.videoUrl);

          return (
            <Animated.View key={prog.id} entering={FadeInDown.delay(idx * 60).duration(300)}>
              <Pressable
                style={({ pressed }) => [styles.programCard, pressed && { opacity: 0.85 }]}
                onPress={() => router.push(`/program/${prog.id}`)}
                onLongPress={() => handleDelete(prog.id, prog.title)}
              >
                <View style={styles.cardTop}>
                  <View style={styles.cardTitleRow}>
                    <View style={[styles.statusDot, { backgroundColor: prog.status === 'active' ? Colors.colors.success : Colors.colors.warning }]} />
                    <Text style={styles.cardTitle} numberOfLines={1}>{prog.title}</Text>
                  </View>
                  <View style={styles.shareCodeBadge}>
                    <Ionicons name="share-outline" size={12} color={Colors.colors.textSecondary} />
                    <Text style={styles.shareCodeText}>{prog.shareCode}</Text>
                  </View>
                </View>

                <Text style={styles.cardDesc} numberOfLines={2}>{prog.description}</Text>

                <View style={styles.cardStats}>
                  <View style={styles.cardStat}>
                    <Ionicons name="calendar-outline" size={14} color={Colors.colors.textSecondary} />
                    <Text style={styles.cardStatText}>{prog.totalWeeks} weeks</Text>
                  </View>
                  <View style={styles.cardStat}>
                    <Ionicons name="today-outline" size={14} color={Colors.colors.textSecondary} />
                    <Text style={styles.cardStatText}>{prog.daysPerWeek} days/wk</Text>
                  </View>
                  <View style={styles.cardStat}>
                    <Ionicons name="list-outline" size={14} color={Colors.colors.textSecondary} />
                    <Text style={styles.cardStatText}>{prog.rowCount} exercises</Text>
                  </View>
                  {hasComments && (
                    <View style={styles.cardStat}>
                      <Ionicons name="chatbubble" size={12} color={Colors.colors.accent} />
                    </View>
                  )}
                  {hasVideos && (
                    <View style={styles.cardStat}>
                      <Ionicons name="videocam" size={12} color={Colors.colors.primary} />
                    </View>
                  )}
                </View>

                <View style={styles.progressRow}>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
                  </View>
                  <Text style={styles.progressText}>{progress}%</Text>
                </View>
              </Pressable>
            </Animated.View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.colors.background },
  scrollContent: { paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  pageTitle: { fontFamily: 'Rubik_700Bold', fontSize: 28, color: Colors.colors.text },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
  },
  newBtnText: { fontFamily: 'Rubik_600SemiBold', fontSize: 13, color: '#fff' },
  emptyState: { alignItems: 'center', paddingVertical: 50, gap: 12 },
  emptyTitle: { fontFamily: 'Rubik_700Bold', fontSize: 18, color: Colors.colors.text },
  emptyDesc: { fontFamily: 'Rubik_400Regular', fontSize: 13, color: Colors.colors.textMuted, textAlign: 'center', paddingHorizontal: 30 },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.colors.primary, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, marginTop: 8,
  },
  createBtnText: { fontFamily: 'Rubik_600SemiBold', fontSize: 13, color: '#fff' },
  programCard: {
    backgroundColor: Colors.colors.backgroundCard, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.colors.border, marginBottom: 12,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  cardTitle: { fontFamily: 'Rubik_700Bold', fontSize: 16, color: Colors.colors.text, flex: 1 },
  shareCodeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.colors.surfaceLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  shareCodeText: { fontFamily: 'Rubik_500Medium', fontSize: 10, color: Colors.colors.textSecondary, letterSpacing: 1 },
  cardDesc: { fontFamily: 'Rubik_400Regular', fontSize: 12, color: Colors.colors.textMuted, marginTop: 6 },
  cardStats: { flexDirection: 'row', gap: 12, marginTop: 12, flexWrap: 'wrap' },
  cardStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardStatText: { fontFamily: 'Rubik_400Regular', fontSize: 11, color: Colors.colors.textSecondary },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  progressBarBg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: Colors.colors.surfaceLight, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 2, backgroundColor: Colors.colors.primary },
  progressText: { fontFamily: 'Rubik_600SemiBold', fontSize: 11, color: Colors.colors.textSecondary, width: 32, textAlign: 'right' },
});
