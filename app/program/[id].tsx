import { StyleSheet, Text, View, ScrollView, Pressable, Platform, TextInput, Linking, ActivityIndicator, Modal, Alert, PanResponder } from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getProgram, updateProgram, deleteProgram, getProfile, getCachedProfile, getClients, addNotification, markNotificationsReadByProgram, assignProgramToClient, type Program, type Exercise, type WorkoutWeek, type WorkoutDay, type UserProfile, type ClientInfo } from "@/lib/storage";
import { uploadVideo, getVideoUrl, getDirectVideoUrl, markVideoViewed } from "@/lib/api";
import { trimResult } from "@/lib/trim-result";
import { useUploads } from "@/lib/upload-context";

function programPositionKey(programId: string) {
  return `liftflow_prog_pos_${programId}`;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function VideoPlayerView({ videoUrl }: { videoUrl: string }) {
  const { colors } = useTheme();
  const [directUrl, setDirectUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrubBarRef = useRef<View>(null);
  const scrubBarWidthRef = useRef(0);
  const isScrubbingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getDirectVideoUrl(videoUrl)
      .then(url => { if (!cancelled) setDirectUrl(url); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [videoUrl]);

  const player = useVideoPlayer(directUrl, player => {
    player.loop = false;
    player.volume = 0;
    if ('audioMixingMode' in player) {
      (player as any).audioMixingMode = 'mixWithOthers';
    }
  });

  useEffect(() => {
    if (!player) return;
    const playSub = player.addListener('playingChange', ({ isPlaying: playing }: { isPlaying: boolean }) => {
      setIsPlaying(playing);
      if (playing) {
        resetHideTimer();
      } else {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        setShowControls(true);
      }
    });
    const timeSub = player.addListener('timeUpdate', ({ currentTime: ct }: { currentTime: number }) => {
      if (!isScrubbingRef.current) setCurrentTime(ct);
    });
    const statusSub = player.addListener('statusChange', ({ status }: { status: string }) => {
      if (status === 'readyToPlay' && player.duration) {
        setDuration(player.duration);
      }
    });
    return () => { playSub.remove(); timeSub.remove(); statusSub.remove(); if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
  }, [player]);

  const resetHideTimer = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setShowControls(true);
    hideTimerRef.current = setTimeout(() => { if (!isScrubbingRef.current) setShowControls(false); }, 3000);
  };

  const handlePress = () => {
    if (!player) return;
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
    resetHideTimer();
  };

  const scrubPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      isScrubbingRef.current = true;
      setIsScrubbing(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setShowControls(true);
      if (player?.playing) player.pause();
      const x = evt.nativeEvent.locationX;
      const pct = Math.max(0, Math.min(1, x / scrubBarWidthRef.current));
      const t = pct * duration;
      setCurrentTime(t);
      if (player) player.currentTime = t;
    },
    onPanResponderMove: (_, gs) => {
      scrubBarRef.current?.measure((_fx, _fy, width, _h, px) => {
        const x = gs.moveX - px;
        const pct = Math.max(0, Math.min(1, x / width));
        const t = pct * duration;
        setCurrentTime(t);
        if (player) player.currentTime = t;
      });
    },
    onPanResponderRelease: () => {
      isScrubbingRef.current = false;
      setIsScrubbing(false);
      resetHideTimer();
    },
  }), [player, duration]);

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

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <View>
      <Pressable onPress={handlePress} style={{ position: 'relative' }}>
        <VideoView
          style={styles.videoPlayer}
          player={player}
          nativeControls={false}
          contentFit="contain"
        />
        {showControls && (
          <View style={styles.videoOverlay} pointerEvents="none">
            <View style={styles.videoPlayBtn}>
              <Ionicons name={isPlaying ? 'pause' : 'play'} size={26} color="#fff" />
            </View>
          </View>
        )}
      </Pressable>
      {(showControls || isScrubbing) && duration > 0 && (
        <View style={{ paddingHorizontal: 8, paddingTop: 6, paddingBottom: 2 }}>
          <View
            ref={scrubBarRef}
            onLayout={(e) => { scrubBarWidthRef.current = e.nativeEvent.layout.width; }}
            style={{ height: 28, justifyContent: 'center' }}
            {...scrubPanResponder.panHandlers}
          >
            <View style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2 }}>
              <View style={{ height: 4, backgroundColor: colors.primary, borderRadius: 2, width: `${progress * 100}%` }} />
            </View>
            <View
              style={{
                position: 'absolute',
                left: `${progress * 100}%`,
                marginLeft: -7,
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: colors.primary,
                borderWidth: 2,
                borderColor: '#fff',
              }}
            />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
            <Text style={{ fontFamily: 'Rubik_400Regular', fontSize: 10, color: colors.textMuted }}>{formatTime(currentTime)}</Text>
            <Text style={{ fontFamily: 'Rubik_400Regular', fontSize: 10, color: colors.textMuted }}>{formatTime(duration)}</Text>
          </View>
        </View>
      )}
    </View>
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

  const handleRecord = () => {
    if (Platform.OS === 'web') {
      handleWebRecord();
      return;
    }
    router.push({
      pathname: '/record-video',
      params: {
        programId,
        exerciseId: exercise.id,
        uploadedBy,
        coachId,
        exerciseName: exercise.name || 'Exercise',
      },
    });
  };

  const handleWebRecord = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['videos'],
        videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      router.push({
        pathname: '/trim-video',
        params: {
          videoUri: asset.uri,
          videoDuration: String(asset.duration || 0),
          programId,
          exerciseId: exercise.id,
          uploadedBy,
          coachId,
          exerciseName: exercise.name || 'Exercise',
        },
      });
    } catch {
      showAlert("Error", "Failed to open camera.");
    }
  };

  const handleUpload = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      router.push({
        pathname: '/trim-video',
        params: {
          videoUri: asset.uri,
          videoDuration: String(asset.duration || 0),
          programId,
          exerciseId: exercise.id,
          uploadedBy,
          coachId,
          exerciseName: exercise.name || 'Exercise',
        },
      });
    } catch {
      showAlert("Error", "Failed to open library.");
    }
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
              <Text style={[styles.videoBtnText, { color: colors.primary }]}>{hasVideo ? 'Re-record' : 'Record'}</Text>
            </>
          )}
        </Pressable>
        <Pressable style={[styles.videoBtn, { flex: 1, borderColor: colors.textSecondary }]} onPress={handleUpload} disabled={uploading}>
          <Ionicons name="cloud-upload-outline" size={18} color={colors.textSecondary} />
          <Text style={[styles.videoBtnText, { color: colors.textSecondary }]}>Upload</Text>
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

