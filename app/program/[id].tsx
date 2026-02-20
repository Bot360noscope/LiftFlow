import { StyleSheet, Text, View, ScrollView, Pressable, Platform, TextInput, Alert, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState, useEffect, useMemo } from "react";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import Colors from "@/constants/colors";
import { getProgram, updateProgram, getProfile, cellKey, getEmptyCell, type Program, type CellData } from "@/lib/storage";

const SCREEN_WIDTH = Dimensions.get('window').width;
const CELL_WIDTH = 110;
const LABEL_COL_WIDTH = 90;

function SpreadsheetCell({ cell, onPress, isCoach }: { cell: CellData; onPress: () => void; isCoach: boolean }) {
  const hasContent = cell.exerciseName || cell.prescription || cell.weight;
  const hasComment = cell.coachComment || cell.clientNotes;
  const hasVideo = !!cell.videoUrl;

  return (
    <Pressable
      style={[
        styles.cell,
        cell.isCompleted && styles.cellCompleted,
        !hasContent && styles.cellEmpty,
      ]}
      onPress={onPress}
    >
      {hasContent ? (
        <>
          <Text style={styles.cellExName} numberOfLines={1}>{cell.exerciseName}</Text>
          {!!cell.prescription && (
            <Text style={styles.cellRx} numberOfLines={1}>{cell.prescription}</Text>
          )}
          {!!cell.weight && (
            <Text style={styles.cellWeight} numberOfLines={1}>{cell.weight}</Text>
          )}
          <View style={styles.cellIcons}>
            {cell.isCompleted && <Ionicons name="checkmark-circle" size={10} color={Colors.colors.success} />}
            {hasComment && <Ionicons name="chatbubble" size={9} color={Colors.colors.accent} />}
            {hasVideo && <Ionicons name="videocam" size={9} color={Colors.colors.primary} />}
            {!!cell.rpe && <Text style={styles.cellRPE}>RPE{cell.rpe}</Text>}
          </View>
        </>
      ) : (
        <Ionicons name="add" size={16} color={Colors.colors.textMuted} />
      )}
    </Pressable>
  );
}

