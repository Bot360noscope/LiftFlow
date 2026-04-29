import { ErrorBoundary } from "@/components/ErrorBoundary";
import { StyleSheet, Text, View, Pressable, Platform, TextInput, ScrollView, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState, useCallback, useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Crypto from "expo-crypto";
import Colors from "@/constants/colors";
import { useTheme } from "@/lib/theme-context";
import {
  addProgram, getProfile, getClients,
  type Exercise, type WorkoutWeek, type WorkoutDay,
  type NutritionWeek, type NutritionDay, type Meal,
  type ClientInfo, type ProgramType,
} from "@/lib/storage";

const DEFAULT_MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

function buildWorkoutWeeks(numWeeks: number, numDays: number, numExercises: number): WorkoutWeek[] {
  const programWeeks: WorkoutWeek[] = [];
  for (let w = 1; w <= numWeeks; w++) {
    const days: WorkoutDay[] = [];
    for (let d = 1; d <= numDays; d++) {
      const exercises: Exercise[] = [];
      for (let e = 0; e < numExercises; e++) {
        exercises.push({
          id: Crypto.randomUUID(),
          name: '', weight: '', repsSets: '', rpe: '',
          isCompleted: false, notes: '', clientNotes: '', coachComment: '', videoUrl: '',
        });
      }
      days.push({ dayNumber: d, exercises });
    }
    programWeeks.push({ weekNumber: w, days });
  }
  return programWeeks;
}

function buildNutritionWeeks(numWeeks: number, numDays: number, numMeals: number): NutritionWeek[] {
  const weeks: NutritionWeek[] = [];
  for (let w = 1; w <= numWeeks; w++) {
    const days: NutritionDay[] = [];
    for (let d = 1; d <= numDays; d++) {
      const meals: Meal[] = [];
      for (let m = 0; m < numMeals; m++) {
        meals.push({
          id: Crypto.randomUUID(),
          name: DEFAULT_MEALS[m] || `Meal ${m + 1}`,
          items: [],
        });
      }
      days.push({ dayNumber: d, meals });
    }
    weeks.push({ weekNumber: w, days });
  }
  return weeks;
}

function Counter({ label, value, onChange, min, max }: { label: string; value: string; onChange: (v: string) => void; min: number; max: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.thirdField}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <View style={[styles.counterRow, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
        <Pressable style={styles.counterBtn} onPress={() => { Haptics.selectionAsync(); onChange(String(Math.max(min, parseInt(value) - 1))); }}>
          <Ionicons name="remove" size={20} color={colors.text} />
        </Pressable>
        <Text style={[styles.counterValue, { color: colors.text }]}>{value}</Text>
        <Pressable style={styles.counterBtn} onPress={() => { Haptics.selectionAsync(); onChange(String(Math.min(max, parseInt(value) + 1))); }}>
          <Ionicons name="add" size={20} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const TYPE_OPTIONS: { key: ProgramType; icon: string; label: string; desc: string }[] = [
  { key: 'workout', icon: 'barbell-outline', label: 'Workout', desc: 'Exercises, sets, reps & weight' },
  { key: 'nutrition', icon: 'nutrition-outline', label: 'Nutrition', desc: 'Meals, macros & food plans' },
  { key: 'physio', icon: 'body-outline', label: 'Physio', desc: 'Rehab exercises & recovery' },
];

function CreateProgramScreenInner() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { clientId, clientName } = useLocalSearchParams<{ clientId?: string; clientName?: string }>();
  const [programType, setProgramType] = useState<ProgramType>('workout');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [weeks, setWeeks] = useState('1');
  const isRecurring = programType === 'physio' || programType === 'nutrition';
  const effectiveWeeks = isRecurring ? '1' : weeks;
  const [daysPerWeek, setDaysPerWeek] = useState('3');
  const [exercisesPerDay, setExercisesPerDay] = useState('4');
  const [mealsPerDay, setMealsPerDay] = useState('4');
  const [saving, setSaving] = useState(false);
  const [profileId, setProfileId] = useState('');
  const [role, setRole] = useState<'coach' | 'client'>('coach');
  const [clientList, setClientList] = useState<ClientInfo[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(clientId || null);
  const [selectedClientName, setSelectedClientName] = useState<string>(clientName || '');

  useEffect(() => {
    getProfile().then(p => {
      setProfileId(p.id);
      setRole(p.role as 'coach' | 'client');
      if (p.role === 'coach' && !clientId) {
        getClients().then(c => setClientList(c)).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  const handleCreate = useCallback(async () => {
    if (!title.trim()) return;
    setSaving(true);

    const numWeeks = parseInt(effectiveWeeks) || 1;
    const numDays = parseInt(daysPerWeek) || 3;

    let programWeeks: WorkoutWeek[] | NutritionWeek[];
    let descFallback: string;

    if (programType === 'nutrition') {
      const numMeals = parseInt(mealsPerDay) || 4;
      programWeeks = buildNutritionWeeks(numWeeks, numDays, numMeals);
      descFallback = `${numWeeks}-week nutrition plan`;
    } else {
      const numExercises = parseInt(exercisesPerDay) || 4;
      programWeeks = buildWorkoutWeeks(numWeeks, numDays, numExercises);
      descFallback = programType === 'physio'
        ? `${numWeeks}-week rehab program`
        : `${numWeeks}-week training program`;
    }

    try {
      await addProgram({
        title: title.trim(),
        description: description.trim() || descFallback,
        weeks: programWeeks,
        daysPerWeek: numDays,
        coachId: profileId,
        clientId: selectedClientId || null,
        status: 'active',
        programType,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err: any) {
      Alert.alert("Error", "Failed to create program. Please try again.");
      setSaving(false);
    }
  }, [title, description, weeks, daysPerWeek, exercisesPerDay, mealsPerDay, profileId, selectedClientId, programType]);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const isCoach = role === 'coach';
  const headerTitle = clientName
    ? `Program for ${clientName}`
    : isCoach
      ? 'New Program'
      : 'My Program';

  const placeholderByType = {
    workout: { name: "e.g., Hypertrophy Block 1", desc: "e.g., Focus on volume and muscle growth" },
    nutrition: { name: "e.g., Cut Phase Diet", desc: "e.g., High protein, calorie deficit" },
    physio: { name: "e.g., Shoulder Rehab", desc: "e.g., Post-surgery recovery protocol" },
  };

  const infoText = programType === 'nutrition'
    ? `Creates a recurring weekly meal plan with ${daysPerWeek} days/week and ${mealsPerDay} meals/day. The same plan repeats every week automatically — edit it any time and changes apply going forward.${selectedClientName ? ` Assigned to ${selectedClientName}.` : ''}`
    : programType === 'physio'
      ? `Creates a recurring weekly routine with ${daysPerWeek} days/week and ${exercisesPerDay} exercises/day. The same routine repeats every week automatically — edit it any time and changes apply going forward.${selectedClientName ? ` Assigned to ${selectedClientName}.` : ''}`
      : isCoach
        ? `Creates a ${weeks}-week program with ${daysPerWeek} days/week and ${exercisesPerDay} exercises/day.${selectedClientName ? ` Assigned to ${selectedClientName}.` : ''} You can edit exercises after creation.`
        : `This creates a ${weeks}-week program with ${daysPerWeek} training days per week and ${exercisesPerDay} exercises per day. You can fill in exercises, track weights, and log your progress.`;

  const buttonIcon = programType === 'nutrition' ? 'restaurant' : programType === 'physio' ? 'body' : isCoach ? 'grid' : 'add-circle';

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset, backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="close" size={28} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{headerTitle}</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <Text style={[styles.label, { color: colors.textSecondary, marginTop: 4 }]}>Program Type</Text>
        <View style={styles.typeRow}>
          {TYPE_OPTIONS.map(opt => {
            const selected = programType === opt.key;
            return (
              <Pressable
                key={opt.key}
                style={[
                  styles.typeCard,
                  { backgroundColor: colors.backgroundCard, borderColor: selected ? colors.primary : colors.border },
                  selected && { backgroundColor: 'rgba(232, 81, 47, 0.08)' },
                ]}
                onPress={() => { setProgramType(opt.key); Haptics.selectionAsync(); }}
              >
                <Ionicons name={opt.icon as any} size={22} color={selected ? colors.primary : colors.textMuted} />
                <Text style={[styles.typeLabel, { color: selected ? colors.primary : colors.text }]}>{opt.label}</Text>
                <Text style={[styles.typeDesc, { color: colors.textMuted }]} numberOfLines={2}>{opt.desc}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {programType === 'nutrition' ? 'Plan Name' : isCoach ? 'Program Name' : 'What do you want to call it?'}
        </Text>
        <TextInput
          style={[styles.input, { color: colors.text, backgroundColor: colors.backgroundCard, borderColor: colors.border }]}
          value={title}
          onChangeText={setTitle}
          placeholder={isCoach ? placeholderByType[programType].name : "e.g., My Strength Plan"}
          placeholderTextColor={colors.textMuted}
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>Description</Text>
        <TextInput
          style={[styles.input, { minHeight: 70, color: colors.text, backgroundColor: colors.backgroundCard, borderColor: colors.border }]}
          value={description}
          onChangeText={setDescription}
          placeholder={isCoach ? placeholderByType[programType].desc : "e.g., Building strength over 4 weeks"}
          placeholderTextColor={colors.textMuted}
          multiline
          textAlignVertical="top"
        />

        <View style={styles.row}>
          {programType !== 'physio' && (
            <Counter label="Weeks" value={weeks} onChange={setWeeks} min={1} max={16} />
          )}
          <Counter label="Days/Wk" value={daysPerWeek} onChange={setDaysPerWeek} min={1} max={7} />
          {programType === 'nutrition' ? (
            <Counter label="Meals" value={mealsPerDay} onChange={setMealsPerDay} min={1} max={8} />
          ) : (
            <Counter label="Exercises" value={exercisesPerDay} onChange={setExercisesPerDay} min={1} max={20} />
          )}
        </View>

        {isCoach && !clientId && clientList.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Assign to Client</Text>
            <Text style={[styles.assignHint, { color: colors.textMuted }]}>Optional — leave unassigned to use as a template</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.clientChipScroll} contentContainerStyle={styles.clientChipScrollContent}>
              <Pressable
                style={[styles.clientChip, { backgroundColor: colors.backgroundCard, borderColor: colors.border }, !selectedClientId && [styles.clientChipSelected, { borderColor: colors.primary }]]}
                onPress={() => { setSelectedClientId(null); setSelectedClientName(''); Haptics.selectionAsync(); }}
              >
                <Text style={[styles.clientChipText, { color: colors.textSecondary }, !selectedClientId && [styles.clientChipTextSelected, { color: colors.primary }]]}>Unassigned</Text>
              </Pressable>
              {clientList.map(c => (
                <Pressable
                  key={c.id}
                  style={[styles.clientChip, { backgroundColor: colors.backgroundCard, borderColor: colors.border }, selectedClientId === c.id && [styles.clientChipSelected, { borderColor: colors.primary }]]}
                  onPress={() => { setSelectedClientId(c.id); setSelectedClientName(c.name); Haptics.selectionAsync(); }}
                >
                  <Text style={[styles.clientChipText, { color: colors.textSecondary }, selectedClientId === c.id && [styles.clientChipTextSelected, { color: colors.primary }]]}>{c.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        <View style={[styles.infoBox, { backgroundColor: colors.surfaceLight }]}>
          <Ionicons name="information-circle" size={18} color={colors.textSecondary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>{infoText}</Text>
        </View>

        <Pressable
          style={[styles.createButton, { backgroundColor: colors.primary }, (!title.trim() || saving) && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={!title.trim() || saving}
        >
          <Ionicons name={buttonIcon as any} size={20} color="#fff" />
          <Text style={styles.createButtonText}>{saving ? 'Creating...' : 'Create Program'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { fontFamily: 'Rubik_700Bold', fontSize: 20, color: Colors.colors.text },
  scrollContent: { paddingHorizontal: 20 },
  typeRow: { flexDirection: 'row', gap: 10 },
  typeCard: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 14, paddingHorizontal: 6, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.colors.border,
  },
  typeLabel: { fontFamily: 'Rubik_600SemiBold', fontSize: 13 },
  typeDesc: { fontFamily: 'Rubik_400Regular', fontSize: 10, textAlign: 'center', lineHeight: 13 },
  sectionTitle: { fontFamily: 'Rubik_700Bold', fontSize: 16, color: Colors.colors.text, marginTop: 20, marginBottom: 8 },
  assignHint: { fontFamily: 'Rubik_400Regular', fontSize: 12, color: Colors.colors.textMuted, marginBottom: 8 },
  clientChipScroll: { marginBottom: 4 },
  clientChipScrollContent: { gap: 10, paddingRight: 4 },
  clientChip: {
    backgroundColor: Colors.colors.backgroundCard, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.colors.border,
  },
  clientChipSelected: { borderColor: Colors.colors.primary, backgroundColor: 'rgba(232, 81, 47, 0.08)' },
  clientChipText: { fontFamily: 'Rubik_500Medium', fontSize: 13, color: Colors.colors.textSecondary },
  clientChipTextSelected: { color: Colors.colors.primary },
  label: { fontFamily: 'Rubik_600SemiBold', fontSize: 14, color: Colors.colors.textSecondary, marginBottom: 8, marginTop: 16 },
  input: {
    fontFamily: 'Rubik_400Regular', fontSize: 15, color: Colors.colors.text,
    backgroundColor: Colors.colors.backgroundCard, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: Colors.colors.border,
  },
  row: { flexDirection: 'row', gap: 10 },
  thirdField: { flex: 1 },
  counterRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.colors.backgroundCard,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.colors.border, overflow: 'hidden',
  },
  counterBtn: { paddingVertical: 12, paddingHorizontal: 12 },
  counterValue: { flex: 1, fontFamily: 'Rubik_700Bold', fontSize: 18, color: Colors.colors.text, textAlign: 'center' },
  infoBox: {
    flexDirection: 'row', gap: 8, backgroundColor: Colors.colors.surfaceLight,
    borderRadius: 10, padding: 12, marginTop: 20, alignItems: 'flex-start',
  },
  infoText: { flex: 1, fontFamily: 'Rubik_400Regular', fontSize: 12, color: Colors.colors.textSecondary, lineHeight: 18 },
  createButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.colors.primary, paddingVertical: 16, borderRadius: 14, marginTop: 24,
  },
  createButtonDisabled: { opacity: 0.5 },
  createButtonText: { fontFamily: 'Rubik_700Bold', fontSize: 16, color: '#fff' },
});

export default function CreateProgramScreen() {
  return (
    <ErrorBoundary pageName="Create Program">
      <CreateProgramScreenInner />
    </ErrorBoundary>
  );
}
