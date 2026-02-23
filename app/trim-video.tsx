import { StyleSheet, Text, View, Pressable, Platform, ActivityIndicator, PanResponder, GestureResponderEvent, PanResponderGestureState } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { uploadVideo } from "@/lib/api";
import { showAlert } from "@/lib/confirm";
import { trimResult } from "@/lib/trim-result";

const MAX_DURATION = 60;
const HANDLE_WIDTH = 24;

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
  const totalDurationMs = Number(params.videoDuration || '0');
  const totalDuration = Math.max(1, Math.round(totalDurationMs / 1000));
  const programId = params.programId || '';
  const exerciseId = params.exerciseId || '';
  const uploadedBy = params.uploadedBy || '';
  const coachId = params.coachId || '';
  const exerciseName = params.exerciseName || 'Exercise';
  const needsTrim = totalDuration > MAX_DURATION;

  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(Math.min(totalDuration, MAX_DURATION));
  const [uploading, setUploading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [trackLayout, setTrackLayout] = useState({ x: 0, width: 0 });
  const trackRef = useRef<View>(null);

  const clipDuration = endTime - startTime;
  const isValidClip = clipDuration > 0 && clipDuration <= MAX_DURATION;

  const player = useVideoPlayer(videoUri || null, (p) => {
    p.loop = true;
    p.play();
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

  const measureTrack = useCallback(() => {
    trackRef.current?.measureInWindow((x, _y, width) => {
      if (width > 0) setTrackLayout({ x, width });
    });
  }, []);

  const handleTrackLayout = useCallback(() => {
    setTimeout(measureTrack, 100);
  }, [measureTrack]);

  const clampTime = (t: number) => Math.max(0, Math.min(totalDuration, Math.round(t)));

  const timeToX = (t: number) => {
    if (totalDuration <= 0 || trackLayout.width <= 0) return 0;
    return (t / totalDuration) * trackLayout.width;
  };

  const xToTime = (x: number) => {
    if (trackLayout.width <= 0) return 0;
    return (x / trackLayout.width) * totalDuration;
  };

  const dragStartRef = useRef({ startTime: 0, endTime: 0 });

  const startPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      dragStartRef.current = { startTime, endTime };
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    onPanResponderMove: (_: GestureResponderEvent, gs: PanResponderGestureState) => {
      const deltaTime = xToTime(gs.dx);
      let newStart = clampTime(dragStartRef.current.startTime + deltaTime);
      const currentEnd = dragStartRef.current.endTime;
      if (newStart >= currentEnd - 1) newStart = currentEnd - 1;
      if (currentEnd - newStart > MAX_DURATION) newStart = currentEnd - MAX_DURATION;
      if (newStart < 0) newStart = 0;
      setStartTime(newStart);
      if (player) player.currentTime = newStart;
    },
    onPanResponderRelease: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
  }), [startTime, endTime, totalDuration, trackLayout.width, player]);

  const endPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      dragStartRef.current = { startTime, endTime };
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    onPanResponderMove: (_: GestureResponderEvent, gs: PanResponderGestureState) => {
      const deltaTime = xToTime(gs.dx);
      let newEnd = clampTime(dragStartRef.current.endTime + deltaTime);
      const currentStart = dragStartRef.current.startTime;
      if (newEnd <= currentStart + 1) newEnd = currentStart + 1;
      if (newEnd - currentStart > MAX_DURATION) newEnd = currentStart + MAX_DURATION;
      if (newEnd > totalDuration) newEnd = totalDuration;
      setEndTime(newEnd);
    },
    onPanResponderRelease: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
  }), [startTime, endTime, totalDuration, trackLayout.width]);

  const regionPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 3,
    onPanResponderGrant: () => {
      dragStartRef.current = { startTime, endTime };
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    onPanResponderMove: (_: GestureResponderEvent, gs: PanResponderGestureState) => {
      const deltaTime = xToTime(gs.dx);
      const dur = dragStartRef.current.endTime - dragStartRef.current.startTime;
      let newStart = dragStartRef.current.startTime + deltaTime;
      let newEnd = newStart + dur;
      if (newStart < 0) { newStart = 0; newEnd = dur; }
      if (newEnd > totalDuration) { newEnd = totalDuration; newStart = totalDuration - dur; }
      setStartTime(clampTime(newStart));
      setEndTime(clampTime(newEnd));
      if (player) player.currentTime = clampTime(newStart);
    },
    onPanResponderRelease: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
  }), [startTime, endTime, totalDuration, trackLayout.width, player]);

  const handleSubmit = async () => {
    if (!isValidClip) return;
    setUploading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const shouldTrim = startTime > 0 || endTime < totalDuration;
      const serverUrl = await uploadVideo(videoUri, {
        programId,
        exerciseId,
        uploadedBy,
        coachId,
      }, shouldTrim ? { startTime, endTime } : undefined);
      trimResult.videoUrl = serverUrl;
      trimResult.exerciseId = exerciseId;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err: any) {
      showAlert("Upload Failed", "Failed to upload the video. Please try again.");
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

  const startX = timeToX(startTime);
  const endX = timeToX(endTime);
  const selectedWidth = endX - startX;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn} accessibilityLabel="Close" accessibilityRole="button">
          <Ionicons name="close" size={24} color={Colors.colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>Trim & Upload</Text>
          <Text style={styles.headerSub} numberOfLines={1}>{exerciseName}</Text>
        </View>
        <View style={styles.durationBadge}>
          <Ionicons name="time-outline" size={14} color={clipDuration > MAX_DURATION ? Colors.colors.danger : Colors.colors.primary} />
          <Text style={[styles.durationText, clipDuration > MAX_DURATION && { color: Colors.colors.danger }]}>
            {formatTime(clipDuration)}
          </Text>
        </View>
      </View>

      <View style={styles.videoContainer}>
        {videoUri ? (
          <VideoView
            player={player}
            style={styles.video}
            nativeControls={false}
            contentFit="contain"
          />
        ) : (
          <View style={styles.videoPlaceholder}>
            <Ionicons name="videocam-off" size={48} color={Colors.colors.textMuted} />
            <Text style={styles.videoPlaceholderText}>Video not available</Text>
          </View>
        )}
      </View>

      <View style={styles.controls}>
        {needsTrim ? (
          <Text style={styles.instructionText}>
            Drag the handles to select up to 60s from your {formatTime(totalDuration)} video
          </Text>
        ) : (
          <Text style={styles.instructionText}>
            Adjust clip range or upload the full {formatTime(totalDuration)} video
          </Text>
        )}

        <View style={styles.timeDisplay}>
          <View style={styles.timePill}>
            <Text style={styles.timePillLabel}>Start</Text>
            <Text style={styles.timePillValue}>{formatTime(startTime)}</Text>
          </View>
          <Ionicons name="arrow-forward" size={16} color={Colors.colors.textMuted} />
          <View style={styles.timePill}>
            <Text style={styles.timePillLabel}>End</Text>
            <Text style={styles.timePillValue}>{formatTime(endTime)}</Text>
          </View>
        </View>

        <View style={styles.sliderArea}>
          <View
            ref={trackRef}
            style={styles.track}
            onLayout={handleTrackLayout}
          >
            <View style={[styles.dimRegion, { left: 0, width: startX }]} />
            <View style={[styles.dimRegion, { left: endX, right: 0 }]} />

            <View
              style={[styles.selectedRegion, { left: startX, width: Math.max(selectedWidth, 2) }]}
              {...regionPanResponder.panHandlers}
            />

            <View
              style={[styles.handle, styles.handleLeft, { left: startX - HANDLE_WIDTH / 2 }]}
              {...startPanResponder.panHandlers}
            >
              <View style={styles.handleGrip}>
                <View style={styles.gripLine} />
                <View style={styles.gripLine} />
              </View>
            </View>

            <View
              style={[styles.handle, styles.handleRight, { left: endX - HANDLE_WIDTH / 2 }]}
              {...endPanResponder.panHandlers}
            >
              <View style={styles.handleGrip}>
                <View style={styles.gripLine} />
                <View style={styles.gripLine} />
              </View>
            </View>

            {totalDuration > 0 && (
              <View
                style={[styles.playhead, { left: timeToX(currentTime) - 1 }]}
              />
            )}
          </View>
          <View style={styles.trackLabels}>
            <Text style={styles.trackLabelText}>0:00</Text>
            <Text style={styles.trackLabelText}>{formatTime(totalDuration)}</Text>
          </View>
        </View>

        <Pressable onPress={seekToStart} style={styles.previewBtn} accessibilityLabel="Preview from start" accessibilityRole="button">
          <Ionicons name="play" size={16} color={Colors.colors.primary} />
          <Text style={styles.previewBtnText}>Preview clip</Text>
        </Pressable>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <Pressable
          style={[styles.submitBtn, (!isValidClip || uploading) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!isValidClip || uploading}
          accessibilityLabel="Upload video" accessibilityRole="button"
        >
          {uploading ? (
            <>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.submitBtnText}>Uploading...</Text>
            </>
          ) : (
            <>
              <Ionicons name="cloud-upload" size={20} color="#fff" />
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
  durationBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(232,81,47,0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
  },
  durationText: { fontFamily: 'Rubik_600SemiBold', fontSize: 14, color: Colors.colors.primary },
  videoContainer: {
    flex: 1, maxHeight: 320, marginHorizontal: 16, borderRadius: 12, overflow: 'hidden',
    backgroundColor: '#000',
  },
  video: { flex: 1, width: '100%' },
  videoPlaceholder: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  videoPlaceholderText: { fontFamily: 'Rubik_400Regular', fontSize: 14, color: Colors.colors.textMuted },
  controls: { paddingHorizontal: 20, paddingTop: 20, gap: 14 },
  instructionText: {
    fontFamily: 'Rubik_400Regular', fontSize: 14, color: Colors.colors.textSecondary, textAlign: 'center',
  },
  timeDisplay: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  timePill: {
    alignItems: 'center', backgroundColor: Colors.colors.surface,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.colors.border,
  },
  timePillLabel: { fontFamily: 'Rubik_500Medium', fontSize: 10, color: Colors.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  timePillValue: { fontFamily: 'Rubik_700Bold', fontSize: 20, color: Colors.colors.text, marginTop: 2 },
  sliderArea: { marginTop: 4 },
  track: {
    height: 48, backgroundColor: Colors.colors.surface, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.colors.border, overflow: 'visible', position: 'relative',
  },
  dimRegion: {
    position: 'absolute', top: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 4,
  },
  selectedRegion: {
    position: 'absolute', top: 0, bottom: 0,
    backgroundColor: 'rgba(232,81,47,0.2)',
    borderTopWidth: 3, borderBottomWidth: 3, borderColor: Colors.colors.primary,
  },
  handle: {
    position: 'absolute', top: -6, bottom: -6, width: HANDLE_WIDTH,
    alignItems: 'center', justifyContent: 'center', zIndex: 10,
  },
  handleLeft: {},
  handleRight: {},
  handleGrip: {
    width: 20, height: 36, borderRadius: 6,
    backgroundColor: Colors.colors.primary,
    alignItems: 'center', justifyContent: 'center', gap: 3,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3 },
      android: { elevation: 4 },
      web: {},
    }),
  },
  gripLine: {
    width: 8, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.7)',
  },
  playhead: {
    position: 'absolute', top: -2, bottom: -2, width: 2, backgroundColor: '#fff', borderRadius: 1, zIndex: 5,
  },
  trackLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingHorizontal: 2 },
  trackLabelText: { fontFamily: 'Rubik_400Regular', fontSize: 11, color: Colors.colors.textMuted },
  previewBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6,
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
