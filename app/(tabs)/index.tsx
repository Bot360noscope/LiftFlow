import { StyleSheet, Text, View, ScrollView, Pressable, Platform, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState } from "react";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import Colors from "@/constants/colors";
import { getPRs, getPrograms, getBestPR, type LiftPR, type Program } from "@/lib/storage";
import { useFocusEffect } from "expo-router";

function PRCard({ label, weight, unit, color, icon, delay }: { label: string; weight: number | null; unit: string; color: string; icon: string; delay: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(400)} style={[styles.prCard, { borderLeftColor: color, borderLeftWidth: 3 }]}>
      <View style={styles.prCardHeader}>
        <Ionicons name={icon as any} size={16} color={color} />
        <Text style={styles.prCardLabel}>{label}</Text>
      </View>
      {weight !== null ? (
        <Text style={styles.prCardValue}>{weight}<Text style={styles.prCardUnit}> {unit}</Text></Text>
      ) : (
        <Text style={styles.prCardEmpty}>No PR yet</Text>
      )}
    </Animated.View>
  );
}

function ProgramPreview({ program, index }: { program: Program; index: number }) {
  const totalExercises = program.weeks.reduce((total, week) =>
    total + week.days.reduce((dayTotal, day) => dayTotal + day.exercises.length, 0), 0);
  const completedExercises = program.weeks.reduce((total, week) =>
    total + week.days.reduce((dayTotal, day) => dayTotal + day.exercises.filter(e => e.isCompleted).length, 0), 0);
  const progress = totalExercises > 0 ? completedExercises / totalExercises : 0;

  return (
    <Animated.View entering={FadeInDown.delay(200 + index * 100).duration(400)}>
      <Pressable
        style={({ pressed }) => [styles.programCard, pressed && styles.programCardPressed]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push({ pathname: "/program/[id]", params: { id: program.id } });
        }}
      >
        <View style={styles.programCardContent}>
          <View style={styles.programCardLeft}>
            <Text style={styles.programTitle}>{program.title}</Text>
            <Text style={styles.programMeta}>{program.weeks.length} weeks  {program.daysPerWeek} days/week</Text>
          </View>
          <View style={styles.programCardRight}>
            <View style={styles.progressCircleContainer}>
              <View style={styles.progressCircleBg}>
                <Text style={styles.progressPercent}>{Math.round(progress * 100)}%</Text>
              </View>
            </View>
          </View>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [prs, setPRs] = useState<LiftPR[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const [prData, programData] = await Promise.all([getPRs(), getPrograms()]);
    setPRs(prData);
    setPrograms(programData);
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const bestSquat = getBestPR(prs, 'squat');
  const bestDeadlift = getBestPR(prs, 'deadlift');
  const bestBench = getBestPR(prs, 'bench');
  const unit = prs.length > 0 ? prs[0].unit : 'kg';

  const totalLifts = prs.length;
  const activePrograms = programs.length;

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.colors.primary} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back</Text>
            <Text style={styles.appName}>LiftFlow</Text>
          </View>
          <View style={styles.headerStats}>
            <View style={styles.headerStatItem}>
              <Text style={styles.headerStatValue}>{totalLifts}</Text>
              <Text style={styles.headerStatLabel}>PRs</Text>
            </View>
            <View style={styles.headerStatDivider} />
            <View style={styles.headerStatItem}>
              <Text style={styles.headerStatValue}>{activePrograms}</Text>
              <Text style={styles.headerStatLabel}>Programs</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Personal Records</Text>
        <View style={styles.prRow}>
          <PRCard label="Squat" weight={bestSquat?.weight ?? null} unit={unit} color={Colors.colors.squat} icon="fitness" delay={0} />
          <PRCard label="Deadlift" weight={bestDeadlift?.weight ?? null} unit={unit} color={Colors.colors.deadlift} icon="barbell" delay={100} />
          <PRCard label="Bench" weight={bestBench?.weight ?? null} unit={unit} color={Colors.colors.bench} icon="body" delay={200} />
        </View>

        <View style={styles.quickActions}>
          <Pressable
            style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/add-pr");
            }}
          >
            <Ionicons name="add-circle" size={20} color={Colors.colors.primary} />
            <Text style={styles.actionButtonText}>Log PR</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/create-program");
            }}
          >
            <Ionicons name="add-circle" size={20} color={Colors.colors.accent} />
            <Text style={styles.actionButtonText}>New Program</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Active Programs</Text>
        {programs.length === 0 ? (
          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.emptyState}>
            <Ionicons name="barbell-outline" size={40} color={Colors.colors.textMuted} />
            <Text style={styles.emptyTitle}>No programs yet</Text>
            <Text style={styles.emptyText}>Create a new program to start tracking your workouts</Text>
          </Animated.View>
        ) : (
          programs.map((program, idx) => (
            <ProgramPreview key={program.id} program={program} index={idx} />
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
  scrollContent: {
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: 16,
    paddingBottom: 24,
  },
  greeting: {
    fontFamily: 'Rubik_400Regular',
    fontSize: 14,
    color: Colors.colors.textSecondary,
  },
  appName: {
    fontFamily: 'Rubik_700Bold',
    fontSize: 28,
    color: Colors.colors.text,
    marginTop: 2,
  },
  headerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.colors.backgroundCard,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerStatItem: {
    alignItems: 'center',
  },
  headerStatValue: {
    fontFamily: 'Rubik_700Bold',
    fontSize: 18,
    color: Colors.colors.text,
  },
  headerStatLabel: {
    fontFamily: 'Rubik_400Regular',
    fontSize: 10,
    color: Colors.colors.textMuted,
    marginTop: 1,
  },
  headerStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.colors.border,
    marginHorizontal: 14,
  },
  sectionTitle: {
    fontFamily: 'Rubik_600SemiBold',
    fontSize: 18,
    color: Colors.colors.text,
    marginBottom: 12,
  },
  prRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  prCard: {
    flex: 1,
    backgroundColor: Colors.colors.backgroundCard,
    borderRadius: 12,
    padding: 14,
  },
  prCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  prCardLabel: {
    fontFamily: 'Rubik_500Medium',
    fontSize: 12,
    color: Colors.colors.textSecondary,
  },
  prCardValue: {
    fontFamily: 'Rubik_700Bold',
    fontSize: 22,
    color: Colors.colors.text,
  },
  prCardUnit: {
    fontFamily: 'Rubik_400Regular',
    fontSize: 13,
    color: Colors.colors.textMuted,
  },
  prCardEmpty: {
    fontFamily: 'Rubik_400Regular',
    fontSize: 13,
    color: Colors.colors.textMuted,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.colors.backgroundCard,
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.colors.border,
  },
  actionButtonPressed: {
    backgroundColor: Colors.colors.backgroundCardHover,
    transform: [{ scale: 0.98 }],
  },
  actionButtonText: {
    fontFamily: 'Rubik_600SemiBold',
    fontSize: 14,
    color: Colors.colors.text,
  },
  programCard: {
    backgroundColor: Colors.colors.backgroundCard,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.colors.border,
  },
  programCardPressed: {
    backgroundColor: Colors.colors.backgroundCardHover,
    transform: [{ scale: 0.98 }],
  },
  programCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  programCardLeft: {
    flex: 1,
  },
  programCardRight: {
    marginLeft: 12,
  },
  programTitle: {
    fontFamily: 'Rubik_600SemiBold',
    fontSize: 16,
    color: Colors.colors.text,
    marginBottom: 4,
  },
  programMeta: {
    fontFamily: 'Rubik_400Regular',
    fontSize: 13,
    color: Colors.colors.textSecondary,
  },
  progressCircleContainer: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCircleBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.colors.primary,
  },
  progressPercent: {
    fontFamily: 'Rubik_700Bold',
    fontSize: 13,
    color: Colors.colors.primary,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: Colors.colors.surfaceLight,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.colors.primary,
    borderRadius: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: 'Rubik_600SemiBold',
    fontSize: 16,
    color: Colors.colors.textSecondary,
  },
  emptyText: {
    fontFamily: 'Rubik_400Regular',
    fontSize: 13,
    color: Colors.colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