function ClientExerciseCard({ exercise, index, onUpdate, prevWeekExercise, programId, coachId, profileId }: {
  exercise: Exercise;
  index: number;
  onUpdate: (updates: Partial<Exercise>) => void;
  prevWeekExercise: Exercise | null;
  programId: string;
  coachId: string;
  profileId: string;
}) {
  const { colors } = useTheme();
  const [isCompleted, setIsCompleted] = useState(exercise.isCompleted);
  const [clientNotes, setClientNotes] = useState(exercise.clientNotes || '');
  const [expanded, setExpanded] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notesAutoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);
  const skipNextAutoSave = useRef(false);

  useEffect(() => {
    setIsCompleted(exercise.isCompleted);
  }, [exercise.isCompleted]);

  useEffect(() => {
    setClientNotes(exercise.clientNotes || '');
  }, [exercise.clientNotes]);

  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    if (skipNextAutoSave.current) { skipNextAutoSave.current = false; return; }
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      onUpdate({ isCompleted });
    }, 800);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [isCompleted]);

  const handleToggleComplete = () => {
    const newVal = !isCompleted;
    setIsCompleted(newVal);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    skipNextAutoSave.current = true;
    onUpdate({ isCompleted: newVal });
  };

  const handleRecord = () => {
    if (Platform.OS === 'web') {
      ImagePicker.launchCameraAsync({ mediaTypes: ['videos'], allowsEditing: false }).then(result => {
        if (result.canceled || !result.assets?.[0]) return;
        const asset = result.assets[0];
        router.push({ pathname: '/trim-video', params: { videoUri: asset.uri, videoDuration: String(asset.duration || 0), programId, exerciseId: exercise.id, uploadedBy: profileId, coachId, exerciseName: exercise.name || 'Exercise' } });
      }).catch(() => showAlert('Error', 'Failed to open camera.'));
    } else {
      router.push({ pathname: '/record-video', params: { programId, exerciseId: exercise.id, uploadedBy: profileId, coachId, exerciseName: exercise.name || 'Exercise' } });
    }
  };

  const handleUpload = async () => {
    try {
      const useNativeTrim = Platform.OS === 'ios';
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
        allowsEditing: useNativeTrim,
        videoMaxDuration: useNativeTrim ? 60 : undefined,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      router.push({
        pathname: '/trim-video',
        params: {
          videoUri: asset.uri,
          videoDuration: String(asset.duration || 0),
          programId,
          exerciseId: exercise.id,
          uploadedBy: profileId,
          coachId,
          exerciseName: exercise.name || 'Exercise',
          nativeTrimmed: useNativeTrim ? 'true' : 'false',
        },
      });
    } catch {
      showAlert("Error", "Failed to open library.");
    }
  };

  const handleDeleteVideo = () => {
    confirmAction(
      "Delete Video",
      "Are you sure you want to remove this video?",
      () => {
        onUpdate({ videoUrl: '' });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    );
  };

  const handleNotesChange = (text: string) => {
    setClientNotes(text);
    if (notesAutoSaveTimer.current) clearTimeout(notesAutoSaveTimer.current);
    notesAutoSaveTimer.current = setTimeout(() => {
      onUpdate({ clientNotes: text });
    }, 800);
  };

  const name = exercise.name || prevWeekExercise?.name || `Exercise ${index + 1}`;
  const repsSets = exercise.repsSets || prevWeekExercise?.repsSets;
  const weight = exercise.weight || prevWeekExercise?.weight;
  const rpe = exercise.rpe || prevWeekExercise?.rpe;
  const coachNote = exercise.notes || prevWeekExercise?.notes;
  const coachComment = exercise.coachComment || prevWeekExercise?.coachComment;
  const displayNote = coachComment || coachNote;
  const hasVideo = !!exercise.videoUrl;
  const metaParts = [repsSets, weight ? `@ ${weight}` : null, rpe ? `RPE ${rpe}` : null].filter(Boolean);
  const meta = metaParts.length > 0 ? metaParts.join(' · ') : null;

  return (
    <Pressable
      onPress={() => setExpanded(prev => !prev)}
      style={[
        styles.clientExCard,
        { backgroundColor: colors.backgroundCard, borderColor: isCompleted ? `${colors.success}33` : colors.border },
        isCompleted && { opacity: 0.85 },
      ]}
    >
      <View style={[styles.clientExHeader, { marginBottom: (!!displayNote || !isCompleted || expanded) ? 10 : 0 }]}>
        <Pressable
          onPress={(e) => { e.stopPropagation(); handleToggleComplete(); }}
          hitSlop={8}
          style={[styles.clientExCheck, { backgroundColor: isCompleted ? `${colors.success}22` : 'rgba(255,255,255,0.06)', borderColor: isCompleted ? colors.success : 'rgba(255,255,255,0.15)' }]}
        >
          {isCompleted && <Ionicons name="checkmark" size={13} color={colors.success} />}
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.clientExName, { color: isCompleted ? '#888' : colors.text, textDecorationLine: isCompleted ? 'line-through' : 'none' }]} numberOfLines={1}>
            {name}
          </Text>
          {meta ? <Text style={[styles.clientExMeta, { color: '#666' }]}>{meta}</Text> : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {hasVideo && (
            <View style={[styles.clientExVideoBadge, { backgroundColor: `${colors.primary}22` }]}>
              <Text style={{ fontFamily: 'Rubik_600SemiBold', fontSize: 10, color: colors.primary }}>Video ✓</Text>
            </View>
          )}
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
        </View>
      </View>

      {!!displayNote && (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginBottom: 4 }}>
          <Ionicons name="megaphone-outline" size={12} color={colors.accent} style={{ marginTop: 1 }} />
          <Text style={{ fontFamily: 'Rubik_400Regular', fontSize: 12, color: colors.accent, flex: 1 }}>{displayNote}</Text>
        </View>
      )}

      {!isCompleted && (
        <View style={{ gap: 8 }}>
          <View style={styles.clientExActions}>
            <Pressable style={[styles.clientExUploadBtn, { borderColor: colors.primary, flex: 1 }]} onPress={(e) => { e.stopPropagation(); handleRecord(); }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'center' }}>
                <Ionicons name="videocam-outline" size={15} color={colors.primary} />
                <Text style={[styles.clientExUploadText, { color: colors.primary }]}>Record</Text>
              </View>
            </Pressable>
            <Pressable style={[styles.clientExUploadBtn, { borderColor: colors.textSecondary, flex: 1 }]} onPress={(e) => { e.stopPropagation(); handleUpload(); }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'center' }}>
                <Ionicons name="cloud-upload-outline" size={15} color={colors.textSecondary} />
                <Text style={[styles.clientExUploadText, { color: colors.textSecondary }]}>Upload</Text>
              </View>
            </Pressable>
            {hasVideo && (
              <Pressable style={[styles.clientExUploadBtn, { borderColor: colors.danger, paddingHorizontal: 10 }]} onPress={(e) => { e.stopPropagation(); handleDeleteVideo(); }}>
                <Ionicons name="trash-outline" size={15} color={colors.danger} />
              </Pressable>
            )}
          </View>
          <Pressable style={[styles.clientExMarkDoneBtn, { backgroundColor: colors.primary }]} onPress={(e) => { e.stopPropagation(); handleToggleComplete(); }}>
            <Text style={styles.clientExMarkDoneText}>Mark Done</Text>
          </Pressable>
        </View>
      )}
      {isCompleted && hasVideo && (
        <Pressable
          style={[styles.clientExUploadBtn, { borderColor: colors.danger, alignSelf: 'flex-start', marginTop: 6 }]}
          onPress={(e) => { e.stopPropagation(); handleDeleteVideo(); }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Ionicons name="trash-outline" size={14} color={colors.danger} />
            <Text style={[styles.clientExUploadText, { color: colors.danger }]}>Delete Video</Text>
          </View>
        </Pressable>
      )}

      {expanded && (
        <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }}>
          {hasVideo && (
            <VideoPlayerInline videoUrl={exercise.videoUrl} />
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6, marginTop: hasVideo ? 10 : 0 }}>
            <Ionicons name="chatbubble-outline" size={11} color={colors.textSecondary} />
            <Text style={{ fontFamily: 'Rubik_600SemiBold', fontSize: 12, color: colors.textSecondary }}>My Notes</Text>
          </View>
          <TextInput
            style={[styles.fieldInput, { minHeight: 50, color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
            value={clientNotes}
            onChangeText={handleNotesChange}
            placeholder={prevWeekExercise?.clientNotes || "How it felt, feedback..."}
            placeholderTextColor={prevWeekExercise?.clientNotes ? colors.textGhost : colors.textMuted}
            multiline
            textAlignVertical="top"
          />

          {!!coachComment && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6, marginTop: 10 }}>
                <Ionicons name="school-outline" size={11} color={colors.accent} />
                <Text style={{ fontFamily: 'Rubik_600SemiBold', fontSize: 12, color: colors.accent }}>Coach Comment</Text>
              </View>
              <View style={[styles.fieldInput, styles.readOnlyField, { backgroundColor: colors.surfaceLight, borderColor: colors.accent }]}>
                <Text style={[styles.readOnlyText, { color: colors.textMuted }]}>
                  {coachComment}
                </Text>
              </View>
            </>
          )}
        </View>
      )}
    </Pressable>
  );
}

