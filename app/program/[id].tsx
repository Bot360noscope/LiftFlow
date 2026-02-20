import { StyleSheet, Text, View, ScrollView, Pressable, Platform, TextInput, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState, useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Crypto from "expo-crypto";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import Colors from "@/constants/colors";
import { getProgram, updateProgram, type Program, type Exercise } from "@/lib/storage";

function ExerciseRow({ exercise, onToggle, onUpdate, onDelete }: {
  exercise: Exercise;
  onToggle: () => void;
  onUpdate: (updates: Partial<Exercise>) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={[styles.exerciseRow, exercise.isCompleted && styles.exerciseCompleted]}>
      <View style={styles.exerciseMain}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onToggle();
          }}
          hitSlop={6}
        >
          <Ionicons
            name={exercise.isCompleted ? "checkmark-circle" : "ellipse-outline"}
            size={24}
            color={exercise.isCompleted ? Colors.colors.success : Colors.colors.textMuted}
          />
        </Pressable>

        <Pressable
          style={styles.exerciseInfo}
          onPress={() => setExpanded(!expanded)}
        >
          <TextInput
            style={[styles.exerciseName, exercise.isCompleted && styles.exerciseNameCompleted]}
            value={exercise.name}
            onChangeText={text => onUpdate({ name: text })}
            placeholder="Exercise name"
            placeholderTextColor={Colors.colors.textMuted}
          />
          <View style={styles.exerciseMeta}>
            {!!exercise.prescription && (
              <Text style={styles.exerciseTag}>{exercise.prescription}</Text>
            )}
            {!!exercise.weight && (
              <Text style={styles.exerciseTag}>{exercise.weight}</Text>
            )}
            {!!exercise.rpe && (
              <Text style={styles.exerciseTagRPE}>RPE {exercise.rpe}</Text>
            )}
          </View>
        </Pressable>

        <Pressable onPress={() => setExpanded(!expanded)} hitSlop={6}>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={Colors.colors.textMuted} />
        </Pressable>
      </View>

      {expanded && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.exerciseExpanded}>
          <View style={styles.exerciseFieldRow}>
            <View style={styles.exerciseField}>
              <Text style={styles.fieldLabel}>Sets x Reps</Text>
              <TextInput
                style={styles.fieldInput}
                value={exercise.prescription}
                onChangeText={text => onUpdate({ prescription: text })}
                placeholder="3x10"
                placeholderTextColor={Colors.colors.textMuted}
              />
            </View>
            <View style={styles.exerciseField}>
              <Text style={styles.fieldLabel}>Weight</Text>
              <TextInput
                style={styles.fieldInput}
                value={exercise.weight}
                onChangeText={text => onUpdate({ weight: text })}
                placeholder="60kg"
                placeholderTextColor={Colors.colors.textMuted}
              />
            </View>
            <View style={styles.exerciseField}>
              <Text style={styles.fieldLabel}>RPE</Text>
              <TextInput
                style={styles.fieldInput}
                value={exercise.rpe}
                onChangeText={text => onUpdate({ rpe: text })}
                placeholder="7"
                placeholderTextColor={Colors.colors.textMuted}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
          <View style={styles.notesRow}>
            <TextInput
              style={styles.notesField}
              value={exercise.notes}
              onChangeText={text => onUpdate({ notes: text })}
              placeholder="Notes..."
              placeholderTextColor={Colors.colors.textMuted}
              multiline
            />
          </View>
          <Pressable
            style={styles.deleteExerciseBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              onDelete();
            }}
          >
            <Ionicons name="trash-outline" size={16} color={Colors.colors.danger} />
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

