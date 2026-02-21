import { StyleSheet, Text, View, ScrollView, Pressable, Platform, TextInput, Linking, ActivityIndicator, Modal } from "react-native";
import { confirmAction, showAlert } from "@/lib/confirm";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState, useEffect, useMemo } from "react";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useVideoPlayer, VideoView } from "expo-video";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import Colors from "@/constants/colors";
import * as Crypto from "expo-crypto";
import { getProgram, updateProgram, deleteProgram, getProfile, getClients, addNotification, deleteNotificationsByProgram, getPRs, addPR, type Program, type Exercise, type WorkoutWeek, type WorkoutDay, type LiftPR } from "@/lib/storage";
import { uploadVideo, getVideoUrl, markVideoViewed } from "@/lib/api";

function VideoPlayerView({ videoUrl }: { videoUrl: string }) {
  const url = getVideoUrl(videoUrl);
  const player = useVideoPlayer(url, player => {
    player.loop = false;
  });

  return (
    <VideoView
      style={styles.videoPlayer}
      player={player}
      allowsFullscreen
      allowsPictureInPicture={false}
      contentFit="contain"
    />
  );
}

function VideoPlayerInline({ videoUrl, isCoach }: { videoUrl: string; isCoach?: boolean }) {
  const [showPlayer, setShowPlayer] = useState(false);

  if (!showPlayer) {
    return (
      <Pressable
        style={[styles.videoBtn, { borderColor: Colors.colors.success }]}
        onPress={() => {
          setShowPlayer(true);
          if (isCoach) {
            markVideoViewed(videoUrl);
          }
        }}
      >
        <Ionicons name="play-circle-outline" size={18} color={Colors.colors.success} />
        <Text style={[styles.videoBtnText, { color: Colors.colors.success }]}>View Video</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.videoPlayerContainer}>
      <View style={styles.videoPlayerHeader}>
        <Text style={styles.videoPlayerTitle}>Video Playback</Text>
        <Pressable onPress={() => setShowPlayer(false)} hitSlop={8}>
          <Ionicons name="close-circle" size={24} color={Colors.colors.textMuted} />
        </Pressable>
      </View>
      <VideoPlayerView videoUrl={videoUrl} />
    </View>
  );
}