function computeRpeSuggestion(prevExercise: Exercise | null | undefined): string | null {
  if (!prevExercise) return null;
  const prevWeight = parseFloat(prevExercise.weight?.replace(/[^0-9.]/g, '') || '');
  const prevRpe = parseFloat(prevExercise.rpe || '');
  const repsMatch = prevExercise.repsSets?.match(/(\d+)\s*[xX×]\s*(\d+)/);
  if (!repsMatch || isNaN(prevWeight) || prevWeight <= 0 || isNaN(prevRpe)) return null;
  const reps = parseInt(repsMatch[2], 10);
  if (reps <= 0 || reps > 15) return null;

  const rpeTable: Record<number, Record<number, number>> = {
    10:  {1:100, 2:95.5, 3:92.2, 4:89.2, 5:86.3, 6:83.7, 7:81.1, 8:78.6, 9:76.2, 10:73.9, 11:71.7, 12:69.5, 13:67.4, 14:65.3, 15:63.2},
    9.5: {1:97.8, 2:93.9, 3:90.7, 4:87.8, 5:85.0, 6:82.4, 7:79.9, 8:77.4, 9:75.1, 10:72.8, 11:70.6, 12:68.5, 13:66.4, 14:64.3, 15:62.3},
    9:   {1:95.5, 2:92.2, 3:89.2, 4:86.3, 5:83.7, 6:81.1, 7:78.6, 8:76.2, 9:73.9, 10:71.7, 11:69.5, 12:67.4, 13:65.3, 14:63.2, 15:61.3},
    8.5: {1:93.9, 2:90.7, 3:87.8, 4:85.0, 5:82.4, 6:79.9, 7:77.4, 8:75.1, 9:72.8, 10:70.6, 11:68.5, 12:66.4, 13:64.3, 14:62.3, 15:60.4},
    8:   {1:92.2, 2:89.2, 3:86.3, 4:83.7, 5:81.1, 6:78.6, 7:76.2, 8:73.9, 9:71.7, 10:69.5, 11:67.4, 12:65.3, 13:63.2, 14:61.3, 15:59.5},
    7.5: {1:90.7, 2:87.8, 3:85.0, 4:82.4, 5:79.9, 6:77.4, 7:75.1, 8:72.8, 9:70.6, 10:68.5, 11:66.4, 12:64.3, 13:62.3, 14:60.4, 15:58.6},
    7:   {1:89.2, 2:86.3, 3:83.7, 4:81.1, 5:78.6, 6:76.2, 7:73.9, 8:71.7, 9:69.5, 10:67.4, 11:65.3, 12:63.2, 13:61.3, 14:59.5, 15:57.8},
    6.5: {1:87.8, 2:85.0, 3:82.4, 4:79.9, 5:77.4, 6:75.1, 7:72.8, 8:70.6, 9:68.5, 10:66.4, 11:64.3, 12:62.3, 13:60.4, 14:58.6, 15:56.9},
    6:   {1:86.3, 2:83.7, 3:81.1, 4:78.6, 5:76.2, 6:73.9, 7:71.7, 8:69.5, 9:67.4, 10:65.3, 11:63.2, 12:61.3, 13:59.5, 14:57.8, 15:56.2},
  };
  const roundedRpe = Math.round(prevRpe * 2) / 2;
  const clampedRpe = Math.max(6, Math.min(10, roundedRpe));
  const pctRow = rpeTable[clampedRpe];
  if (!pctRow) return null;
  const pct = pctRow[Math.min(reps, 15)];
  if (!pct) return null;
  const e1rm = prevWeight / (pct / 100);
  const suggested = Math.round(e1rm * 1.025 * (pct / 100) * 2) / 2;
  if (suggested <= prevWeight || !isFinite(suggested)) return null;
  const unit = prevExercise.weight?.replace(/[0-9.\s]/g, '').trim() || '';
  return `${suggested}${unit ? unit : ''}`;
}