export default function ProgramDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [program, setProgram] = useState<Program | null>(null);
  const [activeWeek, setActiveWeek] = useState(1);
  const [hasChanges, setHasChanges] = useState(false);
  const [isCoach, setIsCoach] = useState(true);
  const [editingCell, setEditingCell] = useState<{ row: number; week: number; day: number } | null>(null);

  useEffect(() => {
    if (id) {
      Promise.all([getProgram(id), getProfile()]).then(([p, prof]) => {
        if (p) setProgram(p);
        setIsCoach(prof.role === 'coach');
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

  const updateCell = useCallback((row: number, week: number, day: number, updates: Partial<CellData>) => {
    if (!program) return;
    const key = cellKey(row, week, day);
    const existing = program.cells[key] || getEmptyCell(row, week, day);
    const updated = { ...program, cells: { ...program.cells, [key]: { ...existing, ...updates } } };
    setProgram(updated);
    setHasChanges(true);
  }, [program]);

  const addRow = useCallback(() => {
    if (!program) return;
    const newRowIdx = program.rowCount;
    const updated = { ...program, rowCount: newRowIdx + 1, cells: { ...program.cells } };
    for (let w = 1; w <= program.totalWeeks; w++) {
      for (let d = 1; d <= program.daysPerWeek; d++) {
        const key = cellKey(newRowIdx, w, d);
        updated.cells[key] = getEmptyCell(newRowIdx, w, d);
      }
    }
    setProgram(updated);
    setHasChanges(true);
  }, [program]);

  const weekProgress = useMemo(() => {
    if (!program) return 0;
    let total = 0;
    let completed = 0;
    for (let r = 0; r < program.rowCount; r++) {
      for (let d = 1; d <= program.daysPerWeek; d++) {
        const key = cellKey(r, activeWeek, d);
        const cell = program.cells[key];
        if (cell && cell.exerciseName) {
          total++;
          if (cell.isCompleted) completed++;
        }
      }
    }
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  }, [program, activeWeek]);

  if (!program) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

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
          <View style={styles.headerMeta}>
            <Text style={styles.headerSub}>{program.totalWeeks}W x {program.daysPerWeek}D</Text>
            <View style={styles.shareChip}>
              <Ionicons name="share-outline" size={10} color={Colors.colors.textSecondary} />
              <Text style={styles.shareChipText}>{program.shareCode}</Text>
            </View>
          </View>
        </View>
        <Pressable onPress={save} hitSlop={8}>
          <Ionicons name="checkmark-circle" size={26} color={hasChanges ? Colors.colors.primary : Colors.colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.weekSelector}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekScrollContent}>
          {Array.from({ length: program.totalWeeks }, (_, i) => i + 1).map(weekNum => (
            <Pressable
              key={weekNum}
              style={[styles.weekChip, activeWeek === weekNum && styles.weekChipActive]}
              onPress={() => { Haptics.selectionAsync(); setActiveWeek(weekNum); }}
            >
              <Text style={[styles.weekChipText, activeWeek === weekNum && styles.weekChipTextActive]}>
                Week {weekNum}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.weekProgressRow}>
          <View style={styles.weekProgressBar}>
            <View style={[styles.weekProgressFill, { width: `${weekProgress}%` }]} />
          </View>
          <Text style={styles.weekProgressText}>{weekProgress}%</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + (hasChanges ? 70 : 20) }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={styles.gridContainer}>
          <View>
            <View style={styles.dayHeaderRow}>
              <View style={styles.rowLabel}>
                <Text style={styles.rowLabelText}>Exercise</Text>
              </View>
              {Array.from({ length: program.daysPerWeek }, (_, i) => i + 1).map(dayNum => (
                <View key={dayNum} style={styles.dayHeader}>
                  <Text style={styles.dayHeaderText}>Day {dayNum}</Text>
                </View>
              ))}
            </View>

            {Array.from({ length: program.rowCount }, (_, rowIdx) => {
              const firstKey = cellKey(rowIdx, activeWeek, 1);
              const firstCell = program.cells[firstKey];
              const rowLabel = firstCell?.exerciseName || `Row ${rowIdx + 1}`;

              return (
                <Animated.View key={rowIdx} entering={FadeInDown.delay(rowIdx * 30).duration(200)}>
                  <View style={styles.dataRow}>
                    <View style={styles.rowLabel}>
                      <Text style={styles.rowLabelExName} numberOfLines={2}>{rowLabel}</Text>
                    </View>
                    {Array.from({ length: program.daysPerWeek }, (_, dayIdx) => {
                      const dayNum = dayIdx + 1;
                      const key = cellKey(rowIdx, activeWeek, dayNum);
                      const cell = program.cells[key] || getEmptyCell(rowIdx, activeWeek, dayNum);

                      return (
                        <SpreadsheetCell
                          key={key}
                          cell={cell}
                          isCoach={isCoach}
                          onPress={() => setEditingCell({ row: rowIdx, week: activeWeek, day: dayNum })}
                        />
                      );
                    })}
                  </View>
                </Animated.View>
              );
            })}

            <Pressable style={styles.addRowBtn} onPress={addRow}>
              <Ionicons name="add" size={16} color={Colors.colors.primary} />
              <Text style={styles.addRowText}>Add Row</Text>
            </Pressable>
          </View>
        </ScrollView>
      </ScrollView>

      {editingCell && (
        <CellEditor
          program={program}
          row={editingCell.row}
          week={editingCell.week}
          day={editingCell.day}
          isCoach={isCoach}
          onUpdate={(updates) => {
            updateCell(editingCell.row, editingCell.week, editingCell.day, updates);
          }}
          onClose={() => setEditingCell(null)}
          insets={insets}
        />
      )}

      {hasChanges && !editingCell && (
        <Animated.View entering={FadeIn.duration(200)} style={[styles.saveBar, { paddingBottom: insets.bottom + 10 }]}>
          <View style={styles.saveBarDot} />
          <Text style={styles.saveBarText}>Unsaved changes</Text>
          <Pressable style={styles.saveBarButton} onPress={save}>
            <Text style={styles.saveBarButtonText}>Save</Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

function CellEditor({ program, row, week, day, isCoach, onUpdate, onClose, insets }: {
  program: Program;
  row: number;
  week: number;
  day: number;
  isCoach: boolean;
  onUpdate: (updates: Partial<CellData>) => void;
  onClose: () => void;
  insets: { bottom: number };
}) {
  const key = cellKey(row, week, day);
  const cell = program.cells[key] || getEmptyCell(row, week, day);

  const [exerciseName, setExerciseName] = useState(cell.exerciseName);
  const [prescription, setPrescription] = useState(cell.prescription);
  const [weight, setWeight] = useState(cell.weight);
  const [rpe, setRpe] = useState(cell.rpe);
  const [clientNotes, setClientNotes] = useState(cell.clientNotes);
  const [coachComment, setCoachComment] = useState(cell.coachComment);
  const [isCompleted, setIsCompleted] = useState(cell.isCompleted);

  const handleSave = () => {
    onUpdate({
      exerciseName,
      prescription,
      weight,
      rpe,
      clientNotes,
      coachComment,
      isCompleted,
      completedAt: isCompleted ? new Date().toISOString() : null,
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  return (
    <View style={styles.editorOverlay}>
      <Pressable style={styles.editorBackdrop} onPress={onClose} />
      <Animated.View entering={FadeIn.duration(200)} style={[styles.editorSheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.editorHandle} />
        <View style={styles.editorHeader}>
          <Text style={styles.editorTitle}>W{week} D{day} - Row {row + 1}</Text>
          <Pressable onPress={handleSave} hitSlop={8}>
            <Ionicons name="checkmark-circle" size={28} color={Colors.colors.primary} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.editorScroll}>
          <Text style={styles.editorLabel}>Exercise Name</Text>
          <TextInput
            style={styles.editorInput}
            value={exerciseName}
            onChangeText={setExerciseName}
            placeholder="e.g., Squat, Bench Press"
            placeholderTextColor={Colors.colors.textMuted}
          />

          <View style={styles.editorRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.editorLabel}>Prescription</Text>
              <TextInput
                style={styles.editorInput}
                value={prescription}
                onChangeText={setPrescription}
                placeholder="e.g., 5x5, 3x10"
                placeholderTextColor={Colors.colors.textMuted}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.editorLabel}>Weight</Text>
              <TextInput
                style={styles.editorInput}
                value={weight}
                onChangeText={setWeight}
                placeholder="e.g., 100kg"
                placeholderTextColor={Colors.colors.textMuted}
              />
            </View>
            <View style={{ width: 70 }}>
              <Text style={styles.editorLabel}>RPE</Text>
              <TextInput
                style={styles.editorInput}
                value={rpe}
                onChangeText={setRpe}
                placeholder="7"
                placeholderTextColor={Colors.colors.textMuted}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <Pressable
            style={[styles.completionToggle, isCompleted && styles.completionToggleActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setIsCompleted(!isCompleted);
            }}
          >
            <Ionicons
              name={isCompleted ? "checkmark-circle" : "ellipse-outline"}
              size={22}
              color={isCompleted ? Colors.colors.success : Colors.colors.textMuted}
            />
            <Text style={[styles.completionText, isCompleted && { color: Colors.colors.success }]}>
              {isCompleted ? 'Completed' : 'Mark as completed'}
            </Text>
          </Pressable>

          <Text style={styles.editorLabel}>
            <Ionicons name="chatbubble-outline" size={12} color={Colors.colors.textSecondary} /> Client Notes
          </Text>
          <TextInput
            style={[styles.editorInput, { minHeight: 50 }]}
            value={clientNotes}
            onChangeText={setClientNotes}
            placeholder="Client feedback, how it felt..."
            placeholderTextColor={Colors.colors.textMuted}
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.editorLabel}>
            <Ionicons name="school-outline" size={12} color={Colors.colors.accent} /> Coach Comment
          </Text>
          <TextInput
            style={[styles.editorInput, styles.coachInput, { minHeight: 50 }]}
            value={coachComment}
            onChangeText={setCoachComment}
            placeholder="Coach instructions/feedback..."
            placeholderTextColor={Colors.colors.textMuted}
            multiline
            textAlignVertical="top"
            editable={isCoach}
          />

          <Pressable style={styles.videoBtn} onPress={() => Alert.alert("Video", "Video recording will be available for form checks")}>
            <Ionicons name="videocam-outline" size={18} color={Colors.colors.primary} />
            <Text style={styles.videoBtnText}>
              {cell.videoUrl ? 'View Form Check Video' : 'Record Form Check Video'}
            </Text>
          </Pressable>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  headerCenter: { flex: 1 },
  headerTitle: { fontFamily: 'Rubik_700Bold', fontSize: 18, color: Colors.colors.text },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  headerSub: { fontFamily: 'Rubik_400Regular', fontSize: 11, color: Colors.colors.textSecondary },
  shareChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.colors.surfaceLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  shareChipText: { fontFamily: 'Rubik_500Medium', fontSize: 9, color: Colors.colors.textSecondary, letterSpacing: 1 },
  loadingText: { fontFamily: 'Rubik_400Regular', fontSize: 16, color: Colors.colors.textMuted },
  weekSelector: { borderBottomWidth: 1, borderBottomColor: Colors.colors.border, paddingBottom: 8 },
  weekScrollContent: { paddingHorizontal: 16, gap: 6, paddingVertical: 8 },
  weekChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: Colors.colors.backgroundCard, borderWidth: 1, borderColor: Colors.colors.border },
  weekChipActive: { backgroundColor: Colors.colors.primary, borderColor: Colors.colors.primary },
  weekChipText: { fontFamily: 'Rubik_500Medium', fontSize: 12, color: Colors.colors.textSecondary },
  weekChipTextActive: { color: '#fff' },
  weekProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginTop: 4 },
  weekProgressBar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: Colors.colors.surfaceLight, overflow: 'hidden' },
  weekProgressFill: { height: '100%', borderRadius: 2, backgroundColor: Colors.colors.success },
  weekProgressText: { fontFamily: 'Rubik_500Medium', fontSize: 10, color: Colors.colors.textSecondary, width: 28, textAlign: 'right' },

  gridContainer: { paddingHorizontal: 8, paddingTop: 8 },
  dayHeaderRow: { flexDirection: 'row', marginBottom: 4 },
  dayHeader: { width: CELL_WIDTH, alignItems: 'center', paddingVertical: 8 },
  dayHeaderText: { fontFamily: 'Rubik_600SemiBold', fontSize: 11, color: Colors.colors.textSecondary },
  rowLabel: { width: LABEL_COL_WIDTH, justifyContent: 'center', paddingHorizontal: 6, paddingVertical: 8 },
  rowLabelText: { fontFamily: 'Rubik_600SemiBold', fontSize: 10, color: Colors.colors.textMuted, textTransform: 'uppercase' },
  rowLabelExName: { fontFamily: 'Rubik_500Medium', fontSize: 11, color: Colors.colors.textSecondary },
  dataRow: { flexDirection: 'row', marginBottom: 2 },

  cell: {
    width: CELL_WIDTH, minHeight: 60, backgroundColor: Colors.colors.backgroundCard,
    borderRadius: 8, marginHorizontal: 2, padding: 6, justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.colors.border,
  },
  cellCompleted: { borderColor: Colors.colors.success, backgroundColor: 'rgba(52,199,89,0.06)' },
  cellEmpty: { alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' },
  cellExName: { fontFamily: 'Rubik_500Medium', fontSize: 10, color: Colors.colors.text, marginBottom: 1 },
  cellRx: { fontFamily: 'Rubik_400Regular', fontSize: 9, color: Colors.colors.textSecondary },
  cellWeight: { fontFamily: 'Rubik_600SemiBold', fontSize: 10, color: Colors.colors.primary },
  cellIcons: { flexDirection: 'row', gap: 3, marginTop: 3, alignItems: 'center' },
  cellRPE: { fontFamily: 'Rubik_500Medium', fontSize: 7, color: Colors.colors.accent, backgroundColor: Colors.colors.warningLight, paddingHorizontal: 3, paddingVertical: 1, borderRadius: 3 },

  addRowBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 12, marginTop: 8, borderWidth: 1, borderColor: Colors.colors.border, borderStyle: 'dashed', borderRadius: 8 },
  addRowText: { fontFamily: 'Rubik_500Medium', fontSize: 12, color: Colors.colors.primary },

  saveBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.colors.backgroundElevated, paddingHorizontal: 20, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: Colors.colors.border, gap: 8,
  },
  saveBarDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.colors.warning },
  saveBarText: { flex: 1, fontFamily: 'Rubik_400Regular', fontSize: 13, color: Colors.colors.textSecondary },
  saveBarButton: { backgroundColor: Colors.colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  saveBarButtonText: { fontFamily: 'Rubik_600SemiBold', fontSize: 14, color: '#fff' },

  editorOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 100 },
  editorBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  editorSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.colors.backgroundElevated, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '80%', paddingHorizontal: 20, paddingTop: 8,
  },
  editorHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.colors.border, alignSelf: 'center', marginBottom: 12 },
  editorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  editorTitle: { fontFamily: 'Rubik_700Bold', fontSize: 18, color: Colors.colors.text },
  editorScroll: {},
  editorLabel: { fontFamily: 'Rubik_600SemiBold', fontSize: 12, color: Colors.colors.textSecondary, marginBottom: 6, marginTop: 14 },
  editorInput: {
    fontFamily: 'Rubik_400Regular', fontSize: 14, color: Colors.colors.text,
    backgroundColor: Colors.colors.backgroundCard, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.colors.border,
  },
  editorRow: { flexDirection: 'row', gap: 8 },
  completionToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.colors.backgroundCard, borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: Colors.colors.border, marginTop: 14,
  },
  completionToggleActive: { borderColor: Colors.colors.success, backgroundColor: 'rgba(52,199,89,0.08)' },
  completionText: { fontFamily: 'Rubik_500Medium', fontSize: 14, color: Colors.colors.textMuted },
  coachInput: { borderColor: Colors.colors.accent, borderLeftWidth: 3 },
  videoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: Colors.colors.primary, borderRadius: 10, paddingVertical: 12, marginTop: 16, marginBottom: 20,
  },
  videoBtnText: { fontFamily: 'Rubik_500Medium', fontSize: 13, color: Colors.colors.primary },
});
