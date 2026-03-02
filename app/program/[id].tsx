import { StyleSheet, Text, View, ScrollView, Pressable, Platform, TextInput, Linking, ActivityIndicator, Modal } from "react-native";
import { confirmAction, showAlert } from "@/lib/confirm";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState, useEffect, useMemo, useRef } from "react";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useVideoPlayer, VideoView } from "expo-video";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import Colors from "@/constants/colors";
import { useTheme } from "@/lib/theme-context";
import * as Crypto from "expo-crypto";
import { getProgram, updateProgram, deleteProgram, getProfile, getClients, addNotification, markNotificationsReadByProgram, getPRs, addPR, assignProgramToClient, type Program, type Exercise, type WorkoutWeek, type WorkoutDay, type LiftPR, type UserProfile, type ClientInfo } from "@/lib/storage";
import { uploadVideo, getVideoUrl, getDirectVideoUrl, markVideoViewed } from "@/lib/api";
import { trimResult } from "@/lib/trim-result";

function VideoPlayerView({ videoUrl }: { videoUrl: string }) {
  const { colors } = useTheme();
  const [directUrl, setDirectUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDirectVideoUrl(videoUrl)
      .then(url => { if (!cancelled) setDirectUrl(url); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [videoUrl]);

  const player = useVideoPlayer(directUrl, player => {
    player.loop = false;
  });

  if (error) {
    return (
      <View style={[styles.videoPlayer, { alignItems: 'center', justifyContent: 'center' }]}>
        <Ionicons name="alert-circle-outline" size={32} color={colors.danger} />
        <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 6, fontFamily: 'Rubik_400Regular' }}>Video unavailable</Text>
      </View>
    );
  }

  if (!directUrl) {
    return (
      <View style={[styles.videoPlayer, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    <VideoView
      style={styles.videoPlayer}
      player={player}
      nativeControls={true}
      contentFit="contain"
    />
  );
}

function VideoPlayerInline({ videoUrl, isCoach }: { videoUrl: string; isCoach?: boolean }) {
  const { colors } = useTheme();
  const [showPlayer, setShowPlayer] = useState(false);

  if (!showPlayer) {
    return (
      <Pressable
        style={[styles.videoBtn, { borderColor: colors.success }]}
        onPress={() => {
          setShowPlayer(true);
          if (isCoach) {
            markVideoViewed(videoUrl);
          }
        }}
      >
        <Ionicons name="play-circle-outline" size={18} color={colors.success} />
        <Text style={[styles.videoBtnText, { color: colors.success }]}>View Video</Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.videoPlayerContainer, { borderColor: colors.border }]}>
      <View style={[styles.videoPlayerHeader, { backgroundColor: colors.backgroundCard }]}>
        <Text style={[styles.videoPlayerTitle, { color: colors.text }]}>Video Playback</Text>
        <Pressable onPress={() => setShowPlayer(false)} hitSlop={8}>
          <Ionicons name="close-circle" size={24} color={colors.textMuted} />
        </Pressable>
      </View>
      <VideoPlayerView videoUrl={videoUrl} />
    </View>
  );
}

function VideoRecordButton({ exercise, onVideoRecorded, onVideoDeleted, programId, coachId, uploadedBy }: { exercise: Exercise; onVideoRecorded: (url: string) => void; onVideoDeleted: () => void; programId: string; coachId: string; uploadedBy: string }) {
  const { colors } = useTheme();
  const [uploading, setUploading] = useState(false);
  const [cameraPermission, requestCameraPermission] = ImagePicker.useCameraPermissions();

  const launchRecorder = async () => {
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
        videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const duration = asset.duration || 0;
      
      router.push({
        pathname: '/trim-video',
        params: {
          videoUri: asset.uri,
          videoDuration: String(duration),
          programId,
          exerciseId: exercise.id,
          uploadedBy,
          coachId,
          exerciseName: exercise.name || 'Exercise',
        },
      });
    } catch (err: any) {
      showAlert("Error", "Failed to open camera. Please try again.");
    }
  };

  const handleRecord = () => {
    if (Platform.OS === 'web') {
      launchRecorder();
      return;
    }
    Alert.alert(
      "Heads Up",
      "Recording video will temporarily pause background music. Your music will resume after you finish recording.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Record", style: "default", onPress: () => launchRecorder() },
      ]
    );
  };

  const handleDelete = () => {
    confirmAction(
      "Delete Video",
      "Are you sure you want to remove this video?",
      () => {
        onVideoDeleted();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    );
  };

  const hasVideo = !!exercise.videoUrl;

  return (
    <View style={{ gap: 8, marginTop: 16 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable style={[styles.videoBtn, { flex: 1, borderColor: colors.primary }]} onPress={handleRecord} disabled={uploading}>
          {uploading ? (
            <>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.videoBtnText, { color: colors.primary }]}>Uploading...</Text>
            </>
          ) : (
            <>
              <Ionicons name="videocam-outline" size={18} color={colors.primary} />
              <Text style={[styles.videoBtnText, { color: colors.primary }]}>{hasVideo ? 'Re-record' : 'Record Video'}</Text>
            </>
          )}
        </Pressable>
        {hasVideo && (
          <Pressable style={[styles.videoDeleteBtn, { borderColor: colors.danger }]} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
          </Pressable>
        )}
      </View>
      {hasVideo && (
        <VideoPlayerInline videoUrl={exercise.videoUrl} />
      )}
    </View>
  );
}