function ExerciseRow({ exercise, index, isCoach, isShared, onUpdate, onDelete, prevWeekExercise, programId, coachId, profileId, initialExpanded, planLocked, isExpanded: isExpandedProp, onToggle, suggestionsEnabled }: {
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
  isExpanded?: boolean;
  onToggle?: () => void;
  suggestionsEnabled?: boolean;
}) {
  const { colors } = useTheme();
  const hasPrevNotes = !!(prevWeekExercise?.clientNotes || prevWeekExercise?.coachComment || prevWeekExercise?.notes);
  const hasCurrentNotes = !!(exercise.clientNotes || exercise.coachComment || exercise.notes);
  const hasVideo = isCoach && isShared && !!exercise.videoUrl;
  const forceExpanded = isCoach && isShared && (hasCurrentNotes || hasPrevNotes || !!exercise.videoUrl);
  const [localExpanded, setLocalExpanded] = useState(initialExpanded || hasPrevNotes || hasCurrentNotes);
  const expanded = forceExpanded || (isExpandedProp !== undefined ? isExpandedProp : localExpanded);
  const [seenContent, setSeenContent] = useState(false);
  const [name, setName] = useState(exercise.name);
  const [repsSets, setRepsSets] = useState(exercise.repsSets);
  const [weight, setWeight] = useState(exercise.weight);
  const [rpe, setRpe] = useState(exercise.rpe);
  const [notes, setNotes] = useState(exercise.notes);
  const [clientNotes, setClientNotes] = useState(exercise.clientNotes);
  const [coachComment, setCoachComment] = useState(exercise.coachComment);
  const [isCompleted, setIsCompleted] = useState(exercise.isCompleted);
  const isCompletedRef = useRef(exercise.isCompleted);

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

  const contentKey = useMemo(() => {
    if (!isShared) return '';
    if (isCoach) return `${exercise.clientNotes || ''}::${exercise.videoUrl || ''}`;
    return `${exercise.coachComment || ''}`;
  }, [isShared, isCoach, exercise.clientNotes, exercise.videoUrl, exercise.coachComment]);

  const seenStorageKey = `liftflow_ex_seen_${exercise.id}`;

  const markSeen = useCallback(() => {
    setSeenContent(true);
    if (contentKey) {
      AsyncStorage.setItem(seenStorageKey, contentKey);
      AsyncStorage.getItem('liftflow_seen_exercises').then(stored => {
        const map: Record<string, string> = stored ? JSON.parse(stored) : {};
        map[exercise.id] = contentKey;
        AsyncStorage.setItem('liftflow_seen_exercises', JSON.stringify(map));
      });
    }
  }, [contentKey, seenStorageKey, exercise.id]);

  useEffect(() => {
    if (!contentKey) { setSeenContent(true); return; }
    AsyncStorage.getItem(seenStorageKey).then(stored => {
      if (stored === contentKey) {
        setSeenContent(true);
      } else {
        setSeenContent(false);
      }
    });
  }, [contentKey, seenStorageKey]);

  useEffect(() => {
    if (expanded && !forceExpanded && isCoach && isShared && contentKey && !seenContent) {
      markSeen();
    }
  }, [expanded, forceExpanded, isCoach, isShared, contentKey, seenContent, markSeen]);

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
      isCompleted: isCompletedRef.current,
    });
  };

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);
  const skipNextAutoSave = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    if (planLocked) return;
    if (isCoach && isShared) return;
    if (skipNextAutoSave.current) { skipNextAutoSave.current = false; return; }
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      if (!isShared) {
        onUpdate({ name, repsSets, weight, rpe, notes, clientNotes, isCompleted });
      } else {
        onUpdate({ clientNotes, isCompleted });
      }
    }, 800);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [clientNotes, isCompleted, name, repsSets, weight, rpe, notes]);

  const handleToggleComplete = () => {
    const newVal = !isCompleted;
    setIsCompleted(newVal);
    isCompletedRef.current = newVal;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    skipNextAutoSave.current = true;
    if (!isShared) {
      onUpdate({ name, repsSets, weight, rpe, notes, clientNotes, isCompleted: newVal });
    } else {
      onUpdate({ clientNotes, isCompleted: newVal });
    }
  };

  if (canEditAll) {
    return (
      <View style={[styles.exerciseRow, { backgroundColor: colors.backgroundCard, borderColor: colors.border, padding: 10 }, isCompleted && [styles.exerciseRowCompleted, { borderColor: colors.success }]]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          {isShared ? (
            <View style={{ opacity: 0.6 }}>
              <Ionicons
                name={isCompleted ? "checkmark-circle" : "ellipse-outline"}
                size={18}
                color={isCompleted ? colors.success : colors.textMuted}
              />
            </View>
          ) : (
            <Pressable onPress={handleToggleComplete} hitSlop={6}>
              <Ionicons
                name={isCompleted ? "checkmark-circle" : "ellipse-outline"}
                size={18}
                color={isCompleted ? colors.success : colors.textMuted}
              />
            </Pressable>
          )}
          <TextInput
            style={[styles.compactNameInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }, !name && prevWeekExercise?.name ? styles.ghostedInput : null]}
            value={name}
            onChangeText={setName}
            onBlur={saveChanges}
            placeholder={prevWeekExercise?.name || `Exercise ${index + 1}`}
            placeholderTextColor={prevWeekExercise?.name ? colors.textGhost : colors.textMuted}
          />
          {!forceExpanded && (
            <Pressable
              onPress={() => {
                if (!expanded) markSeen();
                if (onToggle) { onToggle(); } else { setLocalExpanded(!localExpanded); }
              }}
              hitSlop={6}
            >
              <Ionicons name={expanded ? "chevron-up" : "ellipsis-horizontal"} size={16} color={colors.textMuted} />
            </Pressable>
          )}
          <Pressable
            onPress={() => confirmAction("Delete Exercise", `Remove "${exercise.name || 'this exercise'}"?`, onDelete, "Delete")}
            hitSlop={6}
          >
            <Ionicons name="close" size={15} color={colors.textMuted} />
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TextInput
            style={[styles.compactFieldInput, { flex: 1, color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }, !repsSets && prevWeekExercise?.repsSets ? styles.ghostedInput : null]}
            value={repsSets}
            onChangeText={setRepsSets}
            onBlur={saveChanges}
            placeholder={prevWeekExercise?.repsSets || "Sets×Reps"}
            placeholderTextColor={prevWeekExercise?.repsSets ? colors.textGhost : colors.textMuted}
          />
          <View style={{ flex: 1 }}>
            <TextInput
              style={[styles.compactFieldInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }, !weight && prevWeekExercise?.weight ? styles.ghostedInput : null]}
              value={weight}
              onChangeText={setWeight}
              onBlur={saveChanges}
              placeholder={prevWeekExercise?.weight || "Weight"}
              placeholderTextColor={prevWeekExercise?.weight ? colors.textGhost : colors.textMuted}
            />
            {suggestionsEnabled && !weight && (() => {
              const suggestion = computeRpeSuggestion(prevWeekExercise);
              if (!suggestion) return null;
              return (
                <Pressable
                  onPress={() => { setWeight(suggestion); saveChanges(); Haptics.selectionAsync(); }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 }}
                >
                  <Ionicons name="flash" size={9} color={colors.gold} />
                  <Text style={{ fontFamily: 'Rubik_500Medium', fontSize: 9, color: colors.gold }}>{suggestion}</Text>
                </Pressable>
              );
            })()}
          </View>
          <TextInput
            style={[styles.compactFieldInput, { width: 50, color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }, !rpe && prevWeekExercise?.rpe ? styles.ghostedInput : null]}
            value={rpe}
            onChangeText={setRpe}
            onBlur={saveChanges}
            placeholder={prevWeekExercise?.rpe || "RPE"}
            placeholderTextColor={prevWeekExercise?.rpe ? colors.textGhost : colors.textMuted}
            keyboardType="decimal-pad"
          />
        </View>
        {expanded && (
          <View style={[styles.exerciseExpanded, { borderTopColor: colors.border, marginTop: 6, paddingBottom: 4 }]}>
            {hasPrevNotes && (
              <View style={{ marginBottom: 6, padding: 6, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                  <Ionicons name="time-outline" size={10} color={colors.textMuted} />
                  <Text style={{ fontFamily: 'Rubik_500Medium', fontSize: 9, color: colors.textMuted }}>Previous Week</Text>
                </View>
                {!!prevWeekExercise?.clientNotes && (
                  <Text style={{ fontFamily: 'Rubik_400Regular', fontSize: 11, color: colors.textSecondary, marginBottom: 1 }}>
                    Client: {prevWeekExercise.clientNotes}
                  </Text>
                )}
                {!!prevWeekExercise?.coachComment && (
                  <Text style={{ fontFamily: 'Rubik_400Regular', fontSize: 11, color: colors.accent, marginBottom: 1 }}>
                    Coach: {prevWeekExercise.coachComment}
                  </Text>
                )}
                {!!prevWeekExercise?.notes && !prevWeekExercise?.clientNotes && !prevWeekExercise?.coachComment && (
                  <Text style={{ fontFamily: 'Rubik_400Regular', fontSize: 11, color: colors.textSecondary }}>
                    {prevWeekExercise.notes}
                  </Text>
                )}
              </View>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 }}>
              <Ionicons name="chatbubble-outline" size={11} color={colors.textSecondary} />
              <Text style={{ fontFamily: 'Rubik_600SemiBold', fontSize: 11, color: colors.textSecondary }}>{isShared ? 'Client Notes' : 'Notes'}</Text>
            </View>
            {(isCoach && isShared) ? (
              <View style={{ backgroundColor: colors.surfaceLight, borderColor: colors.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, minHeight: 28 }}>
                <Text style={{ fontFamily: 'Rubik_400Regular', fontSize: 12, color: colors.textMuted }}>{exercise.clientNotes || 'No client notes'}</Text>
              </View>
            ) : (
              <TextInput
                style={[styles.fieldInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, paddingVertical: 6, fontSize: 12 }]}
                value={notes}
                onChangeText={setNotes}
                onBlur={saveChanges}
                placeholder="Add notes..."
                placeholderTextColor={colors.textMuted}
                multiline
              />
            )}
            {isShared && (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3, marginTop: 6 }}>
                  <Ionicons name="megaphone-outline" size={11} color={colors.accent} />
                  <Text style={{ fontFamily: 'Rubik_600SemiBold', fontSize: 11, color: colors.accent }}>Coach Comment</Text>
                </View>
                <TextInput
                  style={[styles.fieldInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, paddingVertical: 6, fontSize: 12 }]}
                  value={coachComment}
                  onChangeText={setCoachComment}
                  onBlur={saveChanges}
                  placeholder="Add feedback..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                />
              </>
            )}
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.exerciseRow, { backgroundColor: colors.backgroundCard, borderColor: colors.border }, isCompleted && [styles.exerciseRowCompleted, { borderColor: colors.success }]]}>
      <Pressable
        style={styles.exerciseHeader}
        onPress={() => {
          if (!seenContent) markSeen();
          if (onToggle) { onToggle(); } else { setLocalExpanded(!localExpanded); }
        }}
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {exercise.repsSets ? (
                <Text style={[styles.exerciseMeta, { color: colors.textSecondary }]}>{exercise.repsSets}</Text>
              ) : prevWeekExercise?.repsSets ? (
                <Text style={[styles.exerciseMeta, { color: colors.textGhost, fontStyle: 'italic' }]}>{prevWeekExercise.repsSets}</Text>
              ) : (
                <Text style={[styles.exerciseMeta, { color: colors.textSecondary }]}>-</Text>
              )}
              {exercise.weight ? (
                <Text style={[styles.exerciseMeta, { color: colors.textSecondary }]}>@ {exercise.weight}</Text>
              ) : prevWeekExercise?.weight ? (
                <Text style={[styles.exerciseMeta, { color: colors.textGhost, fontStyle: 'italic' }]}>@ {prevWeekExercise.weight}</Text>
              ) : null}
              {exercise.rpe ? (
                <Text style={[styles.exerciseMeta, { color: colors.textSecondary }]}>RPE {exercise.rpe}</Text>
              ) : prevWeekExercise?.rpe ? (
                <Text style={[styles.exerciseMeta, { color: colors.textGhost, fontStyle: 'italic' }]}>RPE {prevWeekExercise.rpe}</Text>
              ) : null}
            </View>
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
          {isShared && !seenContent && isCoach && !!(exercise.clientNotes) && (
            <Ionicons name="chatbubble" size={12} color={colors.accent} />
          )}
          {isShared && !seenContent && isCoach && !!exercise.videoUrl && (
            <Ionicons name="videocam" size={12} color={colors.primary} />
          )}
          {isShared && !seenContent && !isCoach && !!(exercise.coachComment) && (
            <Ionicons name="chatbubble" size={12} color={colors.accent} />
          )}
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
        </View>
      </Pressable>

      {isCoach && isShared && !!exercise.videoUrl && (
        <View style={{ paddingHorizontal: 12, paddingBottom: 10 }}>
          <VideoPlayerInline videoUrl={exercise.videoUrl} isCoach={true} />
        </View>
      )}

      {expanded && (
        <View style={[styles.exerciseExpanded, { borderTopColor: colors.border }]}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Exercise Name</Text>
          {canEditAll ? (
            <TextInput
              style={[styles.fieldInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }, !name && prevWeekExercise?.name ? styles.ghostedInput : null]}
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
                  style={[styles.fieldInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }, !weight && prevWeekExercise?.weight ? styles.ghostedInput : null]}
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
              {suggestionsEnabled && canEditAll && !weight && (() => {
                const suggestion = computeRpeSuggestion(prevWeekExercise);
                if (!suggestion) return null;
                return (
                  <Pressable
                    onPress={() => { setWeight(suggestion); saveChanges(); Haptics.selectionAsync(); }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 }}
                  >
                    <Ionicons name="flash" size={10} color={colors.gold} />
                    <Text style={{ fontFamily: 'Rubik_500Medium', fontSize: 10, color: colors.gold }}>{suggestion}</Text>
                  </Pressable>
                );
              })()}
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

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <Ionicons name="chatbubble-outline" size={12} color={colors.textSecondary} />
            <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginBottom: 0 }]}>{isShared ? 'Client Notes' : 'Notes'}</Text>
          </View>
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <Ionicons name="school-outline" size={12} color={colors.accent} />
                <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginBottom: 0 }]}>Coach Comment</Text>
              </View>
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

          {!isCoach && isShared && (
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
  const { id, highlightExercise, highlightExerciseId, initialWeek, initialDay } = useLocalSearchParams<{ id: string; highlightExercise?: string; highlightExerciseId?: string; initialWeek?: string; initialDay?: string }>();
  const [program, setProgram] = useState<Program | null>(null);
  const [activeWeek, setActiveWeek] = useState(1);
  const [activeDay, setActiveDay] = useState(1);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [isCoach, setIsCoach] = useState<boolean | null>(() => {
    const cached = getCachedProfile();
    return cached ? cached.role === 'coach' : null;
  });
  const [isShared, setIsShared] = useState(false);
  const [profileId, setProfileId] = useState('');
  const [highlightedExerciseId, setHighlightedExerciseId] = useState<string | null>(null);
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
  const [planLocked, setPlanLocked] = useState(false);
  const [planLockMessage, setPlanLockMessage] = useState('');
  const clientAutoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRestoredPositionRef = useRef(false);
  const hasChangesRef = useRef(false);
  const latestProgramRef = useRef<Program | null>(null);
  const lastSavedProgramRef = useRef<Program | null>(null);
  const isCoachRef = useRef<boolean | null>(null);
  const isSharedRef = useRef(false);
  const { uploads } = useUploads();
  const prevUploadStatusRef = useRef<Record<string, string>>({});

  // Watch uploads — apply video URL to program as soon as upload completes
  // (not just on focus, since the screen is already mounted during background uploads)
  useEffect(() => {
    const prev = prevUploadStatusRef.current;
    for (const upload of uploads) {
      if (upload.status === 'done' && prev[upload.id] !== 'done') {
        // This upload just finished — apply trimResult if it's for this program
        if (trimResult.videoUrl && trimResult.exerciseId) {
          const url = trimResult.videoUrl;
          const exId = trimResult.exerciseId;
          trimResult.videoUrl = null;
          trimResult.exerciseId = null;
          const base = latestProgramRef.current;
          if (base) {
            let exName = '';
            const updatedWeeks = base.weeks.map(week => ({
              ...week,
              days: week.days.map(day => ({
                ...day,
                exercises: day.exercises.map(ex => {
                  if (ex.id === exId) { exName = ex.name || ''; return { ...ex, videoUrl: url }; }
                  return ex;
                }),
              })),
            }));
            const updated = { ...base, weeks: updatedWeeks };
            setProgram(updated);
            updateProgram(updated).catch(() => {});
            lastSavedProgramRef.current = updated;
            if (!isCoach && base.coachId) {
              addNotification({
                targetProfileId: base.coachId,
                type: 'video',
                title: 'Form Check Video',
                message: `Video uploaded for ${exName}`,
                programId: base.id,
                programTitle: base.title,
                exerciseName: exName,
                fromRole: 'client',
              });
            }
          }
          setExpandedExerciseId(exId);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    }
    // Snapshot current statuses for next comparison
    const next: Record<string, string> = {};
    for (const u of uploads) next[u.id] = u.status;
    prevUploadStatusRef.current = next;
  }, [uploads, isCoach]);

  useEffect(() => {
    if (!hasRestoredPositionRef.current || !id) return;
    AsyncStorage.setItem(programPositionKey(id), JSON.stringify({ week: activeWeek, day: activeDay })).catch(() => {});
  }, [activeWeek, activeDay]);

  useEffect(() => {
    if (id) {
      Promise.all([getProgram(id), getProfile(), AsyncStorage.getItem(programPositionKey(id)).catch(() => null)]).catch(() => [null, null, null] as const).then(async ([p, prof, savedPos]) => {
        if (p) {
          if (highlightExerciseId) {
            const weekNum = initialWeek ? parseInt(initialWeek as string, 10) : 0;
            const dayNum = initialDay ? parseInt(initialDay as string, 10) : 0;
            if (weekNum && dayNum) {
              setActiveWeek(weekNum);
              setActiveDay(dayNum);
            }
            setHighlightedExerciseId(highlightExerciseId);
            setExpandedExerciseId(highlightExerciseId);
          } else if (highlightExercise) {
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
                  setExpandedExerciseId(found.id);
                  matched = true;
                  break;
                }
              }
            }
          } else if (initialWeek) {
            const weekNum = parseInt(initialWeek as string, 10);
            const dayNum = initialDay ? parseInt(initialDay as string, 10) : 1;
            const weekExists = p.weeks.some(w => w.weekNumber === weekNum);
            if (weekExists) {
              setActiveWeek(weekNum);
              const dayExists = p.weeks.find(w => w.weekNumber === weekNum)?.days.some(d => d.dayNumber === dayNum);
              setActiveDay(dayExists ? dayNum : 1);
            }
          } else if (savedPos) {
            try {
              const { week, day } = JSON.parse(savedPos);
              const weekExists = p.weeks.some(w => w.weekNumber === week);
              if (weekExists) {
                const dayExists = p.weeks.find(w => w.weekNumber === week)?.days.some(d => d.dayNumber === day);
                setActiveWeek(week);
                setActiveDay(dayExists ? day : 1);
              }
            } catch {}
          }
          hasRestoredPositionRef.current = true;
          lastSavedProgramRef.current = p;
          setProgram(p);
        }
        const shared = !!p?.clientId;
        setIsShared(shared);
        setIsCoach(prof.role === 'coach');
        setProfileId(prof.id);
        markNotificationsReadByProgram(id).catch(() => {});
        if (prof.role === 'coach' && shared && p) {
          AsyncStorage.getItem('liftflow_seen_exercises').then(stored => {
            const map: Record<string, string> = stored ? JSON.parse(stored) : {};
            let updated = false;
            for (const week of p.weeks) {
              for (const day of week.days) {
                for (const ex of day.exercises) {
                  const ck = `${ex.clientNotes || ''}::${ex.videoUrl || ''}`;
                  if (ck !== '::' && map[ex.id] !== ck) {
                    map[ex.id] = ck;
                    updated = true;
                  }
                }
              }
            }
            if (updated) AsyncStorage.setItem('liftflow_seen_exercises', JSON.stringify(map));
          }).catch(() => {});
        }

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
      setExpandedExerciseId(exId);
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
      }, 500);
      return () => { if (clientAutoSaveRef.current) clearTimeout(clientAutoSaveRef.current); };
    }
  }, [hasChanges, isCoach, program]);

  // Keep refs in sync so the unmount flush always has the latest values
  useEffect(() => { hasChangesRef.current = hasChanges; }, [hasChanges]);
  useEffect(() => { latestProgramRef.current = program; }, [program]);
  useEffect(() => { isCoachRef.current = isCoach; }, [isCoach]);
  useEffect(() => { isSharedRef.current = isShared; }, [isShared]);

  // Flush any unsaved changes to cache+server when the screen unmounts,
  // so the progress bars always reflect reality even after quick navigation.
  useEffect(() => {
    return () => {
      if (hasChangesRef.current && latestProgramRef.current && (!isCoachRef.current || !isSharedRef.current)) {
        updateProgram(latestProgramRef.current).catch(() => {});
      }
    };
  }, []);

  const save = useCallback(async () => {
    if (!program) return;
    if (planLocked) {
      showAlert('Plan Limit Exceeded', planLockMessage || 'Upgrade your plan to edit shared programs.');
      return;
    }
    const oldProgram = lastSavedProgramRef.current;

    setHasChanges(false);
    setSaveError(false);

    try {
      await updateProgram(program);
      lastSavedProgramRef.current = program;
    } catch (e: any) {
      setSaveError(true);
      showAlert('Save Error', 'Couldn\'t save. Tap Save to retry.');
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

    // Auto exercise PR logging disabled
    // if (!isCoach) { ... }
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
              repsSets: '',
              weight: '',
              rpe: '',
              isCompleted: false,
              notes: '',
              clientNotes: '',
              coachComment: '',
              videoUrl: '',
            }))
          : [],
      });
    }
    const newWeek: WorkoutWeek = { weekNumber: newWeekNumber, days: newDays };
    const currentWeekCount = program.weeks.length;
    const updated = { ...program, weeks: [...program.weeks, newWeek] };
    if (isShared) {
      updated.publishedWeeks = program.publishedWeeks ?? 0;
    }
    setProgram(updated);
    setActiveWeek(newWeekNumber);
    setHasChanges(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [program, isShared]);

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

  const publishedWeeks = program?.publishedWeeks ?? (isShared ? 0 : (program?.weeks.length ?? 0));
  const isDraftWeek = isShared && (isCoach || false) && activeWeek > publishedWeeks;

  const visibleWeeks = useMemo(() => {
    if (!program) return [];
    if (isCoach || !isShared) return program.weeks;
    const pw = program.publishedWeeks ?? (isShared ? 0 : program.weeks.length);
    return program.weeks.filter(w => w.weekNumber <= pw);
  }, [program, isCoach, isShared]);

  const currentWeek = program?.weeks.find(w => w.weekNumber === activeWeek);
  const currentDay = currentWeek?.days.find(d => d.dayNumber === activeDay);
  const exercises = currentDay?.exercises || [];

  const prevWeekDay = useMemo(() => {
    if (!program || activeWeek <= 1) return null;
    const prevWeek = program.weeks.find(w => w.weekNumber === activeWeek - 1);
    return prevWeek?.days.find(d => d.dayNumber === activeDay) || null;
  }, [program, activeWeek, activeDay]);

  const [suggestionsEnabled, setSuggestionsEnabled] = useState(false);
  useEffect(() => {
    if (!program) return;
    AsyncStorage.getItem(`liftflow_suggestions_${program.id}`).then(val => {
      if (val === 'true') setSuggestionsEnabled(true);
    }).catch(() => {});
  }, [program?.id]);

  const toggleSuggestions = useCallback(() => {
    if (!program) return;
    const next = !suggestionsEnabled;
    setSuggestionsEnabled(next);
    AsyncStorage.setItem(`liftflow_suggestions_${program.id}`, next ? 'true' : 'false').catch(() => {});
    Haptics.selectionAsync();
  }, [program, suggestionsEnabled]);

  const publishWeeks = useCallback(() => {
    if (!program) return;
    confirmAction(
      'Publish All Weeks',
      `This will make all ${program.weeks.length} weeks visible to your client. Continue?`,
      () => {
        const updated = { ...program, publishedWeeks: program.weeks.length };
        setProgram(updated);
        setHasChanges(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
      'Publish'
    );
  }, [program]);

  const weekProgress = (() => {
    if (!currentWeek) return 0;
    let total = 0;
    let completed = 0;
    for (const day of currentWeek.days) {
      for (const ex of day.exercises) {
        total++;
        if (ex.isCompleted) completed++;
      }
    }
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  })();

  const dayTotal = exercises.length;
  const dayCompleted = exercises.filter(ex => ex.isCompleted).length;
  const dayPct = dayTotal > 0 ? Math.round((dayCompleted / dayTotal) * 100) : 0;

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
        const updated = { ...program, weeks: renumbered };
        if (isShared && program.publishedWeeks != null) {
          updated.publishedWeeks = Math.min(program.publishedWeeks, renumbered.length);
        }
        setProgram(updated);
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
              <Ionicons name="checkmark-circle" size={26} color={saveError ? colors.danger : hasChanges ? colors.primary : colors.textMuted} />
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
          {visibleWeeks.map(week => {
            const weekIsDraft = isShared && week.weekNumber > publishedWeeks;
            return (
              <View key={week.weekNumber} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Pressable
                  style={[styles.weekChip, { backgroundColor: colors.backgroundCard, borderColor: weekIsDraft ? colors.warning : colors.border }, activeWeek === week.weekNumber && [styles.weekChipActive, { backgroundColor: weekIsDraft ? colors.warning : colors.primary, borderColor: weekIsDraft ? colors.warning : colors.primary }]]}
                  onPress={() => { Haptics.selectionAsync(); setActiveWeek(week.weekNumber); setActiveDay(1); }}
                  onLongPress={() => {
                    if ((isCoach || !isShared) && !planLocked) {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      deleteWeek(week.weekNumber);
                    }
                  }}
                >
                  <Text style={[styles.weekChipText, { color: weekIsDraft ? colors.warning : colors.textSecondary }, activeWeek === week.weekNumber && styles.weekChipTextActive]}>
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
            );
          })}
          {(isCoach || !isShared) && (
            <Pressable style={[styles.addWeekChip, { borderColor: colors.primary }]} onPress={addWeek} accessibilityLabel="Add week" accessibilityRole="button">
              <Ionicons name="add" size={16} color={colors.primary} />
            </Pressable>
          )}
        </ScrollView>
        <View style={styles.weekProgressRow}>
          {isDraftWeek && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 8 }}>
              <Ionicons name="eye-off" size={12} color={colors.warning} />
              <Text style={{ fontFamily: 'Rubik_600SemiBold', fontSize: 11, color: colors.warning }}>Draft</Text>
            </View>
          )}
          {isShared && isCoach && program.weeks.length > publishedWeeks && (
            <Pressable
              onPress={publishWeeks}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 8, backgroundColor: 'rgba(52,199,89,0.12)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}
            >
              <Ionicons name="paper-plane" size={11} color={colors.success} />
              <Text style={{ fontFamily: 'Rubik_600SemiBold', fontSize: 11, color: colors.success }}>Publish</Text>
            </Pressable>
          )}
          <View style={[styles.weekProgressBar, { backgroundColor: colors.surfaceLight, flex: 1 }]}>
            <View style={[styles.weekProgressFill, { width: `${weekProgress}%`, backgroundColor: colors.success }]} />
          </View>
          <Text style={[styles.weekProgressText, { color: colors.textSecondary }]}>{weekProgress}%</Text>
        </View>
      </View>

      {(isCoach || !isShared) && (
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 2 }}>
          <Pressable
            onPress={toggleSuggestions}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: suggestionsEnabled ? 'rgba(255,184,0,0.12)' : colors.backgroundCard, borderWidth: 1, borderColor: suggestionsEnabled ? colors.gold : colors.border }}
          >
            <Ionicons name="flash" size={13} color={suggestionsEnabled ? colors.gold : colors.textMuted} />
            <Text style={{ fontFamily: 'Rubik_500Medium', fontSize: 11, color: suggestionsEnabled ? colors.gold : colors.textMuted }}>Auto-Suggest</Text>
          </Pressable>
        </View>
      )}

      <View style={[styles.daySelector, { borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayScrollContent}>
          {(currentWeek?.days || []).map(day => {
            const dayExercises = day.exercises || [];
            const allDone = dayExercises.length > 0 && dayExercises.every(e => e.isCompleted);
            return (
            <View key={day.dayNumber} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable
                style={[styles.dayChip, { backgroundColor: colors.backgroundCard, borderColor: colors.border }, activeDay === day.dayNumber && [styles.dayChipActive, { backgroundColor: colors.accent, borderColor: colors.accent }], allDone && activeDay !== day.dayNumber && { borderColor: colors.success }]}
                onPress={() => { Haptics.selectionAsync(); setActiveDay(day.dayNumber); }}
                onLongPress={() => {
                  if (isCoach || !isShared) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    deleteDay(day.dayNumber);
                  }
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  {allDone && <Ionicons name="checkmark-circle" size={13} color={activeDay === day.dayNumber ? '#fff' : colors.success} />}
                  <Text style={[styles.dayChipText, { color: colors.textSecondary }, activeDay === day.dayNumber && styles.dayChipTextActive]}>
                    Day {day.dayNumber}
                  </Text>
                </View>
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
          ); })}
        </ScrollView>
      </View>

      {(!isCoach && isShared) && dayTotal > 0 && (
        <View style={[styles.dayProgressBar, { borderBottomColor: colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ fontFamily: 'Rubik_400Regular', fontSize: 11, color: '#888' }}>{dayCompleted} of {dayTotal} exercises</Text>
            <Text style={{ fontFamily: 'Rubik_600SemiBold', fontSize: 11, color: Colors.colors.primary }}>{dayPct}%</Text>
          </View>
          <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <LinearGradient
              colors={['#E8512F', '#FF8C42']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ height: '100%', width: `${dayPct}%` as any, borderRadius: 2 }}
            />
          </View>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + ((!isCoach && isShared) ? 90 : (hasChanges || saveError) ? 80 : 20) + (uploads.length > 0 ? 72 : 0), paddingHorizontal: 16, paddingTop: 8 }}
      >
        {exercises.length === 0 ? (
          <View style={styles.emptyDay}>
            <Ionicons name="barbell-outline" size={32} color={colors.textMuted} />
            <Text style={[styles.emptyDayText, { color: colors.textMuted }]}>No exercises for this day</Text>
          </View>
        ) : (
          exercises.map((ex, idx) => (
            <Animated.View key={ex.id} entering={FadeInDown.delay(idx * 40).duration(250)}>
              {(!isCoach && isShared) ? (
                <ClientExerciseCard
                  exercise={ex}
                  index={idx}
                  onUpdate={(updates) => updateExercise(ex.id, updates)}
                  prevWeekExercise={prevWeekDay?.exercises[idx] || null}
                  programId={program.id}
                  coachId={program.coachId}
                  profileId={profileId}
                />
              ) : (
                <ExerciseRow
                  exercise={ex}
                  index={idx}
                  isCoach={isCoach ?? false}
                  isShared={isShared}
                  onUpdate={(updates) => updateExercise(ex.id, updates)}
                  onDelete={() => deleteExercise(ex.id)}
                  prevWeekExercise={prevWeekDay?.exercises[idx] || null}
                  programId={program.id}
                  coachId={program.coachId}
                  profileId={profileId}
                  initialExpanded={false}
                  planLocked={false}
                  isExpanded={expandedExerciseId === ex.id}
                  onToggle={() => setExpandedExerciseId(prev => prev === ex.id ? null : ex.id)}
                  suggestionsEnabled={suggestionsEnabled}
                />
              )}
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

      {(!isCoach && isShared) && (
        <View style={[styles.finishWorkoutBar, { paddingBottom: insets.bottom + 10, backgroundColor: 'rgba(15,15,15,0.97)', borderTopColor: colors.border }]}>
          <Pressable
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            }}
          >
            <LinearGradient
              colors={['#E8512F', '#FF8C42']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.finishWorkoutBtn}
            >
              <Text style={styles.finishWorkoutText}>Finish Workout</Text>
            </LinearGradient>
          </Pressable>
        </View>
      )}

      {(hasChanges || saveError) && !planLocked && (isCoach || !isShared) && (
        <Animated.View entering={FadeIn.duration(200)} style={[styles.saveBar, { paddingBottom: insets.bottom + 10, backgroundColor: colors.backgroundElevated, borderTopColor: colors.border }]}>
          <View style={[styles.saveBarDot, { backgroundColor: saveError ? colors.danger : colors.warning }]} />
          <Text style={[styles.saveBarText, { color: colors.textSecondary }]}>{saveError ? 'Save failed' : 'Unsaved changes'}</Text>
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
  compactNameInput: {
    flex: 1, fontFamily: 'Rubik_600SemiBold', fontSize: 13,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
    borderWidth: 1, backgroundColor: Colors.colors.surface,
  },
  compactFieldInput: {
    fontFamily: 'Rubik_400Regular', fontSize: 12,
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6,
    borderWidth: 1, backgroundColor: Colors.colors.surface,
  },
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
  exerciseExpanded: { paddingHorizontal: 14, paddingBottom: 8, borderTopWidth: 1, borderTopColor: Colors.colors.border },
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
  videoPlayer: Platform.OS === 'web'
    ? { width: '100%', height: 400, backgroundColor: '#000' }
    : { width: '100%', aspectRatio: 9 / 16, backgroundColor: '#000' },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlayBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 3,
  },
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
  clientExCard: {
    borderRadius: 16, borderWidth: 1, marginBottom: 10,
    padding: 14, backgroundColor: Colors.colors.backgroundCard,
  },
  clientExHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  clientExCheck: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
  },
  clientExName: { fontFamily: 'Rubik_700Bold', fontSize: 14, color: Colors.colors.text },
  clientExMeta: { fontFamily: 'Rubik_400Regular', fontSize: 12, color: Colors.colors.textMuted, marginTop: 2 },
  clientExVideoBadge: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, flexShrink: 0, marginTop: 1,
  },
  clientExCoachNote: {
    fontFamily: 'Rubik_400Regular', fontSize: 11, color: Colors.colors.textMuted,
    fontStyle: 'italic', marginTop: 8, marginLeft: 34,
  },
  clientExActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  clientExUploadBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    borderWidth: 1, borderRadius: 8, paddingVertical: 9,
  },
  clientExUploadText: { fontFamily: 'Rubik_600SemiBold', fontSize: 12 },
  clientExMarkDoneBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    borderRadius: 8, paddingVertical: 9,
  },
  clientExMarkDoneText: { fontFamily: 'Rubik_700Bold', fontSize: 12, color: '#fff' },
  dayProgressBar: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.colors.border,
  },
  finishWorkoutBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: Colors.colors.border,
  },
  finishWorkoutBtn: {
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  finishWorkoutText: { fontFamily: 'Rubik_700Bold', fontSize: 15, color: '#fff', letterSpacing: 0.3 },
});
