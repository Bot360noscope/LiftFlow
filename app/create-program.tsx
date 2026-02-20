import { StyleSheet, Text, View, Pressable, Platform, TextInput, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState, useCallback, useEffect } from "react";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { addProgram, createSampleProgram, getProfile, cellKey, getEmptyCell } from "@/lib/storage";

export default function CreateProgramScreen() {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [weeks, setWeeks] = useState('4');
  const [daysPerWeek, setDaysPerWeek] = useState('3');
  const [rows, setRows] = useState('6');
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
    const numRows = parseInt(rows) || 6;

    const cells: Record<string, any> = {};
    for (let r = 0; r < numRows; r++) {
      for (let w = 1; w <= numWeeks; w++) {
        for (let d = 1; d <= numDays; d++) {
          const key = cellKey(r, w, d);
          cells[key] = getEmptyCell(r, w, d);
        }
      }
    }

    await addProgram({
      title: title.trim(),
      description: description.trim() || `${numWeeks}-week training program`,
      totalWeeks: numWeeks,
      daysPerWeek: numDays,
      rowCount: numRows,
      cells,
      coachId,
      clientId: null,
      status: 'active',
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  }, [title, description, weeks, daysPerWeek, rows, coachId]);

  const handleQuickStart = useCallback(async () => {
    setSaving(true);
    const sample = createSampleProgram(coachId);
    await addProgram(sample);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  }, [coachId]);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="close" size={28} color={Colors.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>New Program</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <Pressable
          style={({ pressed }) => [styles.quickStartCard, pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }]}
          onPress={handleQuickStart}
          disabled={saving}
        >
          <View style={styles.quickStartIcon}>
            <Ionicons name="flash" size={22} color={Colors.colors.accent} />
          </View>
          <View style={styles.quickStartInfo}>
            <Text style={styles.quickStartTitle}>Quick Start Template</Text>
            <Text style={styles.quickStartDesc}>4-week strength program with 6 exercises, 3 days/wk - ready to customize in the spreadsheet</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.colors.textMuted} />
        </Pressable>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or create custom</Text>
          <View style={styles.dividerLine} />
        </View>

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
            <Text style={styles.label}>Rows</Text>
            <View style={styles.counterRow}>
              <Pressable style={styles.counterBtn} onPress={() => { Haptics.selectionAsync(); setRows(r => String(Math.max(1, parseInt(r) - 1))); }}>
                <Ionicons name="remove" size={20} color={Colors.colors.text} />
              </Pressable>
              <Text style={styles.counterValue}>{rows}</Text>
              <Pressable style={styles.counterBtn} onPress={() => { Haptics.selectionAsync(); setRows(r => String(Math.min(20, parseInt(r) + 1))); }}>
                <Ionicons name="add" size={20} color={Colors.colors.text} />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={18} color={Colors.colors.textSecondary} />
          <Text style={styles.infoText}>This creates a {weeks}W x {daysPerWeek}D grid with {rows} exercise rows. Each cell can hold exercise name, reps/sets, weight, RPE, notes, and video.</Text>
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
  quickStartCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.colors.backgroundCard,
    borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.colors.accent, gap: 12,
  },
  quickStartIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,140,66,0.12)', alignItems: 'center', justifyContent: 'center' },
  quickStartInfo: { flex: 1 },
  quickStartTitle: { fontFamily: 'Rubik_600SemiBold', fontSize: 15, color: Colors.colors.text, marginBottom: 2 },
  quickStartDesc: { fontFamily: 'Rubik_400Regular', fontSize: 12, color: Colors.colors.textSecondary },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 24, gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.colors.border },
  dividerText: { fontFamily: 'Rubik_400Regular', fontSize: 12, color: Colors.colors.textMuted },
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