function ExerciseRow({ exercise, index, isCoach, isShared, onUpdate, onDelete, prevWeekExercise, programId, coachId, profileId, initialExpanded, planLocked }: {
  exercise: Exercise;
  index: number;
  isCoach: boolean;
  isShared: boolean;
  onUpdate: (updates: Partial<Exercise>) => void;
  onDelete: () => void;
  prevWeekExercise?: Exercise | null;
  programId: string;
  coachId: string;
  profileId: string;
  initialExpanded?: boolean;
  planLocked?: boolean;
}) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(initialExpanded || false);
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

  const canEditAll = (isCoach || !isShared) && !planLocked;

  const saveChanges = () => {
    onUpdate({
      name: canEditAll ? name : exercise.name,
      repsSets: canEditAll ? repsSets : exercise.repsSets,
      weight: canEditAll ? weight : exercise.weight,
      rpe: canEditAll ? rpe : exercise.rpe,
      notes,
      clientNotes: (isCoach && isShared) ? exercise.clientNotes : clientNotes,
      coachComment: (isCoach && isShared) ? coachComment : exercise.coachComment,
      isCompleted,
    });
  };

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (planLocked) return;
    if (isCoach && isShared) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      if (!isShared) {
        onUpdate({ name, repsSets, weight, rpe, notes, clientNotes, isCompleted });
      } else {
        onUpdate({ clientNotes, isCompleted });
      }
    }, 1000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [clientNotes, isCompleted, ...(!isShared ? [name, repsSets, weight, rpe, notes] : [])]);

  const handleToggleComplete = () => {
    const newVal = !isCompleted;
    setIsCompleted(newVal);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View style={[styles.exerciseRow, { backgroundColor: colors.backgroundCard, borderColor: colors.border }, exercise.isCompleted && [styles.exerciseRowCompleted, { borderColor: colors.success }]]}>
      <Pressable
        style={styles.exerciseHeader}
        onPress={() => setExpanded(!expanded)}
        onLongPress={() => {
          if (!canEditAll) return;
          confirmAction("Delete Exercise", `Remove "${exercise.name || 'this exercise'}"?`, onDelete, "Delete");
        }}
      >
        <View style={styles.exerciseHeaderLeft}>
          {(!isCoach || !isShared) ? (
            <Pressable onPress={handleToggleComplete} hitSlop={6}>
              <Ionicons
                name={isCompleted ? "checkmark-circle" : "ellipse-outline"}
                size={22}
                color={isCompleted ? colors.success : colors.textMuted}
              />
            </Pressable>
          ) : (
            exercise.isCompleted ? (
              <Ionicons name="checkmark-circle" size={22} color={colors.success} />
            ) : (
              <View style={[styles.exerciseNum, { backgroundColor: colors.surfaceLight }]}>
                <Text style={[styles.exerciseNumText, { color: colors.textSecondary }]}>{index + 1}</Text>
              </View>
            )
          )}
          <View style={styles.exerciseHeaderInfo}>
            <Text style={[styles.exerciseName, { color: colors.text }, !exercise.name && prevWeekExercise?.name ? [styles.ghostText, { color: colors.textGhost }] : null]} numberOfLines={1}>
              {exercise.name || prevWeekExercise?.name || `Exercise ${index + 1}`}
            </Text>
            <Text style={[styles.exerciseMeta, { color: colors.textSecondary }]}>
              {exercise.repsSets || prevWeekExercise?.repsSets || '-'} {exercise.weight ? `@ ${exercise.weight}` : ''} {exercise.rpe ? `RPE ${exercise.rpe}` : ''}
            </Text>
          </View>
        </View>
        <View style={styles.exerciseHeaderRight}>
          {Platform.OS === 'web' && canEditAll && (
            <Pressable
              style={styles.exerciseWebDeleteBtn}
              onPress={(e) => { e.stopPropagation(); confirmAction("Delete Exercise", `Remove "${exercise.name || 'this exercise'}"?`, onDelete, "Delete"); }}
              hitSlop={4}
            >
              <Ionicons name="trash-outline" size={14} color={colors.textMuted} />
            </Pressable>
          )}
          {(exercise.coachComment || exercise.clientNotes) && (
            <Ionicons name="chatbubble" size={12} color={colors.accent} />
          )}
          {!!exercise.videoUrl && (
            <Ionicons name="videocam" size={12} color={colors.primary} />
          )}
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
        </View>
      </Pressable>

      {expanded && (
        <View style={[styles.exerciseExpanded, { borderTopColor: colors.border }]}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Exercise Name</Text>
          {canEditAll ? (
            <TextInput
              style={[styles.fieldInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
              value={name}
              onChangeText={setName}
              onBlur={saveChanges}
              placeholder={prevWeekExercise?.name || "e.g., Squat"}
              placeholderTextColor={prevWeekExercise?.name ? colors.textGhost : colors.textMuted}
            />
          ) : (
            <View style={[styles.fieldInput, styles.readOnlyField, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}>
              <Text style={[styles.readOnlyText, { color: colors.textMuted }, !name && prevWeekExercise?.name ? [styles.ghostText, { color: colors.textGhost }] : null]}>
                {name || prevWeekExercise?.name || 'No exercise name'}
              </Text>
            </View>
          )}

          <View style={styles.fieldRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Sets x Reps</Text>
              {canEditAll ? (
                <TextInput
                  style={[styles.fieldInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }, !repsSets && prevWeekExercise?.repsSets ? styles.ghostedInput : null]}
                  value={repsSets}
                  onChangeText={setRepsSets}
                  onBlur={saveChanges}
                  placeholder={prevWeekExercise?.repsSets || "e.g., 5x5"}
                  placeholderTextColor={prevWeekExercise?.repsSets ? colors.textGhost : colors.textMuted}
                />
              ) : (
                <View style={[styles.fieldInput, styles.readOnlyField, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}>
                  <Text style={[styles.readOnlyText, { color: colors.textMuted }, !repsSets && prevWeekExercise?.repsSets ? [styles.ghostText, { color: colors.textGhost }] : null]}>
                    {repsSets || prevWeekExercise?.repsSets || '-'}
                  </Text>
                </View>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Weight</Text>
              {canEditAll ? (
                <TextInput
                  style={[styles.fieldInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                  value={weight}
                  onChangeText={setWeight}
                  onBlur={saveChanges}
                  placeholder={prevWeekExercise?.weight || "e.g., 100kg"}
                  placeholderTextColor={prevWeekExercise?.weight ? colors.textGhost : colors.textMuted}
                />
              ) : (
                <View style={[styles.fieldInput, styles.readOnlyField, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}>
                  <Text style={[styles.readOnlyText, { color: colors.textMuted }, !weight && prevWeekExercise?.weight ? [styles.ghostText, { color: colors.textGhost }] : null]}>
                    {weight || prevWeekExercise?.weight || '-'}
                  </Text>
                </View>
              )}
            </View>
            <View style={{ width: 70 }}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>RPE</Text>
              {canEditAll ? (
                <TextInput
                  style={[styles.fieldInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }, !rpe && prevWeekExercise?.rpe ? styles.ghostedInput : null]}
                  value={rpe}
                  onChangeText={setRpe}
                  onBlur={saveChanges}
                  placeholder={prevWeekExercise?.rpe || "7"}
                  placeholderTextColor={prevWeekExercise?.rpe ? colors.textGhost : colors.textMuted}
                  keyboardType="decimal-pad"
                />
              ) : (
                <View style={[styles.fieldInput, styles.readOnlyField, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}>
                  <Text style={[styles.readOnlyText, { color: colors.textMuted }, !rpe && prevWeekExercise?.rpe ? [styles.ghostText, { color: colors.textGhost }] : null]}>
                    {rpe || prevWeekExercise?.rpe || '-'}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {isCoach && isShared && exercise.isCompleted && (
            <View style={[styles.completionToggle, styles.completionToggleActive, { backgroundColor: colors.surface, borderColor: colors.success }]} >
              <Ionicons name="checkmark-circle" size={22} color={colors.success} />
              <Text style={[styles.completionText, { color: colors.success }]}>Client completed this</Text>
            </View>
          )}

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            <Ionicons name="chatbubble-outline" size={12} color={colors.textSecondary} /> {isShared ? 'Client Notes' : 'Notes'}
          </Text>
          {(isCoach && isShared) ? (
            <View style={[styles.fieldInput, styles.readOnlyField, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}>
              <Text style={[styles.readOnlyText, { color: colors.textMuted }, !clientNotes && prevWeekExercise?.clientNotes ? [styles.ghostText, { color: colors.textGhost }] : null]}>
                {clientNotes || prevWeekExercise?.clientNotes || 'No client notes yet'}
              </Text>
            </View>
          ) : (
            <TextInput
              style={[styles.fieldInput, { minHeight: 50, color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
              value={clientNotes}
              onChangeText={setClientNotes}
              placeholder={prevWeekExercise?.clientNotes || "How it felt, feedback..."}
              placeholderTextColor={prevWeekExercise?.clientNotes ? colors.textGhost : colors.textMuted}
              multiline
              textAlignVertical="top"
            />
          )}

          {isShared && (
            <>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                <Ionicons name="school-outline" size={12} color={colors.accent} /> Coach Comment
              </Text>
              {isCoach ? (
                <TextInput
                  style={[styles.fieldInput, styles.coachInput, { minHeight: 50, color: colors.text, backgroundColor: colors.surface, borderColor: colors.accent }]}
                  value={coachComment}
                  onChangeText={setCoachComment}
                  onBlur={saveChanges}
                  placeholder={prevWeekExercise?.coachComment || "Instructions/feedback..."}
                  placeholderTextColor={prevWeekExercise?.coachComment ? colors.textGhost : colors.textMuted}
                  multiline
                  textAlignVertical="top"
                />
              ) : (
                <View style={[styles.fieldInput, styles.coachInput, styles.readOnlyField, { backgroundColor: colors.surfaceLight, borderColor: colors.accent }]}>
                  <Text style={[styles.readOnlyText, { color: colors.textMuted }, !coachComment && prevWeekExercise?.coachComment ? [styles.ghostText, { color: colors.textGhost }] : null]}>
                    {coachComment || prevWeekExercise?.coachComment || 'No coach comments yet'}
                  </Text>
                </View>
              )}
            </>
          )}

          {(!isCoach || !isShared) && (
            <VideoRecordButton
              exercise={exercise}
              programId={programId}
              coachId={coachId}
              uploadedBy={profileId}
              onVideoRecorded={(url) => {
                onUpdate({ videoUrl: url });
              }}
              onVideoDeleted={() => {
                onUpdate({ videoUrl: '' });
              }}
            />
          )}
          {isCoach && isShared && !!exercise.videoUrl && (
            <VideoPlayerInline videoUrl={exercise.videoUrl} isCoach={true} />
          )}

          {(!isCoach || !isShared) && (
            <Pressable
              style={[styles.completionToggle, { backgroundColor: colors.surface, borderColor: colors.border }, isCompleted && [styles.completionToggleActive, { borderColor: colors.success }]]}
              onPress={handleToggleComplete}
            >
              <Ionicons
                name={isCompleted ? "checkmark-circle" : "ellipse-outline"}
                size={22}
                color={isCompleted ? colors.success : colors.textMuted}
              />
              <Text style={[styles.completionText, { color: colors.textMuted }, isCompleted && { color: colors.success }]}>
                {isCompleted ? 'Completed' : 'Mark as completed'}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

export default function ProgramDetailScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { id, highlightExercise } = useLocalSearchParams<{ id: string; highlightExercise?: string }>();
  const [program, setProgram] = useState<Program | null>(null);
  const [activeWeek, setActiveWeek] = useState(1);
  const [activeDay, setActiveDay] = useState(1);
  const [hasChanges, setHasChanges] = useState(false);
  const [isCoach, setIsCoach] = useState(true);
  const [isShared, setIsShared] = useState(false);
  const [profileId, setProfileId] = useState('');
  const [highlightedExerciseId, setHighlightedExerciseId] = useState<string | null>(null);
  const [planLocked, setPlanLocked] = useState(false);
  const [planLockMessage, setPlanLockMessage] = useState('');
  const clientAutoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (id) {
      Promise.all([getProgram(id), getProfile()]).then(async ([p, prof]) => {
        if (p) {
          setProgram(p);
          if (highlightExercise) {
            let matched = false;
            for (const week of [...p.weeks].reverse()) {
              if (matched) break;
              for (const day of week.days) {
                const found = day.exercises.find(
                  ex => ex.name && ex.name.toLowerCase() === highlightExercise.toLowerCase()
                );
                if (found) {
                  setActiveWeek(week.weekNumber);
                  setActiveDay(day.dayNumber);
                  setHighlightedExerciseId(found.id);
                  matched = true;
                  break;
                }
              }
            }
          }
        }
        const shared = !!p?.clientId;
        setIsShared(shared);
        setIsCoach(prof.role === 'coach');
        setProfileId(prof.id);
        markNotificationsReadByProgram(id).catch(() => {});

        if (prof.role === 'coach' && shared) {
          try {
            const clientList = await getClients();
            const limit = prof.planUserLimit || 1;
            if (clientList.length > limit) {
              setPlanLocked(true);
              setPlanLockMessage(`Your ${prof.plan === 'free' ? 'Free' : prof.plan} plan supports ${limit} client${limit !== 1 ? 's' : ''} but you have ${clientList.length}. Upgrade your plan to edit shared programs.`);
            }
          } catch {}
        }
      });
    }
  }, [id]);

  useFocusEffect(useCallback(() => {
    if (trimResult.videoUrl && trimResult.exerciseId && program) {
      const url = trimResult.videoUrl;
      const exId = trimResult.exerciseId;
      trimResult.videoUrl = null;
      trimResult.exerciseId = null;
      
      const updatedWeeks = program.weeks.map(week => ({
        ...week,
        days: week.days.map(day => ({
          ...day,
          exercises: day.exercises.map(ex =>
            ex.id === exId ? { ...ex, videoUrl: url } : ex
          ),
        })),
      }));
      const updated = { ...program, weeks: updatedWeeks };
      setProgram(updated);
      updateProgram(updated).then(() => {
        setHasChanges(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }).catch(() => {
        setHasChanges(true);
      });
    }
  }, [program]));

  useEffect(() => {
    if (hasChanges && program && (!isCoach || !isShared)) {
      if (clientAutoSaveRef.current) clearTimeout(clientAutoSaveRef.current);
      clientAutoSaveRef.current = setTimeout(() => {
        save();
      }, 2000);
      return () => { if (clientAutoSaveRef.current) clearTimeout(clientAutoSaveRef.current); };
    }
  }, [hasChanges, isCoach, program]);

  const save = useCallback(async () => {
    if (!program) return;
    if (planLocked) {
      showAlert('Plan Limit Exceeded', planLockMessage || 'Upgrade your plan to edit shared programs.');
      return;
    }
    const oldProgram = await getProgram(program.id);

    setHasChanges(false);

    try {
      await updateProgram(program);
    } catch (e: any) {
      setHasChanges(true);
      showAlert('Save Error', 'Changes couldn\'t be saved. They\'ll retry automatically.');
      return;
    }

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
    if (!program || planLocked) return;
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
              weight: ex.weight,
              rpe: ex.rpe,
              isCompleted: false,
              notes: ex.notes,
              clientNotes: '',
              coachComment: ex.coachComment,
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
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignClients, setAssignClients] = useState<ClientInfo[]>([]);
  const [assigning, setAssigning] = useState(false);

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

  const openAssignModal = async () => {
    try {
      const clientList = await getClients();
      setAssignClients(clientList);
      setShowAssignModal(true);
    } catch (e: any) {
      showAlert('Error', 'Failed to load clients');
    }
  };

  const handleAssignToClient = async (clientId: string, clientName: string) => {
    if (!program) return;
    setAssigning(true);
    try {
      const copy = await assignProgramToClient(program.id, clientId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowAssignModal(false);
      showAlert('Assigned', `"${program.title}" has been copied and assigned to ${clientName}.`);
      router.replace({ pathname: '/program/[id]', params: { id: copy.id } });
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to assign program');
    }
    setAssigning(false);
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
    setProgram(prev => {
      if (!prev || planLocked) return prev;

      const currentDay = prev.weeks
        .find(w => w.weekNumber === activeWeek)?.days
        .find(d => d.dayNumber === activeDay);
      const exerciseIndex = currentDay?.exercises.findIndex(e => e.id === exerciseId) ?? -1;
      const oldExercise = currentDay?.exercises[exerciseIndex];
      const nameChanged = updates.name !== undefined && oldExercise && updates.name !== oldExercise.name;

      const updatedWeeks = prev.weeks.map(week => {
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
      return { ...prev, weeks: updatedWeeks };
    });
    setHasChanges(true);
  }, [activeWeek, activeDay, planLocked]);

  const deleteExercise = useCallback((exerciseId: string) => {
    setProgram(prev => {
      if (!prev || planLocked) return prev;
      const updatedWeeks = prev.weeks.map(week => {
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
      return { ...prev, weeks: updatedWeeks };
    });
    setHasChanges(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [activeWeek, activeDay, planLocked]);

  const deleteWeek = useCallback((weekNumber: number) => {
    if (!program || planLocked) return;
    if (program.weeks.length <= 1) {
      showAlert('Cannot Delete', 'A program must have at least one week.');
      return;
    }
    confirmAction(
      'Delete Week',
      `Remove Week ${weekNumber} and all its exercises? This cannot be undone after saving.`,
      () => {
        const filtered = program.weeks.filter(w => w.weekNumber !== weekNumber);
        const renumbered = filtered.map((w, i) => ({ ...w, weekNumber: i + 1 }));
        setProgram({ ...program, weeks: renumbered });
        if (activeWeek >= weekNumber) {
          setActiveWeek(Math.max(1, activeWeek > renumbered.length ? renumbered.length : activeWeek - 1));
        }
        setActiveDay(1);
        setHasChanges(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
      'Delete'
    );
  }, [program, activeWeek, planLocked]);

  const deleteDay = useCallback((dayNumber: number) => {
    if (!program || planLocked) return;
    const currentWeekData = program.weeks.find(w => w.weekNumber === activeWeek);
    if (!currentWeekData || currentWeekData.days.length <= 1) {
      showAlert('Cannot Delete', 'A week must have at least one day.');
      return;
    }
    confirmAction(
      'Delete Day',
      `Remove Day ${dayNumber} and all its exercises from Week ${activeWeek}? This cannot be undone after saving.`,
      () => {
        const updatedWeeks = program.weeks.map(week => {
          if (week.weekNumber !== activeWeek) return week;
          const filtered = week.days.filter(d => d.dayNumber !== dayNumber);
          const renumbered = filtered.map((d, i) => ({ ...d, dayNumber: i + 1 }));
          return { ...week, days: renumbered };
        });
        const newProgram = { ...program, weeks: updatedWeeks };
        setProgram(newProgram);
        if (activeDay >= dayNumber) {
          const newDayCount = (currentWeekData.days.length - 1);
          setActiveDay(Math.max(1, activeDay > newDayCount ? newDayCount : activeDay - 1));
        }
        setHasChanges(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
      'Delete'
    );
  }, [program, activeWeek, activeDay, planLocked]);

  const addExercise = useCallback(() => {
    if (!program || planLocked) return;
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
      <View style={[styles.container, { paddingTop: insets.top, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }]}>
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading...</Text>
      </View>
    );
  }

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset, backgroundColor: colors.background }]}>
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
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>{program.title}</Text>
          <View style={styles.headerMeta}>
            <Text style={[styles.headerSub, { color: colors.textSecondary }]}>{program.weeks.length}W x {program.daysPerWeek}D</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {isCoach && !isShared && !planLocked && (
            <Pressable onPress={openAssignModal} hitSlop={8} accessibilityLabel="Assign to client" accessibilityRole="button">
              <Ionicons name="person-add-outline" size={22} color={colors.primary} />
            </Pressable>
          )}
          {!planLocked && (
            <Pressable onPress={() => { setDeleteInput(''); setShowDeleteModal(true); }} hitSlop={8} accessibilityLabel="Delete program" accessibilityRole="button">
              <Ionicons name="trash-outline" size={22} color={colors.danger} />
            </Pressable>
          )}
          {planLocked ? (
            <Ionicons name="lock-closed" size={22} color={colors.danger} />
          ) : (
            <Pressable onPress={save} hitSlop={8}>
              <Ionicons name="checkmark-circle" size={26} color={hasChanges ? colors.primary : colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      {planLocked && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Ionicons name="lock-closed" size={48} color={colors.danger} />
          <Text style={{ color: colors.text, fontSize: 18, fontFamily: 'Rubik_600SemiBold', marginTop: 16, textAlign: 'center' }}>Plan Limit Exceeded</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14, fontFamily: 'Rubik_400Regular', marginTop: 8, textAlign: 'center', lineHeight: 20 }}>{planLockMessage}</Text>
          <Pressable
            onPress={() => router.back()}
            style={{ marginTop: 24, backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 }}
          >
            <Text style={{ color: '#fff', fontFamily: 'Rubik_600SemiBold', fontSize: 15 }}>Go Back</Text>
          </Pressable>
        </View>
      )}

      {!planLocked && (<>
      <View style={[styles.weekSelector, { borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekScrollContent}>
          {program.weeks.map(week => (
            <View key={week.weekNumber} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable
                style={[styles.weekChip, { backgroundColor: colors.backgroundCard, borderColor: colors.border }, activeWeek === week.weekNumber && [styles.weekChipActive, { backgroundColor: colors.primary, borderColor: colors.primary }]]}
                onPress={() => { Haptics.selectionAsync(); setActiveWeek(week.weekNumber); setActiveDay(1); }}
                onLongPress={() => {
                  if ((isCoach || !isShared) && !planLocked) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    deleteWeek(week.weekNumber);
                  }
                }}
              >
                <Text style={[styles.weekChipText, { color: colors.textSecondary }, activeWeek === week.weekNumber && styles.weekChipTextActive]}>
                  W{week.weekNumber}
                </Text>
              </Pressable>
              {Platform.OS === 'web' && (isCoach || !isShared) && !planLocked && program.weeks.length > 1 && (
                <Pressable
                  style={styles.chipDeleteBtn}
                  onPress={() => deleteWeek(week.weekNumber)}
                  hitSlop={4}
                >
                  <Ionicons name="close-circle" size={14} color={colors.textMuted} />
                </Pressable>
              )}
            </View>
          ))}
          {(isCoach || !isShared) && (
            <Pressable style={[styles.addWeekChip, { borderColor: colors.primary }]} onPress={addWeek} accessibilityLabel="Add week" accessibilityRole="button">
              <Ionicons name="add" size={16} color={colors.primary} />
            </Pressable>
          )}
        </ScrollView>
        <View style={styles.weekProgressRow}>
          <View style={[styles.weekProgressBar, { backgroundColor: colors.surfaceLight }]}>
            <View style={[styles.weekProgressFill, { width: `${weekProgress}%`, backgroundColor: colors.success }]} />
          </View>
          <Text style={[styles.weekProgressText, { color: colors.textSecondary }]}>{weekProgress}%</Text>
        </View>
      </View>

      <View style={[styles.daySelector, { borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayScrollContent}>
          {(currentWeek?.days || []).map(day => (
            <View key={day.dayNumber} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable
                style={[styles.dayChip, { backgroundColor: colors.backgroundCard, borderColor: colors.border }, activeDay === day.dayNumber && [styles.dayChipActive, { backgroundColor: colors.accent, borderColor: colors.accent }]]}
                onPress={() => { Haptics.selectionAsync(); setActiveDay(day.dayNumber); }}
                onLongPress={() => {
                  if (isCoach || !isShared) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    deleteDay(day.dayNumber);
                  }
                }}
              >
                <Text style={[styles.dayChipText, { color: colors.textSecondary }, activeDay === day.dayNumber && styles.dayChipTextActive]}>
                  Day {day.dayNumber}
                </Text>
              </Pressable>
              {Platform.OS === 'web' && (isCoach || !isShared) && !planLocked && (currentWeek?.days || []).length > 1 && (
                <Pressable
                  style={styles.chipDeleteBtn}
                  onPress={() => deleteDay(day.dayNumber)}
                  hitSlop={4}
                >
                  <Ionicons name="close-circle" size={14} color={colors.textMuted} />
                </Pressable>
              )}
            </View>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + (hasChanges ? 80 : 20), paddingHorizontal: 16, paddingTop: 8 }}
      >
        {exercises.length === 0 ? (
          <View style={styles.emptyDay}>
            <Ionicons name="barbell-outline" size={32} color={colors.textMuted} />
            <Text style={[styles.emptyDayText, { color: colors.textMuted }]}>No exercises for this day</Text>
          </View>
        ) : (
          exercises.map((ex, idx) => (
            <Animated.View key={ex.id} entering={FadeInDown.delay(idx * 40).duration(250)}>
              <ExerciseRow
                exercise={ex}
                index={idx}
                isCoach={isCoach}
                isShared={isShared}
                onUpdate={(updates) => updateExercise(ex.id, updates)}
                onDelete={() => deleteExercise(ex.id)}
                prevWeekExercise={prevWeekDay?.exercises[idx] || null}
                programId={program.id}
                coachId={program.coachId}
                profileId={profileId}
                initialExpanded={ex.id === highlightedExerciseId}
                planLocked={false}
              />
            </Animated.View>
          ))
        )}

        {(isCoach || !isShared) && (
          <Pressable style={[styles.addExerciseBtn, { borderColor: colors.border }]} onPress={addExercise}>
            <Ionicons name="add" size={16} color={colors.primary} />
            <Text style={[styles.addExerciseText, { color: colors.primary }]}>Add Exercise</Text>
          </Pressable>
        )}
      </ScrollView>

      {hasChanges && !planLocked && (
        <Animated.View entering={FadeIn.duration(200)} style={[styles.saveBar, { paddingBottom: insets.bottom + 10, backgroundColor: colors.backgroundElevated, borderTopColor: colors.border }]}>
          <View style={[styles.saveBarDot, { backgroundColor: colors.warning }]} />
          <Text style={[styles.saveBarText, { color: colors.textSecondary }]}>Unsaved changes</Text>
          <Pressable style={[styles.saveBarButton, { backgroundColor: colors.primary }]} onPress={save}>
            <Text style={styles.saveBarButtonText}>Save</Text>
          </Pressable>
        </Animated.View>
      )}
      </>
      )}

      <Modal visible={showDeleteModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
            <Ionicons name="warning" size={40} color={colors.danger} />
            <Text style={[styles.modalTitle, { color: colors.danger }]}>Delete Program</Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              This will permanently delete "{program.title}" and all its exercises, progress, and associated data. This action cannot be undone.
            </Text>
            <Text style={[styles.modalPrompt, { color: colors.text }]}>Type DELETE to confirm:</Text>
            <TextInput
              style={[styles.modalInput, { color: colors.danger, backgroundColor: colors.surface, borderColor: colors.border }]}
              value={deleteInput}
              onChangeText={setDeleteInput}
              placeholder="Type DELETE"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              accessibilityLabel="Type DELETE to confirm program deletion"
            />
            <View style={styles.modalButtons}>
              <Pressable style={[styles.modalCancelBtn, { backgroundColor: colors.surfaceLight }]} onPress={() => setShowDeleteModal(false)} accessibilityLabel="Cancel" accessibilityRole="button">
                <Text style={[styles.modalCancelText, { color: colors.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalDeleteBtn, { backgroundColor: colors.danger }, deleteInput !== 'DELETE' && styles.modalDeleteBtnDisabled]}
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

      <Modal visible={showAssignModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
            <Ionicons name="person-add" size={40} color={colors.primary} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>Assign to Client</Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              A copy of "{program?.title}" will be created and assigned to the selected client. The original template stays unchanged.
            </Text>
            {assignClients.length === 0 ? (
              <Text style={{ color: colors.textMuted, fontFamily: 'Rubik_400Regular', fontSize: 14, marginTop: 12, textAlign: 'center' }}>
                No clients found. Clients need to join you using your coach code first.
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 240, width: '100%', marginTop: 12 }}>
                {assignClients.map(client => (
                  <Pressable
                    key={client.id}
                    style={[styles.assignClientItem, { borderColor: colors.border }]}
                    onPress={() => handleAssignToClient(client.id, client.name)}
                    disabled={assigning}
                  >
                    <View style={[styles.assignClientAvatar, { backgroundColor: colors.surfaceLight }]}>
                      <Ionicons name="person" size={18} color={colors.textMuted} />
                    </View>
                    <Text style={[styles.assignClientName, { color: colors.text }]} numberOfLines={1}>{client.name}</Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </Pressable>
                ))}
              </ScrollView>
            )}
            {assigning && (
              <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ color: colors.textMuted, fontFamily: 'Rubik_400Regular', fontSize: 13 }}>Creating copy...</Text>
              </View>
            )}
            <Pressable
              style={[styles.modalCancelBtn, { backgroundColor: colors.surfaceLight, marginTop: 16, width: '100%', alignItems: 'center' }]}
              onPress={() => setShowAssignModal(false)}
              disabled={assigning}
            >
              <Text style={[styles.modalCancelText, { color: colors.text }]}>Cancel</Text>
            </Pressable>
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
  videoDeleteBtn: {
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.colors.danger, borderRadius: 10, paddingHorizontal: 14, marginTop: 16,
  },
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
  chipDeleteBtn: {
    marginLeft: -4, marginRight: 4, padding: 2, opacity: 0.6,
  },
  exerciseWebDeleteBtn: {
    padding: 4, marginRight: 4, opacity: 0.5,
  },
  assignClientItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.colors.border,
  },
  assignClientAvatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.colors.surfaceLight,
  },
  assignClientName: {
    flex: 1, fontFamily: 'Rubik_500Medium', fontSize: 15, color: Colors.colors.text,
  },
});