export default function ProgramDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [program, setProgram] = useState<Program | null>(null);
  const [activeWeek, setActiveWeek] = useState(0);
  const [activeDay, setActiveDay] = useState(0);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (id) {
      getProgram(id).then(p => {
        if (p) {
          setProgram(p);
          const firstIncompleteWeek = p.weeks.findIndex(w =>
            w.days.some(d => d.exercises.some(e => !e.isCompleted))
          );
          if (firstIncompleteWeek >= 0) setActiveWeek(firstIncompleteWeek);
        }
      });
    }
  }, [id]);

  const save = useCallback(async () => {
    if (program) {
      await updateProgram(program);
      setHasChanges(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [program]);

  const toggleExercise = useCallback((weekIdx: number, dayIdx: number, exIdx: number) => {
    if (!program) return;
    const updated = { ...program };
    const ex = updated.weeks[weekIdx].days[dayIdx].exercises[exIdx];
    ex.isCompleted = !ex.isCompleted;
    setProgram({ ...updated });
    setHasChanges(true);
  }, [program]);

  const updateExercise = useCallback((weekIdx: number, dayIdx: number, exIdx: number, updates: Partial<Exercise>) => {
    if (!program) return;
    const updated = { ...program };
    Object.assign(updated.weeks[weekIdx].days[dayIdx].exercises[exIdx], updates);
    setProgram({ ...updated });
    setHasChanges(true);
  }, [program]);

  const deleteExercise = useCallback((weekIdx: number, dayIdx: number, exIdx: number) => {
    if (!program) return;
    const updated = { ...program };
    updated.weeks[weekIdx].days[dayIdx].exercises.splice(exIdx, 1);
    setProgram({ ...updated });
    setHasChanges(true);
  }, [program]);

  const addExercise = useCallback((weekIdx: number, dayIdx: number) => {
    if (!program) return;
    const updated = { ...program };
    updated.weeks[weekIdx].days[dayIdx].exercises.push({
      id: Crypto.randomUUID(),
      name: '',
      weight: '',
      prescription: '',
      rpe: '',
      isCompleted: false,
      notes: '',
    });
    setProgram({ ...updated });
    setHasChanges(true);
  }, [program]);

  if (!program) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const currentWeek = program.weeks[activeWeek];
  const currentDay = currentWeek?.days[activeDay];

  const totalExercises = currentDay?.exercises.length || 0;
  const completedExercises = currentDay?.exercises.filter(e => e.isCompleted).length || 0;

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            if (hasChanges) {
              Alert.alert("Unsaved Changes", "Save before leaving?", [
                { text: "Discard", style: "destructive", onPress: () => router.back() },
                { text: "Save", onPress: async () => { await save(); router.back(); } },
              ]);
            } else {
              router.back();
            }
          }}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{program.title}</Text>
          {completedExercises > 0 && (
            <Text style={styles.headerSub}>{completedExercises}/{totalExercises} done</Text>
          )}
        </View>
        <Pressable onPress={save} hitSlop={8}>
          <Ionicons
            name="checkmark-circle"
            size={26}
            color={hasChanges ? Colors.colors.primary : Colors.colors.textMuted}
          />
        </Pressable>
      </View>

      <View style={styles.weekSelector}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekScrollContent}>
          {program.weeks.map((week, idx) => {
            const weekComplete = week.days.every(d => d.exercises.every(e => e.isCompleted));
            return (
              <Pressable
                key={idx}
                style={[styles.weekChip, activeWeek === idx && styles.weekChipActive]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setActiveWeek(idx);
                  setActiveDay(0);
                }}
              >
                {weekComplete && <Ionicons name="checkmark-circle" size={12} color={Colors.colors.success} />}
                <Text style={[styles.weekChipText, activeWeek === idx && styles.weekChipTextActive]}>
                  W{week.weekNumber}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {currentWeek && currentWeek.days.length > 1 && (
        <View style={styles.daySelector}>
          {currentWeek.days.map((day, idx) => {
            const dayComplete = day.exercises.every(e => e.isCompleted);
            return (
              <Pressable
                key={idx}
                style={[styles.dayChip, activeDay === idx && styles.dayChipActive]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setActiveDay(idx);
                }}
              >
                <Text style={[styles.dayChipText, activeDay === idx && styles.dayChipTextActive]}>
                  Day {day.dayNumber}
                </Text>
                {dayComplete && <View style={styles.dayCompleteDot} />}
              </Pressable>
            );
          })}
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
      >
        {currentDay?.exercises.map((exercise, idx) => (
          <Animated.View key={exercise.id} entering={FadeInDown.delay(idx * 50).duration(300)}>
            <ExerciseRow
              exercise={exercise}
              onToggle={() => toggleExercise(activeWeek, activeDay, idx)}
              onUpdate={(updates) => updateExercise(activeWeek, activeDay, idx, updates)}
              onDelete={() => deleteExercise(activeWeek, activeDay, idx)}
            />
          </Animated.View>
        ))}

        <Pressable
          style={styles.addExerciseBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            addExercise(activeWeek, activeDay);
          }}
        >
          <Ionicons name="add" size={20} color={Colors.colors.primary} />
          <Text style={styles.addExerciseText}>Add Exercise</Text>
        </Pressable>
      </ScrollView>

      {hasChanges && (
        <Animated.View entering={FadeIn.duration(200)} style={[styles.saveBar, { paddingBottom: insets.bottom + 10 }]}>
          <View style={styles.saveBarDot} />
          <Text style={styles.saveBarText}>Unsaved changes</Text>
          <Pressable
            style={styles.saveBarButton}
            onPress={save}
          >
            <Text style={styles.saveBarButtonText}>Save</Text>
          </Pressable>
        </Animated.View>
      )}
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
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: 'Rubik_700Bold',
    fontSize: 20,
    color: Colors.colors.text,
  },
  headerSub: {
    fontFamily: 'Rubik_400Regular',
    fontSize: 12,
    color: Colors.colors.textSecondary,
    marginTop: 1,
  },
  loadingText: {
    fontFamily: 'Rubik_400Regular',
    fontSize: 16,
    color: Colors.colors.textMuted,
  },
  weekSelector: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.colors.border,
  },
  weekScrollContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  weekChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.colors.border,
  },
  weekChipActive: {
    backgroundColor: Colors.colors.primary,
    borderColor: Colors.colors.primary,
  },
  weekChipText: {
    fontFamily: 'Rubik_600SemiBold',
    fontSize: 13,
    color: Colors.colors.textSecondary,
  },
  weekChipTextActive: {
    color: '#fff',
  },
  daySelector: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 8,
  },
  dayChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.colors.border,
    gap: 4,
  },
  dayChipActive: {
    borderColor: Colors.colors.primary,
    backgroundColor: 'rgba(232, 81, 47, 0.08)',
  },
  dayChipText: {
    fontFamily: 'Rubik_500Medium',
    fontSize: 13,
    color: Colors.colors.textSecondary,
  },
  dayChipTextActive: {
    color: Colors.colors.primary,
  },
  dayCompleteDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.colors.success,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  exerciseRow: {
    backgroundColor: Colors.colors.backgroundCard,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.colors.border,
    overflow: 'hidden',
  },
  exerciseCompleted: {
    borderColor: Colors.colors.success,
    backgroundColor: 'rgba(52, 199, 89, 0.05)',
  },
  exerciseMain: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontFamily: 'Rubik_500Medium',
    fontSize: 15,
    color: Colors.colors.text,
    padding: 0,
  },
  exerciseNameCompleted: {
    color: Colors.colors.textSecondary,
  },
  exerciseMeta: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  exerciseTag: {
    fontFamily: 'Rubik_400Regular',
    fontSize: 11,
    color: Colors.colors.textSecondary,
    backgroundColor: Colors.colors.surfaceLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  exerciseTagRPE: {
    fontFamily: 'Rubik_500Medium',
    fontSize: 11,
    color: Colors.colors.accent,
    backgroundColor: Colors.colors.warningLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  exerciseExpanded: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.colors.border,
    paddingTop: 12,
  },
  exerciseFieldRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  exerciseField: {
    flex: 1,
  },
  fieldLabel: {
    fontFamily: 'Rubik_500Medium',
    fontSize: 10,
    color: Colors.colors.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  fieldInput: {
    fontFamily: 'Rubik_400Regular',
    fontSize: 14,
    color: Colors.colors.text,
    backgroundColor: Colors.colors.surfaceLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  notesRow: {
    marginBottom: 8,
  },
  notesField: {
    fontFamily: 'Rubik_400Regular',
    fontSize: 13,
    color: Colors.colors.text,
    backgroundColor: Colors.colors.surfaceLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 40,
  },
  deleteExerciseBtn: {
    alignSelf: 'flex-end',
    padding: 4,
  },
  addExerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.colors.border,
    borderStyle: 'dashed',
    marginTop: 4,
  },
  addExerciseText: {
    fontFamily: 'Rubik_500Medium',
    fontSize: 14,
    color: Colors.colors.primary,
  },
  saveBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.colors.backgroundElevated,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.colors.border,
    gap: 8,
  },
  saveBarDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.colors.warning,
  },
  saveBarText: {
    flex: 1,
    fontFamily: 'Rubik_400Regular',
    fontSize: 13,
    color: Colors.colors.textSecondary,
  },
  saveBarButton: {
    backgroundColor: Colors.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveBarButtonText: {
    fontFamily: 'Rubik_600SemiBold',
    fontSize: 14,
    color: '#fff',
  },
});
