import { StyleSheet, Text, View, Pressable, Platform, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState, useRef, useCallback, useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { uploadVideo } from "@/lib/api";
import { showAlert } from "@/lib/confirm";
import { trimResult } from "@/lib/trim-result";

const MAX_DURATION = 60;

export default function TrimVideoScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    videoUri: string;
    videoDuration: string;
    programId: string;
    exerciseId: string;
    uploadedBy: string;
    coachId: string;
    exerciseName: string;
  }>();

  const videoUri = params.videoUri || '';
  const totalDuration = Math.floor(Number(params.videoDuration || '0') / 1000);
  const programId = params.programId || '';
  const exerciseId = params.exerciseId || '';
  const uploadedBy = params.uploadedBy || '';
  const coachId = params.coachId || '';
  const exerciseName = params.exerciseName || 'Exercise';

  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(Math.min(totalDuration, MAX_DURATION));
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState<'start' | 'end' | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const trackRef = useRef<View>(null);
  const trackWidth = useRef(0);

  const clipDuration = endTime - startTime;
  const isValidClip = clipDuration > 0 && clipDuration <= MAX_DURATION;

  const player = useVideoPlayer(videoUri, (p) => {
    p.loop = true;
    p.play();
    p.currentTime = startTime;
  });

  useEffect(() => {
    if (!player) return;
    const sub = player.addListener('timeUpdate', ({ currentTime: ct }) => {
      setCurrentTime(ct);
      if (ct >= endTime) {
        player.currentTime = startTime;
      }
    });
    return () => sub.remove();
  }, [player, startTime, endTime]);

  const seekToStart = useCallback(() => {
    if (player) {
      player.currentTime = startTime;
      player.play();
    }
  }, [player, startTime]);

  const handleTrackLayout = useCallback((e: any) => {
    trackWidth.current = e.nativeEvent.layout.width;
  }, []);

  const handleTrackPress = useCallback((e: any) => {
    if (totalDuration <= 0 || trackWidth.current <= 0) return;
    const x = e.nativeEvent.locationX;
    const time = Math.round((x / trackWidth.current) * totalDuration);

    const distToStart = Math.abs(time - startTime);
    const distToEnd = Math.abs(time - endTime);

    if (distToStart < distToEnd) {
      const newStart = Math.max(0, Math.min(time, endTime - 1));
      if (endTime - newStart <= MAX_DURATION) {
        setStartTime(newStart);
        if (player) player.currentTime = newStart;
      }
    } else {
      const newEnd = Math.min(totalDuration, Math.max(time, startTime + 1));
      if (newEnd - startTime <= MAX_DURATION) {
        setEndTime(newEnd);
      }
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [totalDuration, startTime, endTime, player]);

  const nudge = useCallback((which: 'start' | 'end', delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (which === 'start') {
      const newStart = Math.max(0, Math.min(startTime + delta, endTime - 1));
      if (endTime - newStart <= MAX_DURATION) {
        setStartTime(newStart);
        if (player) player.currentTime = newStart;
      }
    } else {
      const newEnd = Math.min(totalDuration, Math.max(endTime + delta, startTime + 1));
      if (newEnd - startTime <= MAX_DURATION) {
        setEndTime(newEnd);
      }
    }
  }, [startTime, endTime, totalDuration, player]);

  const handleSubmit = async () => {
    if (!isValidClip) return;
    setUploading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const serverUrl = await uploadVideo(videoUri, {
        programId,
        exerciseId,
        uploadedBy,
        coachId,
      }, { startTime, endTime });
      trimResult.videoUrl = serverUrl;
      trimResult.exerciseId = exerciseId;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err: any) {
      showAlert("Upload Failed", "Failed to upload the trimmed video. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="close" size={24} color={Colors.colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>Trim Video</Text>
          <Text style={styles.headerSub} numberOfLines={1}>{exerciseName}</Text>
        </View>
      </View>

      <View style={styles.videoContainer}>
        <VideoView
          player={player}
          style={styles.video}
          nativeControls={false}
          contentFit="contain"
        />
      </View>

      <View style={styles.controls}>
        <Text style={styles.instructionText}>
          Select up to 60 seconds from your {formatTime(totalDuration)} video
        </Text>

        <View style={styles.timeRow}>
          <View style={styles.timeBlock}>
            <Text style={styles.timeLabel}>Start</Text>
            <View style={styles.timeControls}>
              <Pressable onPress={() => nudge('start', -5)} hitSlop={8} style={styles.nudgeBtn}>
                <Ionicons name="remove" size={16} color={Colors.colors.text} />
              </Pressable>
              <Text style={styles.timeValue}>{formatTime(startTime)}</Text>
              <Pressable onPress={() => nudge('start', 5)} hitSlop={8} style={styles.nudgeBtn}>
                <Ionicons name="add" size={16} color={Colors.colors.text} />
              </Pressable>
            </View>
          </View>

          <View style={styles.durationBadge}>
            <Ionicons name="time-outline" size={14} color={clipDuration > MAX_DURATION ? Colors.colors.danger : Colors.colors.primary} />
            <Text style={[styles.durationText, clipDuration > MAX_DURATION && { color: Colors.colors.danger }]}>
              {formatTime(clipDuration)}
            </Text>
          </View>

          <View style={styles.timeBlock}>
            <Text style={styles.timeLabel}>End</Text>
            <View style={styles.timeControls}>
              <Pressable onPress={() => nudge('end', -5)} hitSlop={8} style={styles.nudgeBtn}>
                <Ionicons name="remove" size={16} color={Colors.colors.text} />
              </Pressable>
              <Text style={styles.timeValue}>{formatTime(endTime)}</Text>
              <Pressable onPress={() => nudge('end', 5)} hitSlop={8} style={styles.nudgeBtn}>
                <Ionicons name="add" size={16} color={Colors.colors.text} />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.trackContainer}>
          <View
            ref={trackRef}
            style={styles.track}
            onLayout={handleTrackLayout}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={handleTrackPress} />

            <View
              style={[
                styles.selectedRegion,
                {
                  left: `${(startTime / totalDuration) * 100}%`,
                  width: `${((endTime - startTime) / totalDuration) * 100}%`,
                },
              ]}
            />

            <View
              style={[
                styles.handleBar,
                { left: `${(startTime / totalDuration) * 100}%` },
              ]}
            >
              <View style={styles.handleInner} />
            </View>

            <View
              style={[
                styles.handleBar,
                { left: `${(endTime / totalDuration) * 100}%` },
              ]}
            >
              <View style={styles.handleInner} />
            </View>

            {totalDuration > 0 && (
              <View
                style={[
                  styles.playhead,
                  { left: `${(currentTime / totalDuration) * 100}%` },
                ]}
              />
            )}
          </View>
          <View style={styles.trackLabels}>
            <Text style={styles.trackLabelText}>0:00</Text>
            <Text style={styles.trackLabelText}>{formatTime(totalDuration)}</Text>
          </View>
        </View>

        <Pressable onPress={seekToStart} style={styles.previewBtn}>
          <Ionicons name="play" size={16} color={Colors.colors.primary} />
          <Text style={styles.previewBtnText}>Preview from start</Text>
        </Pressable>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={[styles.submitBtn, (!isValidClip || uploading) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!isValidClip || uploading}
        >
          {uploading ? (
            <>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.submitBtnText}>Uploading & Trimming...</Text>
            </>
          ) : (
            <>
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={styles.submitBtnText}>
                Upload {formatTime(clipDuration)} clip
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontFamily: 'Rubik_600SemiBold', fontSize: 18, color: Colors.colors.text },
  headerSub: { fontFamily: 'Rubik_400Regular', fontSize: 13, color: Colors.colors.textMuted, marginTop: 2 },
  videoContainer: {
    flex: 1, maxHeight: 300, marginHorizontal: 20, borderRadius: 12, overflow: 'hidden',
    backgroundColor: '#000',
  },
  video: { flex: 1, width: '100%' },
  controls: { paddingHorizontal: 20, paddingTop: 20, gap: 16 },
  instructionText: {
    fontFamily: 'Rubik_400Regular', fontSize: 14, color: Colors.colors.textSecondary, textAlign: 'center',
  },
  timeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
  },
  timeBlock: { alignItems: 'center', gap: 6 },
  timeLabel: { fontFamily: 'Rubik_500Medium', fontSize: 12, color: Colors.colors.textMuted, textTransform: 'uppercase' },
  timeControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nudgeBtn: {
    width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.colors.surface, borderWidth: 1, borderColor: Colors.colors.border,
  },
  timeValue: { fontFamily: 'Rubik_700Bold', fontSize: 18, color: Colors.colors.text, minWidth: 50, textAlign: 'center' },
  durationBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(232,81,47,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  durationText: { fontFamily: 'Rubik_600SemiBold', fontSize: 14, color: Colors.colors.primary },
  trackContainer: { marginTop: 4 },
  track: {
    height: 40, backgroundColor: Colors.colors.surface, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.colors.border, overflow: 'hidden', position: 'relative',
  },
  selectedRegion: {
    position: 'absolute', top: 0, bottom: 0,
    backgroundColor: 'rgba(232,81,47,0.25)', borderWidth: 2, borderColor: Colors.colors.primary, borderRadius: 4,
  },
  handleBar: {
    position: 'absolute', top: -4, bottom: -4, width: 16, marginLeft: -8,
    alignItems: 'center', justifyContent: 'center',
  },
  handleInner: {
    width: 4, height: 24, borderRadius: 2, backgroundColor: Colors.colors.primary,
  },
  playhead: {
    position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: '#fff', marginLeft: -1,
  },
  trackLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  trackLabelText: { fontFamily: 'Rubik_400Regular', fontSize: 11, color: Colors.colors.textMuted },
  previewBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8,
  },
  previewBtnText: { fontFamily: 'Rubik_500Medium', fontSize: 14, color: Colors.colors.primary },
  footer: { paddingHorizontal: 20, paddingTop: 12 },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.colors.primary, paddingVertical: 16, borderRadius: 12,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontFamily: 'Rubik_600SemiBold', fontSize: 16, color: '#fff' },
});
