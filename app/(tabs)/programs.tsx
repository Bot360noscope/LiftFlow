import { StyleSheet, Text, View, ScrollView, Pressable, Platform, Alert, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import Colors from "@/constants/colors";
import { getPrograms, deleteProgram, type Program } from "@/lib/storage";

function ProgramCard({ program, index, onDelete }: { program: Program; index: number; onDelete: () => void }) {
  const totalExercises = program.weeks.reduce((total, week) =>
    total + week.days.reduce((dayTotal, day) => dayTotal + day.exercises.length, 0), 0);
  const completedExercises = program.weeks.reduce((total, week) =>
    total + week.days.reduce((dayTotal, day) => dayTotal + day.exercises.filter(e => e.isCompleted).length, 0), 0);
  const progress = totalExercises > 0 ? completedExercises / totalExercises : 0;

  const currentWeek = program.weeks.findIndex(week =>
    week.days.some(day => day.exercises.some(e => !e.isCompleted))
  );

  return (
    <Animated.View entering={FadeInDown.delay(index * 80).duration(400)}>
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push({ pathname: "/program/[id]", params: { id: program.id } });
        }}
        onLongPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          Alert.alert("Delete Program", `Delete "${program.title}"?`, [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: onDelete },
          ]);
        }}
      >
        <View style={styles.cardTop}>
          <View style={styles.cardIconContainer}>
            <Ionicons name="barbell" size={22} color={Colors.colors.primary} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle}>{program.title}</Text>
            <Text style={styles.cardDescription}>{program.description}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.colors.textMuted} />
        </View>

        <View style={styles.cardStats}>
          <View style={styles.statItem}>
            <Ionicons name="calendar-outline" size={14} color={Colors.colors.textSecondary} />
            <Text style={styles.statText}>{program.weeks.length} weeks</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="repeat-outline" size={14} color={Colors.colors.textSecondary} />
            <Text style={styles.statText}>{program.daysPerWeek} days/wk</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="checkmark-circle-outline" size={14} color={Colors.colors.success} />
            <Text style={styles.statText}>{completedExercises}/{totalExercises}</Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {currentWeek >= 0 ? `Week ${currentWeek + 1}` : 'Completed'} - {Math.round(progress * 100)}%
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function ProgramsScreen() {
  const insets = useSafeAreaInsets();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const data = await getPrograms();
    setPrograms(data);
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteProgram(id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    loadData();
  }, [loadData]);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Programs</Text>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push("/create-program");
          }}
          hitSlop={8}
        >
          <Ionicons name="add-circle" size={28} color={Colors.colors.primary} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.colors.primary} />}
      >
        {programs.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="clipboard-outline" size={48} color={Colors.colors.textMuted} />
            <Text style={styles.emptyTitle}>No programs yet</Text>
            <Text style={styles.emptyText}>Create your first workout program to start tracking</Text>
            <Pressable
              style={({ pressed }) => [styles.createButton, pressed && { opacity: 0.8 }]}
              onPress={() => router.push("/create-program")}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.createButtonText}>Create Program</Text>
            </Pressable>
          </View>
        ) : (
          programs.map((program, idx) => (
            <ProgramCard
              key={program.id}
              program={program}
              index={idx}
              onDelete={() => handleDelete(program.id)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontFamily: 'Rubik_700Bold',
    fontSize: 28,
    color: Colors.colors.text,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: Colors.colors.backgroundCard,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.colors.border,
  },
  cardPressed: {
    backgroundColor: Colors.colors.backgroundCardHover,
    transform: [{ scale: 0.98 }],
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(232, 81, 47, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: 'Rubik_600SemiBold',
    fontSize: 17,
    color: Colors.colors.text,
    marginBottom: 2,
  },
  cardDescription: {
    fontFamily: 'Rubik_400Regular',
    fontSize: 13,
    color: Colors.colors.textSecondary,
  },
  cardStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 14,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontFamily: 'Rubik_400Regular',
    fontSize: 12,
    color: Colors.colors.textSecondary,
  },
  progressContainer: {
    gap: 6,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: Colors.colors.surfaceLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.colors.primary,
    borderRadius: 3,
  },
  progressText: {
    fontFamily: 'Rubik_500Medium',
    fontSize: 11,
    color: Colors.colors.textMuted,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 10,
  },
  emptyTitle: {
    fontFamily: 'Rubik_600SemiBold',
    fontSize: 18,
    color: Colors.colors.textSecondary,
    marginTop: 4,
  },
  emptyText: {
    fontFamily: 'Rubik_400Regular',
    fontSize: 14,
    color: Colors.colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 10,
  },
  createButtonText: {
    fontFamily: 'Rubik_600SemiBold',
    fontSize: 14,
    color: '#fff',
  },
});
