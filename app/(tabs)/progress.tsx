import { StyleSheet, Text, View, ScrollView, Pressable, Platform, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState, useMemo } from "react";
import { router, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import Colors from "@/constants/colors";
import { getPRs, deletePR, getProfile, getBestPR, type LiftPR } from "@/lib/storage";

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

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const [prs, setPRs] = useState<LiftPR[]>([]);
  const [unit, setUnit] = useState<'kg' | 'lbs'>('kg');

  const loadData = useCallback(async () => {
    const [prData, profile] = await Promise.all([getPRs(), getProfile()]);
    setPRs(prData);
    setUnit(profile.weightUnit);
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
    Alert.alert("Delete PR", `Remove ${LIFT_LABELS[pr.liftType]} ${pr.weight}${pr.unit}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          await deletePR(pr.id);
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
        <Text style={styles.pageTitle}>Progress</Text>
        <Pressable
          style={styles.addBtn}
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
  pageTitle: { fontFamily: 'Rubik_700Bold', fontSize: 28, color: Colors.colors.text },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
  },
  addBtnText: { fontFamily: 'Rubik_600SemiBold', fontSize: 13, color: '#fff' },
  totalCard: {
    alignItems: 'center', backgroundColor: Colors.colors.backgroundCard, borderRadius: 16,
    padding: 24, borderWidth: 1, borderColor: Colors.colors.border, marginBottom: 16,
  },
  totalLabel: { fontFamily: 'Rubik_500Medium', fontSize: 12, color: Colors.colors.textMuted },
  totalValue: { fontFamily: 'Rubik_700Bold', fontSize: 40, color: Colors.colors.text, marginTop: 4 },
  totalUnit: { fontFamily: 'Rubik_400Regular', fontSize: 16, color: Colors.colors.textSecondary },
  totalBreakdown: { flexDirection: 'row', gap: 16, marginTop: 12 },
  breakdownItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  breakdownDot: { width: 8, height: 8, borderRadius: 4 },
  breakdownText: { fontFamily: 'Rubik_500Medium', fontSize: 12, color: Colors.colors.textSecondary },
  bestLiftsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  bestLiftCard: {
    flex: 1, alignItems: 'center', backgroundColor: Colors.colors.backgroundCard,
    borderRadius: 12, paddingVertical: 14, borderLeftWidth: 3,
  },
  bestLiftLabel: { fontFamily: 'Rubik_600SemiBold', fontSize: 11 },
  bestLiftValue: { fontFamily: 'Rubik_700Bold', fontSize: 24, color: Colors.colors.text, marginTop: 4 },
  bestLiftUnit: { fontFamily: 'Rubik_400Regular', fontSize: 11, color: Colors.colors.textMuted },
  sectionTitle: { fontFamily: 'Rubik_700Bold', fontSize: 18, color: Colors.colors.text, marginBottom: 12 },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontFamily: 'Rubik_600SemiBold', fontSize: 15, color: Colors.colors.text },
  emptyDesc: { fontFamily: 'Rubik_400Regular', fontSize: 12, color: Colors.colors.textMuted },
  prRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.colors.backgroundCard, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.colors.border, marginBottom: 8,
  },
  prDot: { width: 10, height: 10, borderRadius: 5 },
  prInfo: { flex: 1 },
  prLiftName: { fontFamily: 'Rubik_600SemiBold', fontSize: 14, color: Colors.colors.text },
  prDate: { fontFamily: 'Rubik_400Regular', fontSize: 11, color: Colors.colors.textMuted, marginTop: 1 },
  prNotes: { fontFamily: 'Rubik_400Regular', fontSize: 11, color: Colors.colors.textSecondary, marginTop: 2 },
  prWeight: { fontFamily: 'Rubik_700Bold', fontSize: 18, color: Colors.colors.text },
  prUnit: { fontFamily: 'Rubik_400Regular', fontSize: 12, color: Colors.colors.textMuted },
});
