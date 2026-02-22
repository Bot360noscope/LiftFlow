import { StyleSheet, Text, View, Pressable, Platform, TextInput, ScrollView, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState, useCallback, useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Crypto from "expo-crypto";
import Colors from "@/constants/colors";
import { addProgram, getProfile, getClients, type Exercise, type WorkoutWeek, type WorkoutDay, type ClientInfo } from "@/lib/storage";

const CLIENT_TEMPLATES = [
  { label: 'Blank Program', icon: 'create-outline' as const, weeks: 4, days: 3, exercises: 4, title: '', desc: '' },
  { label: 'Push / Pull / Legs', icon: 'barbell-outline' as const, weeks: 8, days: 6, exercises: 5, title: 'Push Pull Legs', desc: '6-day PPL split' },
  { label: 'Upper / Lower', icon: 'body-outline' as const, weeks: 6, days: 4, exercises: 5, title: 'Upper Lower Split', desc: '4-day upper/lower split' },
  { label: 'Full Body 3x', icon: 'fitness-outline' as const, weeks: 4, days: 3, exercises: 6, title: 'Full Body', desc: '3-day full body program' },
];

const COACH_TEMPLATES = [
  { label: 'Blank', icon: 'create-outline' as const, weeks: 4, days: 3, exercises: 4, title: '', desc: '' },
  { label: 'PPL', icon: 'barbell-outline' as const, weeks: 8, days: 6, exercises: 5, title: 'Push Pull Legs', desc: '6-day PPL split' },
  { label: 'U/L', icon: 'body-outline' as const, weeks: 6, days: 4, exercises: 5, title: 'Upper Lower Split', desc: '4-day upper/lower split' },
  { label: 'Full Body', icon: 'fitness-outline' as const, weeks: 4, days: 3, exercises: 6, title: 'Full Body', desc: '3-day full body program' },
  { label: '5/3/1', icon: 'trending-up-outline' as const, weeks: 4, days: 4, exercises: 4, title: '5/3/1 Program', desc: 'Wendler 5/3/1 strength program' },
];

function buildWeeks(numWeeks: number, numDays: number, numExercises: number): WorkoutWeek[] {
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
  return programWeeks;
}

function Counter({ label, value, onChange, min, max }: { label: string; value: string; onChange: (v: string) => void; min: number; max: number }) {
  return (
    <View style={styles.thirdField}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.counterRow}>
        <Pressable style={styles.counterBtn} onPress={() => { Haptics.selectionAsync(); onChange(String(Math.max(min, parseInt(value) - 1))); }}>
          <Ionicons name="remove" size={20} color={Colors.colors.text} />
        </Pressable>
        <Text style={styles.counterValue}>{value}</Text>
        <Pressable style={styles.counterBtn} onPress={() => { Haptics.selectionAsync(); onChange(String(Math.min(max, parseInt(value) + 1))); }}>
          <Ionicons name="add" size={20} color={Colors.colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

export default function CreateProgramScreen() {
  const insets = useSafeAreaInsets();
  const { clientId, clientName } = useLocalSearchParams<{ clientId?: string; clientName?: string }>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [weeks, setWeeks] = useState('4');
  const [daysPerWeek, setDaysPerWeek] = useState('3');
  const [exercisesPerDay, setExercisesPerDay] = useState('4');
  const [saving, setSaving] = useState(false);
  const [profileId, setProfileId] = useState('');
  const [role, setRole] = useState<'coach' | 'client'>('coach');
  const [selectedTemplate, setSelectedTemplate] = useState(-1);
  const [clientList, setClientList] = useState<ClientInfo[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(clientId || null);
  const [selectedClientName, setSelectedClientName] = useState<string>(clientName || '');

  useEffect(() => {
    getProfile().then(p => {
      setProfileId(p.id);
      setRole(p.role as 'coach' | 'client');
      if (p.role === 'coach' && !clientId) {
        getClients().then(c => setClientList(c));
      }
    });
  }, []);

  const applyTemplate = useCallback((idx: number) => {
    const templates = role === 'coach' ? COACH_TEMPLATES : CLIENT_TEMPLATES;
    const t = templates[idx];
    setSelectedTemplate(idx);
    setWeeks(String(t.weeks));
    setDaysPerWeek(String(t.days));
    setExercisesPerDay(String(t.exercises));
    if (t.title) {
      setTitle(t.title);
      setDescription(t.desc);
    }
    Haptics.selectionAsync();
  }, [role]);

  const handleCreate = useCallback(async () => {
    if (!title.trim()) return;
    setSaving(true);

    const numWeeks = parseInt(weeks) || 4;
    const numDays = parseInt(daysPerWeek) || 3;
    const numExercises = parseInt(exercisesPerDay) || 4;
    const programWeeks = buildWeeks(numWeeks, numDays, numExercises);

    try {
      await addProgram({
        title: title.trim(),
        description: description.trim() || `${numWeeks}-week training program`,
        weeks: programWeeks,
        daysPerWeek: numDays,
        coachId: profileId,
        clientId: selectedClientId || null,
        status: 'active',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err: any) {
      Alert.alert("Error", "Failed to create program. Please try again.");
      setSaving(false);
    }
  }, [title, description, weeks, daysPerWeek, exercisesPerDay, profileId, selectedClientId]);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const templates = role === 'coach' ? COACH_TEMPLATES : CLIENT_TEMPLATES;
  const isCoach = role === 'coach';
  const headerTitle = clientName
    ? `Program for ${clientName}`
    : isCoach
      ? 'New Program'
      : 'My Program';

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="close" size={28} color={Colors.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{headerTitle}</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {!isCoach && (
          <View style={styles.clientBanner}>
            <Ionicons name="fitness" size={20} color={Colors.colors.primary} />
            <Text style={styles.clientBannerText}>Create your own personal training program</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Quick Start</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templateScroll} contentContainerStyle={styles.templateScrollContent}>
          {templates.map((t, idx) => (
            <Pressable
              key={idx}
              style={[styles.templateCard, selectedTemplate === idx && styles.templateCardSelected]}
              onPress={() => applyTemplate(idx)}
            >
              <Ionicons name={t.icon} size={22} color={selectedTemplate === idx ? Colors.colors.primary : Colors.colors.textSecondary} />
              <Text style={[styles.templateLabel, selectedTemplate === idx && styles.templateLabelSelected]}>{t.label}</Text>
              <Text style={styles.templateMeta}>{t.weeks}w · {t.days}d</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.label}>{isCoach ? 'Program Name' : 'What do you want to call it?'}</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder={isCoach ? "e.g., Hypertrophy Block 1" : "e.g., My Strength Plan"}
          placeholderTextColor={Colors.colors.textMuted}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, { minHeight: 70 }]}
          value={description}
          onChangeText={setDescription}
          placeholder={isCoach ? "e.g., Focus on volume and muscle growth" : "e.g., Building strength over 4 weeks"}
          placeholderTextColor={Colors.colors.textMuted}
          multiline
          textAlignVertical="top"
        />

        <View style={styles.row}>
          <Counter label="Weeks" value={weeks} onChange={setWeeks} min={1} max={16} />
          <Counter label="Days/Wk" value={daysPerWeek} onChange={setDaysPerWeek} min={1} max={7} />
          <Counter label="Exercises" value={exercisesPerDay} onChange={setExercisesPerDay} min={1} max={20} />
        </View>

        {isCoach && !clientId && clientList.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Assign to Client</Text>
            <Text style={styles.assignHint}>Optional — leave unassigned to use as a template</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templateScroll} contentContainerStyle={styles.templateScrollContent}>
              <Pressable
                style={[styles.clientChip, !selectedClientId && styles.clientChipSelected]}
                onPress={() => { setSelectedClientId(null); setSelectedClientName(''); Haptics.selectionAsync(); }}
              >
                <Text style={[styles.clientChipText, !selectedClientId && styles.clientChipTextSelected]}>Unassigned</Text>
              </Pressable>
              {clientList.map(c => (
                <Pressable
                  key={c.id}
                  style={[styles.clientChip, selectedClientId === c.id && styles.clientChipSelected]}
                  onPress={() => { setSelectedClientId(c.id); setSelectedClientName(c.name); Haptics.selectionAsync(); }}
                >
                  <Text style={[styles.clientChipText, selectedClientId === c.id && styles.clientChipTextSelected]}>{c.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={18} color={Colors.colors.textSecondary} />
          <Text style={styles.infoText}>
            {isCoach
              ? `Creates a ${weeks}-week program with ${daysPerWeek} days/week and ${exercisesPerDay} exercises/day.${selectedClientName ? ` Assigned to ${selectedClientName}.` : ''} You can edit exercises after creation.`
              : `This creates a ${weeks}-week program with ${daysPerWeek} training days per week and ${exercisesPerDay} exercises per day. You can fill in exercises, track weights, and log your progress.`
            }
          </Text>
        </View>

        <Pressable
          style={[styles.createButton, (!title.trim() || saving) && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={!title.trim() || saving}
        >
          <Ionicons name={isCoach ? "grid" : "add-circle"} size={20} color="#fff" />
          <Text style={styles.createButtonText}>{saving ? 'Creating...' : isCoach ? 'Create Program' : 'Start Program'}</Text>
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
  clientBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.colors.surfaceLight, borderRadius: 12, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.colors.border,
  },
  clientBannerText: { fontFamily: 'Rubik_500Medium', fontSize: 14, color: Colors.colors.text, flex: 1 },
  sectionTitle: { fontFamily: 'Rubik_700Bold', fontSize: 16, color: Colors.colors.text, marginTop: 20, marginBottom: 8 },
  assignHint: { fontFamily: 'Rubik_400Regular', fontSize: 12, color: Colors.colors.textMuted, marginBottom: 8 },
  templateScroll: { marginBottom: 4 },
  templateScrollContent: { gap: 10, paddingRight: 4 },
  templateCard: {
    backgroundColor: Colors.colors.backgroundCard, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.colors.border, alignItems: 'center', width: 100, gap: 6,
  },
  templateCardSelected: { borderColor: Colors.colors.primary, backgroundColor: 'rgba(232, 81, 47, 0.08)' },
  templateLabel: { fontFamily: 'Rubik_600SemiBold', fontSize: 12, color: Colors.colors.textSecondary, textAlign: 'center' },
  templateLabelSelected: { color: Colors.colors.primary },
  templateMeta: { fontFamily: 'Rubik_400Regular', fontSize: 11, color: Colors.colors.textMuted },
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
