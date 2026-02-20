import { StyleSheet, Text, View, ScrollView, Pressable, Platform, Alert, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState, useMemo } from "react";
import { router, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import Colors from "@/constants/colors";
import { getPRs, deletePR, getBestPR, type LiftPR } from "@/lib/storage";

type LiftType = 'squat' | 'deadlift' | 'bench';
const LIFT_COLORS: Record<LiftType, string> = {
  squat: Colors.colors.squat,
  deadlift: Colors.colors.deadlift,
  bench: Colors.colors.bench,
};
const LIFT_LABELS: Record<LiftType, string> = {
  squat: 'Squat',
  deadlift: 'Deadlift',
  bench: 'Bench',
};

function MiniChart({ data, color, maxWeight }: { data: LiftPR[]; color: string; maxWeight: number }) {
  if (data.length < 2) return null;
  const sorted = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const points = sorted.map((pr, i) => ({
    x: (i / (sorted.length - 1)) * 100,
    y: 100 - (pr.weight / (maxWeight * 1.1)) * 100,
  }));

  return (
    <View style={styles.chartContainer}>
      {points.map((point, i) => (
        <View
          key={i}
          style={[
            styles.chartDot,
            {
              left: `${point.x}%`,
              top: `${point.y}%`,
              backgroundColor: color,
            },
          ]}
        />
      ))}
      {points.length > 1 && points.map((point, i) => {
        if (i === 0) return null;
        const prev = points[i - 1];
        const dx = point.x - prev.x;
        const dy = point.y - prev.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        return (
          <View
            key={`line-${i}`}
            style={[
              styles.chartLine,
              {
                left: `${prev.x}%`,
                top: `${prev.y}%`,
                width: `${length}%`,
                transform: [{ rotate: `${angle}deg` }],
                backgroundColor: color,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

function PRBestCard({ liftType, bestPR, totalEntries, allPRs, delay }: { liftType: LiftType; bestPR: LiftPR | null; totalEntries: number; allPRs: LiftPR[]; delay: number }) {
  const color = LIFT_COLORS[liftType];
  const liftData = allPRs.filter(p => p.liftType === liftType);
  const maxWeight = liftData.length > 0 ? Math.max(...liftData.map(p => p.weight)) : 0;

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(400)} style={[styles.bestCard, { borderTopColor: color, borderTopWidth: 3 }]}>
      <View style={styles.bestCardHeader}>
        <Text style={[styles.bestCardLift, { color }]}>{LIFT_LABELS[liftType]}</Text>
        <Text style={styles.bestCardEntries}>{totalEntries} entries</Text>
      </View>
      {bestPR ? (
        <>
          <Text style={styles.bestCardWeight}>{bestPR.weight}<Text style={styles.bestCardUnit}> {bestPR.unit}</Text></Text>
          <MiniChart data={liftData} color={color} maxWeight={maxWeight} />
        </>
      ) : (
        <Text style={styles.bestCardEmpty}>No data</Text>
      )}
    </Animated.View>
  );
}

function PRListItem({ pr, onDelete }: { pr: LiftPR; onDelete: () => void }) {
  const color = LIFT_COLORS[pr.liftType];
  return (
    <Pressable
      style={({ pressed }) => [styles.listItem, pressed && { opacity: 0.7 }]}
      onLongPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        Alert.alert("Delete PR", `Delete this ${LIFT_LABELS[pr.liftType]} PR?`, [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: onDelete },
        ]);
      }}
    >
      <View style={[styles.listItemDot, { backgroundColor: color }]} />
      <View style={styles.listItemInfo}>
        <Text style={styles.listItemLift}>{LIFT_LABELS[pr.liftType]}</Text>
        <Text style={styles.listItemDate}>{new Date(pr.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
      </View>
      <Text style={styles.listItemWeight}>{pr.weight} <Text style={styles.listItemUnit}>{pr.unit}</Text></Text>
    </Pressable>
  );
}

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const [prs, setPRs] = useState<LiftPR[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<LiftType | 'all'>('all');

  const loadData = useCallback(async () => {
    const data = await getPRs();
    setPRs(data);
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleDelete = useCallback(async (id: string) => {
    await deletePR(id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    loadData();
  }, [loadData]);

  const filteredPRs = useMemo(() => {
    const filtered = filter === 'all' ? prs : prs.filter(p => p.liftType === filter);
    return [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [prs, filter]);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Progress</Text>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push("/add-pr");
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
        <View style={styles.bestCards}>
          <PRBestCard liftType="squat" bestPR={getBestPR(prs, 'squat')} totalEntries={prs.filter(p => p.liftType === 'squat').length} allPRs={prs} delay={0} />
          <PRBestCard liftType="deadlift" bestPR={getBestPR(prs, 'deadlift')} totalEntries={prs.filter(p => p.liftType === 'deadlift').length} allPRs={prs} delay={80} />
          <PRBestCard liftType="bench" bestPR={getBestPR(prs, 'bench')} totalEntries={prs.filter(p => p.liftType === 'bench').length} allPRs={prs} delay={160} />
        </View>

        <View style={styles.filterRow}>
          {(['all', 'squat', 'deadlift', 'bench'] as const).map(f => (
            <Pressable
              key={f}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setFilter(f);
              }}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f === 'all' ? 'All' : LIFT_LABELS[f]}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>History</Text>
        {filteredPRs.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="analytics-outline" size={40} color={Colors.colors.textMuted} />
            <Text style={styles.emptyTitle}>No PRs recorded</Text>
            <Text style={styles.emptyText}>Start logging your personal records</Text>
          </View>
        ) : (
          filteredPRs.map(pr => (
            <PRListItem key={pr.id} pr={pr} onDelete={() => handleDelete(pr.id)} />
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
  bestCards: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  bestCard: {
    flex: 1,
    backgroundColor: Colors.colors.backgroundCard,
    borderRadius: 14,
    padding: 14,
  },
  bestCardHeader: {
    marginBottom: 8,
  },
  bestCardLift: {
    fontFamily: 'Rubik_600SemiBold',
    fontSize: 13,
  },
  bestCardEntries: {
    fontFamily: 'Rubik_400Regular',
    fontSize: 10,
    color: Colors.colors.textMuted,
    marginTop: 1,
  },
  bestCardWeight: {
    fontFamily: 'Rubik_700Bold',
    fontSize: 20,
    color: Colors.colors.text,
  },
  bestCardUnit: {
    fontFamily: 'Rubik_400Regular',
    fontSize: 12,
    color: Colors.colors.textMuted,
  },
  bestCardEmpty: {
    fontFamily: 'Rubik_400Regular',
    fontSize: 12,
    color: Colors.colors.textMuted,
  },
  chartContainer: {
    height: 40,
    marginTop: 8,
    position: 'relative',
  },
  chartDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: -3,
    marginTop: -3,
  },
  chartLine: {
    position: 'absolute',
    height: 2,
    opacity: 0.5,
    transformOrigin: 'left center',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.colors.primary,
    borderColor: Colors.colors.primary,
  },
  filterText: {
    fontFamily: 'Rubik_500Medium',
    fontSize: 13,
    color: Colors.colors.textSecondary,
  },
  filterTextActive: {
    color: '#fff',
  },
  sectionTitle: {
    fontFamily: 'Rubik_600SemiBold',
    fontSize: 18,
    color: Colors.colors.text,
    marginBottom: 12,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.colors.backgroundCard,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  listItemDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  listItemInfo: {
    flex: 1,
  },
  listItemLift: {
    fontFamily: 'Rubik_500Medium',
    fontSize: 15,
    color: Colors.colors.text,
  },
  listItemDate: {
    fontFamily: 'Rubik_400Regular',
    fontSize: 12,
    color: Colors.colors.textMuted,
    marginTop: 1,
  },
  listItemWeight: {
    fontFamily: 'Rubik_700Bold',
    fontSize: 18,
    color: Colors.colors.text,
  },
  listItemUnit: {
    fontFamily: 'Rubik_400Regular',
    fontSize: 13,
    color: Colors.colors.textMuted,
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
  },
});
