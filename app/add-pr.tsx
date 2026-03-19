import { StyleSheet, Text, View, Pressable, Platform, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState, useCallback, useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useTheme } from "@/lib/theme-context";
import { addPR, getProfile } from "@/lib/storage";

type LiftType = 'squat' | 'deadlift' | 'bench';

const LIFT_OPTIONS: { type: LiftType; label: string; color: string; icon: string }[] = [
  { type: 'squat', label: 'Squat', color: Colors.colors.squat, icon: 'fitness' },
  { type: 'deadlift', label: 'Deadlift', color: Colors.colors.deadlift, icon: 'barbell' },
  { type: 'bench', label: 'Bench', color: Colors.colors.bench, icon: 'body' },
];

export default function AddPRScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ lift?: string }>();
  const initialLift: LiftType = (['squat', 'deadlift', 'bench'].includes(params.lift || '') ? params.lift : 'squat') as LiftType;
  const [selectedLift, setSelectedLift] = useState<LiftType>(initialLift);
  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [unit, setUnit] = useState<'kg' | 'lbs'>('kg');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getProfile().then(p => setUnit(p.weightUnit)).catch(() => {});
  }, []);

  const handleSave = useCallback(async () => {
    const weightNum = parseFloat(weight);
    if (!weight || isNaN(weightNum) || weightNum <= 0) return;

    setSaving(true);
    await addPR({
      liftType: selectedLift,
      weight: weightNum,
      unit,
      date: new Date().toISOString(),
      notes: notes.trim(),
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  }, [selectedLift, weight, unit, notes]);

  const selectedColor = LIFT_OPTIONS.find(l => l.type === selectedLift)?.color || colors.primary;
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset, backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="close" size={28} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Log PR</Text>
        <Pressable onPress={handleSave} hitSlop={8} disabled={!weight || saving}>
          <Ionicons name="checkmark-circle" size={28} color={weight && !saving ? colors.primary : colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.content}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Lift Type</Text>
        <View style={styles.liftRow}>
          {LIFT_OPTIONS.map(opt => (
            <Pressable
              key={opt.type}
              style={[styles.liftOption, { backgroundColor: colors.backgroundCard, borderColor: colors.border }, selectedLift === opt.type && { borderColor: opt.color, backgroundColor: `${opt.color}15` }]}
              onPress={() => { Haptics.selectionAsync(); setSelectedLift(opt.type); }}
            >
              <Ionicons name={opt.icon as any} size={22} color={selectedLift === opt.type ? opt.color : colors.textMuted} />
              <Text style={[styles.liftOptionText, { color: colors.textMuted }, selectedLift === opt.type && { color: opt.color }]}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Weight</Text>
        <View style={styles.weightRow}>
          <TextInput
            style={[styles.weightInput, { color: colors.text, backgroundColor: colors.backgroundCard, borderColor: colors.border }]}
            value={weight}
            onChangeText={setWeight}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            autoFocus
          />
          <Pressable style={[styles.unitToggle, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]} onPress={() => { Haptics.selectionAsync(); setUnit(u => u === 'kg' ? 'lbs' : 'kg'); }}>
            <Text style={[styles.unitText, { color: colors.primary }]}>{unit}</Text>
          </Pressable>
        </View>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Notes (optional)</Text>
        <TextInput
          style={[styles.notesInput, { color: colors.text, backgroundColor: colors.backgroundCard, borderColor: colors.border }]}
          value={notes}
          onChangeText={setNotes}
          placeholder="e.g., Felt strong today, hit depth..."
          placeholderTextColor={colors.textMuted}
          multiline
          textAlignVertical="top"
        />

        <Pressable
          style={[styles.saveButton, { backgroundColor: selectedColor }, (!weight || saving) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!weight || saving}
        >
          <Ionicons name="trophy" size={20} color="#fff" />
          <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save PR'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { fontFamily: 'Rubik_700Bold', fontSize: 20, color: Colors.colors.text },
  content: { paddingHorizontal: 20 },
  label: { fontFamily: 'Rubik_600SemiBold', fontSize: 14, color: Colors.colors.textSecondary, marginBottom: 10, marginTop: 20 },
  liftRow: { flexDirection: 'row', gap: 10 },
  liftOption: {
    flex: 1, alignItems: 'center', gap: 6, paddingVertical: 16, borderRadius: 14,
    backgroundColor: Colors.colors.backgroundCard, borderWidth: 2, borderColor: Colors.colors.border,
  },
  liftOptionText: { fontFamily: 'Rubik_500Medium', fontSize: 13, color: Colors.colors.textMuted },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  weightInput: {
    flex: 1, fontFamily: 'Rubik_700Bold', fontSize: 36, color: Colors.colors.text,
    backgroundColor: Colors.colors.backgroundCard, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 16,
    borderWidth: 1, borderColor: Colors.colors.border,
  },
  unitToggle: {
    backgroundColor: Colors.colors.backgroundCard, paddingHorizontal: 20, paddingVertical: 18,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.colors.border,
  },
  unitText: { fontFamily: 'Rubik_600SemiBold', fontSize: 18, color: Colors.colors.primary },
  notesInput: {
    fontFamily: 'Rubik_400Regular', fontSize: 15, color: Colors.colors.text,
    backgroundColor: Colors.colors.backgroundCard, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    minHeight: 80, borderWidth: 1, borderColor: Colors.colors.border,
  },
  saveButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: 14, marginTop: 30,
  },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { fontFamily: 'Rubik_700Bold', fontSize: 16, color: '#fff' },
});
