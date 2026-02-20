import { StyleSheet, Text, View, Pressable, Platform, TextInput, ScrollView, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState, useCallback, useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Crypto from "expo-crypto";
import Colors from "@/constants/colors";
import { addProgram, getProfile, type Exercise, type WorkoutWeek, type WorkoutDay } from "@/lib/storage";

export default function CreateProgramScreen() {
  const insets = useSafeAreaInsets();
  const { clientId, clientName } = useLocalSearchParams<{ clientId?: string; clientName?: string }>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [weeks, setWeeks] = useState('4');
  const [daysPerWeek, setDaysPerWeek] = useState('3');
  const [exercisesPerDay, setExercisesPerDay] = useState('4');
  const [saving, setSaving] = useState(false);
  const [coachId, setCoachId] = useState('');

  useEffect(() => {
    getProfile().then(p => setCoachId(p.id));
  }, []);

  const handleCreate = useCallback(async () => {
    if (!title.trim()) return;
    setSaving(true);

    const numWeeks = parseInt(weeks) || 4;
    const numDays = parseInt(daysPerWeek) || 3;
    const numExercises = parseInt(exercisesPerDay) || 4;

    const programWeeks: WorkoutWeek[] = [];
    for (let w = 1; w <= numWeeks; w++) {
      const days: WorkoutDay[] = [];
      for (let d = 1; d <= numDays; d++) {
        const exercises: Exercise[] = [];
        for (let e = 0; e < numExercises; e++) {
          exercises.push({
            id: Crypto.randomUUID(),
            name: '',
            weight: '',
            repsSets: '',
            rpe: '',
            isCompleted: false,
            notes: '',
            clientNotes: '',
            coachComment: '',
            videoUrl: '',
          });
        }
        days.push({ dayNumber: d, exercises });
      }
      programWeeks.push({ weekNumber: w, days });
    }

    try {
      await addProgram({
        title: title.trim(),
        description: description.trim() || `${numWeeks}-week training program`,
        weeks: programWeeks,
        daysPerWeek: numDays,
        coachId,
        clientId: clientId || null,
        status: 'active',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err: any) {
      Alert.alert("Error", "Failed to create program. Please try again.");
      setSaving(false);
    }
  }, [title, description, weeks, daysPerWeek, exercisesPerDay, coachId]);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="close" size={28} color={Colors.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{clientName ? `Program for ${clientName}` : 'New Program'}</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <Text style={styles.label}>Program Name</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g., Hypertrophy Block 1"
          placeholderTextColor={Colors.colors.textMuted}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, { minHeight: 70 }]}
          value={description}
          onChangeText={setDescription}
          placeholder="e.g., Focus on volume and muscle growth"
          placeholderTextColor={Colors.colors.textMuted}
          multiline
          textAlignVertical="top"
        />

        <View style={styles.row}>
          <View style={styles.thirdField}>
            <Text style={styles.label}>Weeks</Text>
            <View style={styles.counterRow}>
              <Pressable style={styles.counterBtn} onPress={() => { Haptics.selectionAsync(); setWeeks(w => String(Math.max(1, parseInt(w) - 1))); }}>
                <Ionicons name="remove" size={20} color={Colors.colors.text} />
              </Pressable>
              <Text style={styles.counterValue}>{weeks}</Text>
              <Pressable style={styles.counterBtn} onPress={() => { Haptics.selectionAsync(); setWeeks(w => String(Math.min(16, parseInt(w) + 1))); }}>
                <Ionicons name="add" size={20} color={Colors.colors.text} />
              </Pressable>
            </View>
          </View>

          <View style={styles.thirdField}>
            <Text style={styles.label}>Days/Wk</Text>
            <View style={styles.counterRow}>
              <Pressable style={styles.counterBtn} onPress={() => { Haptics.selectionAsync(); setDaysPerWeek(d => String(Math.max(1, parseInt(d) - 1))); }}>
                <Ionicons name="remove" size={20} color={Colors.colors.text} />
              </Pressable>
              <Text style={styles.counterValue}>{daysPerWeek}</Text>
              <Pressable style={styles.counterBtn} onPress={() => { Haptics.selectionAsync(); setDaysPerWeek(d => String(Math.min(7, parseInt(d) + 1))); }}>
                <Ionicons name="add" size={20} color={Colors.colors.text} />
              </Pressable>
            </View>
          </View>

          <View style={styles.thirdField}>
            <Text style={styles.label}>Exercises</Text>
            <View style={styles.counterRow}>
              <Pressable style={styles.counterBtn} onPress={() => { Haptics.selectionAsync(); setExercisesPerDay(r => String(Math.max(1, parseInt(r) - 1))); }}>
                <Ionicons name="remove" size={20} color={Colors.colors.text} />
              </Pressable>
              <Text style={styles.counterValue}>{exercisesPerDay}</Text>
              <Pressable style={styles.counterBtn} onPress={() => { Haptics.selectionAsync(); setExercisesPerDay(r => String(Math.min(20, parseInt(r) + 1))); }}>
                <Ionicons name="add" size={20} color={Colors.colors.text} />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={18} color={Colors.colors.textSecondary} />
          <Text style={styles.infoText}>This creates a {weeks}-week program with {daysPerWeek} training days per week and {exercisesPerDay} exercises per day. You can add or remove exercises later.</Text>
        </View>

        <Pressable
          style={[styles.createButton, (!title.trim() || saving) && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={!title.trim() || saving}
        >
          <Ionicons name="grid" size={20} color="#fff" />
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