function VideoRecordButton({ exercise, onVideoRecorded, programId, coachId, uploadedBy }: { exercise: Exercise; onVideoRecorded: (url: string) => void; programId: string; coachId: string; uploadedBy: string }) {
  const [uploading, setUploading] = useState(false);
  const [cameraPermission, requestCameraPermission] = ImagePicker.useCameraPermissions();

  const handleRecord = async () => {
    if (!cameraPermission?.granted) {
      if (cameraPermission?.status === 'denied' && !cameraPermission.canAskAgain) {
        if (Platform.OS !== 'web') {
          showAlert(
            "Camera Access Required",
            "Please enable camera access in your device settings to record videos."
          );
        }
        return;
      }
      const result = await requestCameraPermission();
      if (!result.granted) return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['videos'],
        videoMaxDuration: 45,
        videoQuality: ImagePicker.UIImagePickerControllerQualityType.High,
        allowsEditing: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      setUploading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const videoUri = result.assets[0].uri;
      const serverUrl = await uploadVideo(videoUri, { programId, exerciseId: exercise.id, uploadedBy, coachId });
      onVideoRecorded(serverUrl);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      showAlert("Error", "Failed to record or upload video. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const hasVideo = !!exercise.videoUrl;

  return (
    <View style={{ gap: 8, marginTop: 16 }}>
      <Pressable style={styles.videoBtn} onPress={handleRecord} disabled={uploading}>
        {uploading ? (
          <>
            <ActivityIndicator size="small" color={Colors.colors.primary} />
            <Text style={styles.videoBtnText}>Uploading...</Text>
          </>
        ) : (
          <>
            <Ionicons name="videocam-outline" size={18} color={Colors.colors.primary} />
            <Text style={styles.videoBtnText}>{hasVideo ? 'Re-record Video' : 'Record Video'}</Text>
          </>
        )}
      </Pressable>
      {hasVideo && (
        <VideoPlayerInline videoUrl={exercise.videoUrl} />
      )}
    </View>
  );
}

function ExerciseRow({ exercise, index, isCoach, onUpdate, onDelete, prevWeekExercise, programId, coachId, profileId }: {
  exercise: Exercise;
  index: number;
  isCoach: boolean;
  onUpdate: (updates: Partial<Exercise>) => void;
  onDelete: () => void;
  prevWeekExercise?: Exercise | null;
  programId: string;
  coachId: string;
  profileId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState(exercise.name);
  const [repsSets, setRepsSets] = useState(exercise.repsSets);
  const [weight, setWeight] = useState(exercise.weight);
  const [rpe, setRpe] = useState(exercise.rpe);
  const [notes, setNotes] = useState(exercise.notes);
  const [clientNotes, setClientNotes] = useState(exercise.clientNotes);
  const [coachComment, setCoachComment] = useState(exercise.coachComment);
  const [isCompleted, setIsCompleted] = useState(exercise.isCompleted);

  useEffect(() => {
    setName(exercise.name);
    setRepsSets(exercise.repsSets);
    setWeight(exercise.weight);
    setRpe(exercise.rpe);
    setNotes(exercise.notes);
    setClientNotes(exercise.clientNotes);
    setCoachComment(exercise.coachComment);
    setIsCompleted(exercise.isCompleted);
  }, [exercise]);

  const saveChanges = () => {
    onUpdate({
      name: isCoach ? name : exercise.name,
      repsSets: isCoach ? repsSets : exercise.repsSets,
      weight: isCoach ? weight : exercise.weight,
      rpe: isCoach ? rpe : exercise.rpe,
      notes,
      clientNotes: isCoach ? exercise.clientNotes : clientNotes,
      coachComment: isCoach ? coachComment : exercise.coachComment,
      isCompleted,
    });
  };

  const handleToggleComplete = () => {
    const newVal = !isCompleted;
    setIsCompleted(newVal);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onUpdate({ ...exercise, name, repsSets, weight, rpe, notes, clientNotes, coachComment, isCompleted: newVal });
  };

  return (
    <View style={[styles.exerciseRow, exercise.isCompleted && styles.exerciseRowCompleted]}>
      <Pressable
        style={styles.exerciseHeader}
        onPress={() => setExpanded(!expanded)}
        onLongPress={() => {
          if (!isCoach) return;
          confirmAction("Delete Exercise", `Remove "${exercise.name || 'this exercise'}"?`, onDelete, "Delete");
        }}
      >
        <View style={styles.exerciseHeaderLeft}>
          {!isCoach ? (
            <Pressable onPress={handleToggleComplete} hitSlop={6}>
              <Ionicons
                name={isCompleted ? "checkmark-circle" : "ellipse-outline"}
                size={22}
                color={isCompleted ? Colors.colors.success : Colors.colors.textMuted}
              />
            </Pressable>
          ) : (
            exercise.isCompleted ? (
              <Ionicons name="checkmark-circle" size={22} color={Colors.colors.success} />
            ) : (
              <View style={styles.exerciseNum}>
                <Text style={styles.exerciseNumText}>{index + 1}</Text>
              </View>
            )
          )}
          <View style={styles.exerciseHeaderInfo}>
            <Text style={[styles.exerciseName, !exercise.name && prevWeekExercise?.name ? styles.ghostText : null]} numberOfLines={1}>
              {exercise.name || prevWeekExercise?.name || `Exercise ${index + 1}`}
            </Text>
            <Text style={styles.exerciseMeta}>
              {exercise.repsSets || prevWeekExercise?.repsSets || '-'} {exercise.weight ? `@ ${exercise.weight}` : ''} {exercise.rpe ? `RPE ${exercise.rpe}` : ''}
            </Text>
          </View>
        </View>
        <View style={styles.exerciseHeaderRight}>
          {(exercise.coachComment || exercise.clientNotes) && (
            <Ionicons name="chatbubble" size={12} color={Colors.colors.accent} />
          )}
          {!!exercise.videoUrl && (
            <Ionicons name="videocam" size={12} color={Colors.colors.primary} />
          )}
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={Colors.colors.textMuted} />
        </View>
      </Pressable>

      {expanded && (
        <View style={styles.exerciseExpanded}>
          <Text style={styles.fieldLabel}>Exercise Name</Text>
          {isCoach ? (
            <TextInput
              style={styles.fieldInput}
              value={name}
              onChangeText={setName}
              onBlur={saveChanges}
              placeholder={prevWeekExercise?.name || "e.g., Squat"}
              placeholderTextColor={prevWeekExercise?.name ? Colors.colors.textGhost : Colors.colors.textMuted}
            />
          ) : (
            <View style={[styles.fieldInput, styles.readOnlyField]}>
              <Text style={[styles.readOnlyText, !name && prevWeekExercise?.name ? styles.ghostText : null]}>
                {name || prevWeekExercise?.name || 'No exercise name'}
              </Text>
            </View>
          )}

          <View style={styles.fieldRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Sets x Reps</Text>
              {isCoach ? (
                <TextInput
                  style={[styles.fieldInput, !repsSets && prevWeekExercise?.repsSets ? styles.ghostedInput : null]}
                  value={repsSets}
                  onChangeText={setRepsSets}
                  onBlur={saveChanges}
                  placeholder={prevWeekExercise?.repsSets || "e.g., 5x5"}
                  placeholderTextColor={prevWeekExercise?.repsSets ? Colors.colors.textGhost : Colors.colors.textMuted}
                />
              ) : (
                <View style={[styles.fieldInput, styles.readOnlyField]}>
                  <Text style={[styles.readOnlyText, !repsSets && prevWeekExercise?.repsSets ? styles.ghostText : null]}>
                    {repsSets || prevWeekExercise?.repsSets || '-'}
                  </Text>
                </View>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Weight</Text>
              {isCoach ? (
                <TextInput
                  style={styles.fieldInput}
                  value={weight}
                  onChangeText={setWeight}
                  onBlur={saveChanges}
                  placeholder={prevWeekExercise?.weight || "e.g., 100kg"}
                  placeholderTextColor={prevWeekExercise?.weight ? Colors.colors.textGhost : Colors.colors.textMuted}
                />
              ) : (
                <View style={[styles.fieldInput, styles.readOnlyField]}>
                  <Text style={[styles.readOnlyText, !weight && prevWeekExercise?.weight ? styles.ghostText : null]}>
                    {weight || prevWeekExercise?.weight || '-'}
                  </Text>
                </View>
              )}
            </View>
            <View style={{ width: 70 }}>
              <Text style={styles.fieldLabel}>RPE</Text>
              {isCoach ? (
                <TextInput
                  style={[styles.fieldInput, !rpe && prevWeekExercise?.rpe ? styles.ghostedInput : null]}
                  value={rpe}
                  onChangeText={setRpe}
                  onBlur={saveChanges}
                  placeholder={prevWeekExercise?.rpe || "7"}
                  placeholderTextColor={prevWeekExercise?.rpe ? Colors.colors.textGhost : Colors.colors.textMuted}
                  keyboardType="decimal-pad"
                />
              ) : (
                <View style={[styles.fieldInput, styles.readOnlyField]}>
                  <Text style={[styles.readOnlyText, !rpe && prevWeekExercise?.rpe ? styles.ghostText : null]}>
                    {rpe || prevWeekExercise?.rpe || '-'}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {!isCoach && (
            <Pressable
              style={[styles.completionToggle, isCompleted && styles.completionToggleActive]}
              onPress={handleToggleComplete}
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
          )}
          {isCoach && exercise.isCompleted && (
            <View style={[styles.completionToggle, styles.completionToggleActive]}>
              <Ionicons name="checkmark-circle" size={22} color={Colors.colors.success} />
              <Text style={[styles.completionText, { color: Colors.colors.success }]}>Client completed this</Text>
            </View>
          )}

          <Text style={styles.fieldLabel}>
            <Ionicons name="chatbubble-outline" size={12} color={Colors.colors.textSecondary} /> Client Notes
          </Text>
          {isCoach ? (
            <View style={[styles.fieldInput, styles.readOnlyField]}>
              <Text style={styles.readOnlyText}>{clientNotes || 'No client notes yet'}</Text>
            </View>
          ) : (
            <TextInput
              style={[styles.fieldInput, { minHeight: 50 }]}
              value={clientNotes}
              onChangeText={setClientNotes}
              onBlur={saveChanges}
              placeholder="How it felt, feedback..."
              placeholderTextColor={Colors.colors.textMuted}
              multiline
              textAlignVertical="top"
            />
          )}

          <Text style={styles.fieldLabel}>
            <Ionicons name="school-outline" size={12} color={Colors.colors.accent} /> Coach Comment
          </Text>
          {isCoach ? (
            <TextInput
              style={[styles.fieldInput, styles.coachInput, { minHeight: 50 }]}
              value={coachComment}
              onChangeText={setCoachComment}
              onBlur={saveChanges}
              placeholder="Instructions/feedback..."
              placeholderTextColor={Colors.colors.textMuted}
              multiline
              textAlignVertical="top"
            />
          ) : (
            <View style={[styles.fieldInput, styles.coachInput, styles.readOnlyField]}>
              <Text style={styles.readOnlyText}>{coachComment || 'No coach comments yet'}</Text>
            </View>
          )}

          {!isCoach && (
            <VideoRecordButton
              exercise={exercise}
              programId={programId}
              coachId={coachId}
              uploadedBy={profileId}
              onVideoRecorded={(url) => {
                onUpdate({ videoUrl: url });
              }}
            />
          )}
          {isCoach && !!exercise.videoUrl && (
            <VideoPlayerInline videoUrl={exercise.videoUrl} isCoach={true} />
          )}
        </View>
      )}
    </View>
  );
}

export default function ProgramDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [program, setProgram] = useState<Program | null>(null);
  const [activeWeek, setActiveWeek] = useState(1);
  const [activeDay, setActiveDay] = useState(1);
  const [hasChanges, setHasChanges] = useState(false);
  const [isCoach, setIsCoach] = useState(true);
  const [profileId, setProfileId] = useState('');

  useEffect(() => {
    if (id) {
      Promise.all([getProgram(id), getProfile()]).then(([p, prof]) => {
        if (p) setProgram(p);
        setIsCoach(prof.role === 'coach');
        setProfileId(prof.id);
        deleteNotificationsByProgram(id).catch(() => {});
      });
    }
  }, [id]);

  const save = useCallback(async () => {
    if (!program) return;
    const oldProgram = await getProgram(program.id);

    await updateProgram(program);
    setHasChanges(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (oldProgram) {
      let targetProfileId: string | undefined;
      if (!isCoach) {
        targetProfileId = program.coachId;
      } else if (program.clientId) {
        const allClients = await getClients();
        const clientRecord = allClients.find(c => c.id === program.clientId);
        targetProfileId = clientRecord?.clientProfileId;
      }

      for (const week of program.weeks) {
        for (const day of week.days) {
          for (const ex of day.exercises) {
            const oldWeek = oldProgram.weeks.find(w => w.weekNumber === week.weekNumber);
            const oldDay = oldWeek?.days.find(d => d.dayNumber === day.dayNumber);
            const oldEx = oldDay?.exercises.find(e => e.id === ex.id);
            if (!oldEx || !ex.name) continue;

            if (!isCoach) {
              if (ex.clientNotes && ex.clientNotes !== oldEx.clientNotes) {
                addNotification({
                  targetProfileId,
                  type: 'notes',
                  title: 'New Client Notes',
                  message: `Notes added on ${ex.name}: "${ex.clientNotes.slice(0, 60)}"`,
                  programId: program.id,
                  programTitle: program.title,
                  exerciseName: ex.name,
                  fromRole: 'client',
                });
              }
              if (ex.videoUrl && ex.videoUrl !== oldEx.videoUrl) {
                addNotification({
                  targetProfileId,
                  type: 'video',
                  title: 'Form Check Video',
                  message: `Video uploaded for ${ex.name}`,
                  programId: program.id,
                  programTitle: program.title,
                  exerciseName: ex.name,
                  fromRole: 'client',
                });
              }
              if (ex.isCompleted && !oldEx.isCompleted) {
                addNotification({
                  targetProfileId,
                  type: 'completion',
                  title: 'Exercise Completed',
                  message: `${ex.name} marked as completed`,
                  programId: program.id,
                  programTitle: program.title,
                  exerciseName: ex.name,
                  fromRole: 'client',
                });
              }
            } else {
              if (ex.coachComment && ex.coachComment !== oldEx.coachComment) {
                addNotification({
                  targetProfileId,
                  type: 'comment',
                  title: 'New Coach Feedback',
                  message: `Coach commented on ${ex.name}: "${ex.coachComment.slice(0, 60)}"`,
                  programId: program.id,
                  programTitle: program.title,
                  exerciseName: ex.name,
                  fromRole: 'coach',
                });
              }
            }
          }
        }
      }
    }

    if (!isCoach) {
      try {
        const profile = await getProfile();
        const existingPRs = await getPRs();
        const liftKeywords: Record<string, 'squat' | 'bench' | 'deadlift'> = {
          'squat': 'squat', 'back squat': 'squat', 'front squat': 'squat',
          'bench': 'bench', 'bench press': 'bench', 'flat bench': 'bench',
          'deadlift': 'deadlift', 'sumo deadlift': 'deadlift', 'conventional deadlift': 'deadlift',
        };
        for (const week of program.weeks) {
          for (const day of week.days) {
            for (const ex of day.exercises) {
              if (!ex.name || !ex.weight || !ex.isCompleted) continue;
              const exNameLower = ex.name.toLowerCase().trim();
              let liftType: 'squat' | 'bench' | 'deadlift' | null = null;
              for (const [keyword, type] of Object.entries(liftKeywords)) {
                if (exNameLower.includes(keyword)) { liftType = type; break; }
              }
              if (!liftType) continue;
              const weightNum = parseFloat(ex.weight);
              if (isNaN(weightNum) || weightNum <= 0) continue;
              const bestExisting = existingPRs.filter(p => p.liftType === liftType);
              const currentBest = bestExisting.length > 0
                ? Math.max(...bestExisting.map(p => p.weight))
                : 0;
              if (weightNum > currentBest) {
                await addPR({
                  liftType,
                  weight: weightNum,
                  unit: profile.weightUnit as 'kg' | 'lbs',
                  date: new Date().toISOString().split('T')[0],
                  notes: `Auto-logged from ${program.title} - ${ex.name}`,
                });
              }
            }
          }
        }
      } catch (e) {
        console.warn('Auto-PR logging failed:', e);
      }
    }
  }, [program, isCoach]);

  const addWeek = useCallback(() => {
    if (!program) return;
    const lastWeek = program.weeks[program.weeks.length - 1];
    const newWeekNumber = lastWeek ? lastWeek.weekNumber + 1 : 1;
    const daysPerWeek = lastWeek ? lastWeek.days.length : program.daysPerWeek;
    const newDays: WorkoutDay[] = [];
    for (let d = 1; d <= daysPerWeek; d++) {
      const templateDay = lastWeek?.days.find(day => day.dayNumber === d);
      newDays.push({
        dayNumber: d,
        exercises: templateDay
          ? templateDay.exercises.map(ex => ({
              id: Crypto.randomUUID(),
              name: ex.name,
              repsSets: ex.repsSets,
              weight: '',
              rpe: '',
              isCompleted: false,
              notes: ex.notes,
              clientNotes: '',
              coachComment: '',
              videoUrl: '',
            }))
          : [],
      });
    }
    const newWeek: WorkoutWeek = { weekNumber: newWeekNumber, days: newDays };
    setProgram({ ...program, weeks: [...program.weeks, newWeek] });
    setActiveWeek(newWeekNumber);
    setHasChanges(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [program]);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleDeleteProgram = async () => {
    if (deleteInput !== 'DELETE' || !program) return;
    setDeleting(true);
    try {
      await deleteProgram(program.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setShowDeleteModal(false);
      router.back();
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to delete program');
    }
    setDeleting(false);
  };

  const currentWeek = program?.weeks.find(w => w.weekNumber === activeWeek);
  const currentDay = currentWeek?.days.find(d => d.dayNumber === activeDay);
  const exercises = currentDay?.exercises || [];

  const prevWeekDay = useMemo(() => {
    if (!program || activeWeek <= 1) return null;
    const prevWeek = program.weeks.find(w => w.weekNumber === activeWeek - 1);
    return prevWeek?.days.find(d => d.dayNumber === activeDay) || null;
  }, [program, activeWeek, activeDay]);

  const weekProgress = useMemo(() => {
    if (!currentWeek) return 0;
    let total = 0;
    let completed = 0;
    for (const day of currentWeek.days) {
      for (const ex of day.exercises) {
        if (ex.name) {
          total++;
          if (ex.isCompleted) completed++;
        }
      }
    }
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  }, [currentWeek]);

  const updateExercise = useCallback((exerciseId: string, updates: Partial<Exercise>) => {
    if (!program) return;

    const currentDay = program.weeks
      .find(w => w.weekNumber === activeWeek)?.days
      .find(d => d.dayNumber === activeDay);
    const exerciseIndex = currentDay?.exercises.findIndex(e => e.id === exerciseId) ?? -1;
    const oldExercise = currentDay?.exercises[exerciseIndex];
    const nameChanged = updates.name !== undefined && oldExercise && updates.name !== oldExercise.name;

    const updatedWeeks = program.weeks.map(week => {
      if (week.weekNumber === activeWeek) {
        return {
          ...week,
          days: week.days.map(day => {
            if (day.dayNumber !== activeDay) return day;
            return {
              ...day,
              exercises: day.exercises.map(ex =>
                ex.id === exerciseId ? { ...ex, ...updates } : ex
              ),
            };
          }),
        };
      }
      if (nameChanged && week.weekNumber > activeWeek && exerciseIndex >= 0) {
        return {
          ...week,
          days: week.days.map(day => {
            if (day.dayNumber !== activeDay) return day;
            const targetEx = day.exercises[exerciseIndex];
            if (!targetEx) return day;
            const shouldUpdate = !targetEx.name || targetEx.name === oldExercise.name;
            if (!shouldUpdate) return day;
            return {
              ...day,
              exercises: day.exercises.map((ex, i) =>
                i === exerciseIndex ? { ...ex, name: updates.name! } : ex
              ),
            };
          }),
        };
      }
      return week;
    });
    setProgram({ ...program, weeks: updatedWeeks });
    setHasChanges(true);
  }, [program, activeWeek, activeDay]);

  const deleteExercise = useCallback((exerciseId: string) => {
    if (!program) return;
    const updatedWeeks = program.weeks.map(week => {
      if (week.weekNumber !== activeWeek) return week;
      return {
        ...week,
        days: week.days.map(day => {
          if (day.dayNumber !== activeDay) return day;
          return {
            ...day,
            exercises: day.exercises.filter(ex => ex.id !== exerciseId),
          };
        }),
      };
    });
    setProgram({ ...program, weeks: updatedWeeks });
    setHasChanges(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [program, activeWeek, activeDay]);

  const addExercise = useCallback(() => {
    if (!program) return;
    const newExercise: Exercise = {
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
    };
    const updatedWeeks = program.weeks.map(week => {
      if (week.weekNumber !== activeWeek) return week;
      return {
        ...week,
        days: week.days.map(day => {
          if (day.dayNumber !== activeDay) return day;
          return { ...day, exercises: [...day.exercises, newExercise] };
        }),
      };
    });
    setProgram({ ...program, weeks: updatedWeeks });
    setHasChanges(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [program, activeWeek, activeDay]);

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
              confirmAction("Unsaved Changes", "You have unsaved changes. Discard them?", () => router.back(), "Discard");
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
            <Text style={styles.headerSub}>{program.weeks.length}W x {program.daysPerWeek}D</Text>
            <View style={styles.shareChip}>
              <Ionicons name="share-outline" size={10} color={Colors.colors.textSecondary} />
              <Text style={styles.shareChipText}>{program.shareCode}</Text>
            </View>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable onPress={() => { setDeleteInput(''); setShowDeleteModal(true); }} hitSlop={8} accessibilityLabel="Delete program" accessibilityRole="button">
            <Ionicons name="trash-outline" size={22} color={Colors.colors.danger} />
          </Pressable>
          <Pressable onPress={save} hitSlop={8}>
            <Ionicons name="checkmark-circle" size={26} color={hasChanges ? Colors.colors.primary : Colors.colors.textMuted} />
          </Pressable>
        </View>
      </View>

      <View style={styles.weekSelector}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekScrollContent}>
          {program.weeks.map(week => (
            <Pressable
              key={week.weekNumber}
              style={[styles.weekChip, activeWeek === week.weekNumber && styles.weekChipActive]}
              onPress={() => { Haptics.selectionAsync(); setActiveWeek(week.weekNumber); setActiveDay(1); }}
            >
              <Text style={[styles.weekChipText, activeWeek === week.weekNumber && styles.weekChipTextActive]}>
                W{week.weekNumber}
              </Text>
            </Pressable>
          ))}
          {isCoach && (
            <Pressable style={styles.addWeekChip} onPress={addWeek} accessibilityLabel="Add week" accessibilityRole="button">
              <Ionicons name="add" size={16} color={Colors.colors.primary} />
            </Pressable>
          )}
        </ScrollView>
        <View style={styles.weekProgressRow}>
          <View style={styles.weekProgressBar}>
            <View style={[styles.weekProgressFill, { width: `${weekProgress}%` }]} />
          </View>
          <Text style={styles.weekProgressText}>{weekProgress}%</Text>
        </View>
      </View>

      <View style={styles.daySelector}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayScrollContent}>
          {(currentWeek?.days || []).map(day => (
            <Pressable
              key={day.dayNumber}
              style={[styles.dayChip, activeDay === day.dayNumber && styles.dayChipActive]}
              onPress={() => { Haptics.selectionAsync(); setActiveDay(day.dayNumber); }}
            >
              <Text style={[styles.dayChipText, activeDay === day.dayNumber && styles.dayChipTextActive]}>
                Day {day.dayNumber}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + (hasChanges ? 80 : 20), paddingHorizontal: 16, paddingTop: 8 }}
      >
        {exercises.length === 0 ? (
          <View style={styles.emptyDay}>
            <Ionicons name="barbell-outline" size={32} color={Colors.colors.textMuted} />
            <Text style={styles.emptyDayText}>No exercises for this day</Text>
          </View>
        ) : (
          exercises.map((ex, idx) => (
            <Animated.View key={ex.id} entering={FadeInDown.delay(idx * 40).duration(250)}>
              <ExerciseRow
                exercise={ex}
                index={idx}
                isCoach={isCoach}
                onUpdate={(updates) => updateExercise(ex.id, updates)}
                onDelete={() => deleteExercise(ex.id)}
                prevWeekExercise={prevWeekDay?.exercises[idx] || null}
                programId={program.id}
                coachId={program.coachId}
                profileId={profileId}
              />
            </Animated.View>
          ))
        )}

        {isCoach && (
          <Pressable style={styles.addExerciseBtn} onPress={addExercise}>
            <Ionicons name="add" size={16} color={Colors.colors.primary} />
            <Text style={styles.addExerciseText}>Add Exercise</Text>
          </Pressable>
        )}
      </ScrollView>

      {hasChanges && (
        <Animated.View entering={FadeIn.duration(200)} style={[styles.saveBar, { paddingBottom: insets.bottom + 10 }]}>
          <View style={styles.saveBarDot} />
          <Text style={styles.saveBarText}>Unsaved changes</Text>
          <Pressable style={styles.saveBarButton} onPress={save}>
            <Text style={styles.saveBarButtonText}>Save</Text>
          </Pressable>
        </Animated.View>
      )}

      <Modal visible={showDeleteModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Ionicons name="warning" size={40} color={Colors.colors.danger} />
            <Text style={styles.modalTitle}>Delete Program</Text>
            <Text style={styles.modalMessage}>
              This will permanently delete "{program.title}" and all its exercises, progress, and associated data. This action cannot be undone.
            </Text>
            <Text style={styles.modalPrompt}>Type DELETE to confirm:</Text>
            <TextInput
              style={styles.modalInput}
              value={deleteInput}
              onChangeText={setDeleteInput}
              placeholder="Type DELETE"
              placeholderTextColor={Colors.colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              accessibilityLabel="Type DELETE to confirm program deletion"
            />
            <View style={styles.modalButtons}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setShowDeleteModal(false)} accessibilityLabel="Cancel" accessibilityRole="button">
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalDeleteBtn, deleteInput !== 'DELETE' && styles.modalDeleteBtnDisabled]}
                onPress={handleDeleteProgram}
                disabled={deleteInput !== 'DELETE' || deleting}
                accessibilityLabel="Delete program permanently"
                accessibilityRole="button"
              >
                <Text style={styles.modalDeleteText}>{deleting ? 'Deleting...' : 'Delete Forever'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  weekProgressBar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: Colors.colors.surfaceLight, overflow: 'hidden' as const },
  weekProgressFill: { height: '100%' as const, borderRadius: 2, backgroundColor: Colors.colors.success },
  weekProgressText: { fontFamily: 'Rubik_500Medium', fontSize: 10, color: Colors.colors.textSecondary, width: 28, textAlign: 'right' },
  daySelector: { borderBottomWidth: 1, borderBottomColor: Colors.colors.border },
  dayScrollContent: { paddingHorizontal: 16, gap: 6, paddingVertical: 8 },
  dayChip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 12, backgroundColor: Colors.colors.backgroundCard, borderWidth: 1, borderColor: Colors.colors.border },
  dayChipActive: { backgroundColor: Colors.colors.accent, borderColor: Colors.colors.accent },
  dayChipText: { fontFamily: 'Rubik_500Medium', fontSize: 12, color: Colors.colors.textSecondary },
  dayChipTextActive: { color: '#fff' },
  emptyDay: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyDayText: { fontFamily: 'Rubik_400Regular', fontSize: 13, color: Colors.colors.textMuted },
  exerciseRow: {
    backgroundColor: Colors.colors.backgroundCard, borderRadius: 12, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.colors.border, overflow: 'hidden',
  },
  exerciseRowCompleted: { borderColor: Colors.colors.success, backgroundColor: 'rgba(52,199,89,0.06)' },
  exerciseHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, gap: 10,
  },
  exerciseHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  exerciseNum: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.colors.surfaceLight,
    alignItems: 'center', justifyContent: 'center',
  },
  exerciseNumText: { fontFamily: 'Rubik_600SemiBold', fontSize: 11, color: Colors.colors.textSecondary },
  exerciseHeaderInfo: { flex: 1 },
  exerciseName: { fontFamily: 'Rubik_600SemiBold', fontSize: 14, color: Colors.colors.text },
  exerciseMeta: { fontFamily: 'Rubik_400Regular', fontSize: 11, color: Colors.colors.textSecondary, marginTop: 2 },
  exerciseHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  exerciseExpanded: { paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: Colors.colors.border },
  fieldLabel: { fontFamily: 'Rubik_600SemiBold', fontSize: 12, color: Colors.colors.textSecondary, marginBottom: 6, marginTop: 14 },
  fieldInput: {
    fontFamily: 'Rubik_400Regular', fontSize: 14, color: Colors.colors.text,
    backgroundColor: Colors.colors.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.colors.border,
  },
  fieldRow: { flexDirection: 'row', gap: 8 },
  readOnlyField: { backgroundColor: Colors.colors.surfaceLight },
  readOnlyText: { fontFamily: 'Rubik_400Regular', fontSize: 13, color: Colors.colors.textMuted },
  ghostedInput: { borderColor: 'rgba(232, 81, 47, 0.2)' },
  ghostText: { color: Colors.colors.textGhost, fontStyle: 'italic' },
  completionToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.colors.surface, borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: Colors.colors.border, marginTop: 14,
  },
  completionToggleActive: { borderColor: Colors.colors.success, backgroundColor: 'rgba(52,199,89,0.08)' },
  completionText: { fontFamily: 'Rubik_500Medium', fontSize: 14, color: Colors.colors.textMuted },
  coachInput: { borderColor: Colors.colors.accent, borderLeftWidth: 3 },
  videoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: Colors.colors.primary, borderRadius: 10, paddingVertical: 12, marginTop: 16,
  },
  videoBtnText: { fontFamily: 'Rubik_500Medium', fontSize: 13, color: Colors.colors.primary },
  videoPlayerContainer: {
    marginTop: 16, borderRadius: 12, overflow: 'hidden',
    backgroundColor: '#000', borderWidth: 1, borderColor: Colors.colors.border,
  },
  videoPlayerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.colors.backgroundCard,
  },
  videoPlayerTitle: { fontFamily: 'Rubik_500Medium', fontSize: 13, color: Colors.colors.text },
  videoPlayer: { width: '100%', height: 220 },
  addExerciseBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 14, marginTop: 8, borderWidth: 1, borderColor: Colors.colors.border,
    borderStyle: 'dashed', borderRadius: 10,
  },
  addExerciseText: { fontFamily: 'Rubik_500Medium', fontSize: 13, color: Colors.colors.primary },
  saveBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.colors.backgroundElevated, paddingHorizontal: 20, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: Colors.colors.border, gap: 8,
  },
  saveBarDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.colors.warning },
  saveBarText: { flex: 1, fontFamily: 'Rubik_400Regular', fontSize: 13, color: Colors.colors.textSecondary },
  saveBarButton: { backgroundColor: Colors.colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  saveBarButtonText: { fontFamily: 'Rubik_600SemiBold', fontSize: 14, color: '#fff' },
  addWeekChip: {
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.colors.primary, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: Colors.colors.backgroundCard, borderRadius: 12, padding: 28,
    width: '100%', maxWidth: 360, alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: Colors.colors.border,
  },
  modalTitle: { fontFamily: 'Rubik_700Bold', fontSize: 22, color: Colors.colors.danger },
  modalMessage: { fontFamily: 'Rubik_400Regular', fontSize: 14, color: Colors.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  modalPrompt: { fontFamily: 'Rubik_600SemiBold', fontSize: 14, color: Colors.colors.text, marginTop: 8 },
  modalInput: {
    fontFamily: 'Rubik_600SemiBold', fontSize: 18, color: Colors.colors.danger, textAlign: 'center',
    backgroundColor: Colors.colors.surface, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12,
    width: '100%', borderWidth: 1, borderColor: Colors.colors.border, letterSpacing: 4,
  },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8, width: '100%' },
  modalCancelBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 12,
    backgroundColor: Colors.colors.surfaceLight,
  },
  modalCancelText: { fontFamily: 'Rubik_600SemiBold', fontSize: 15, color: Colors.colors.text },
  modalDeleteBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 12,
    backgroundColor: Colors.colors.danger,
  },
  modalDeleteBtnDisabled: { opacity: 0.4 },
  modalDeleteText: { fontFamily: 'Rubik_600SemiBold', fontSize: 15, color: '#fff' },
});
