import { StyleSheet, Text, View, Pressable, Platform, ActivityIndicator, PanResponder } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import * as Haptics from "expo-haptics";
import * as MediaLibrary from "expo-media-library";
import Colors from "@/constants/colors";
import { uploadVideo } from "@/lib/api";
import { showAlert } from "@/lib/confirm";
import { trimResult } from "@/lib/trim-result";

const MAX_DURATION = 60;
const HANDLE_HIT = 36;

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

  const startRef = useRef(0);
  const endRef = useRef(Math.min(totalDuration, MAX_DURATION));
  const [startTime, _setStartTime] = useState(0);
  const [endTime, _setEndTime] = useState(Math.min(totalDuration, MAX_DURATION));
  const [uploading, setUploading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const trackWidthRef = useRef(0);
  const trackRef = useRef<View>(null);
  const dragOriginRef = useRef({ start: 0, end: 0 });

  const setStartTime = useCallback((v: number) => {
    startRef.current = v;
    _setStartTime(v);
  }, []);

  const setEndTime = useCallback((v: number) => {
    endRef.current = v;
    _setEndTime(v);
  }, []);

  const clipDuration = endTime - startTime;
  const isValidClip = clipDuration > 0 && clipDuration <= MAX_DURATION;
  const [saving, setSaving] = useState(false);
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();

  const player = useVideoPlayer(videoUri || null, (p) => {
    p.loop = true;
    p.play();
  });

  const playerRef = useRef(player);
  playerRef.current = player;

  useEffect(() => {
    if (!player) return;
    const sub = player.addListener('timeUpdate', ({ currentTime: ct }) => {
      setCurrentTime(ct);
      if (ct >= endRef.current) {
        player.currentTime = startRef.current;
      }
    });
    return () => sub.remove();
  }, [player]);

  const handleTrackLayout = useCallback(() => {
    setTimeout(() => {
      trackRef.current?.measureInWindow((x, _y, width) => {
        if (width > 0) trackWidthRef.current = width;
      });
    }, 150);
  }, []);

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const xToTime = useCallback((dx: number) => {
    if (trackWidthRef.current <= 0) return 0;
    return (dx / trackWidthRef.current) * totalDuration;
  }, [totalDuration]);

  const timeToPercent = (t: number) => {
    if (totalDuration <= 0) return 0;
    return (t / totalDuration) * 100;
  };

  const startPan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      dragOriginRef.current = { start: startRef.current, end: endRef.current };
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    onPanResponderMove: (_, gs) => {
      const dt = xToTime(gs.dx);
      let ns = Math.round(clamp(dragOriginRef.current.start + dt, 0, dragOriginRef.current.end - 1));
      if (dragOriginRef.current.end - ns > MAX_DURATION) ns = dragOriginRef.current.end - MAX_DURATION;
      setStartTime(ns);
      if (playerRef.current) playerRef.current.currentTime = ns;
    },
    onPanResponderRelease: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
  }), [totalDuration]);

  const endPan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      dragOriginRef.current = { start: startRef.current, end: endRef.current };
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    onPanResponderMove: (_, gs) => {
      const dt = xToTime(gs.dx);
      let ne = Math.round(clamp(dragOriginRef.current.end + dt, dragOriginRef.current.start + 1, totalDuration));
      if (ne - dragOriginRef.current.start > MAX_DURATION) ne = dragOriginRef.current.start + MAX_DURATION;
      setEndTime(ne);
    },
    onPanResponderRelease: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
  }), [totalDuration]);

  const regionPan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 4,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      dragOriginRef.current = { start: startRef.current, end: endRef.current };
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    onPanResponderMove: (_, gs) => {
      const dt = xToTime(gs.dx);
      const dur = dragOriginRef.current.end - dragOriginRef.current.start;
      let ns = dragOriginRef.current.start + dt;
      let ne = ns + dur;
      if (ns < 0) { ns = 0; ne = dur; }
      if (ne > totalDuration) { ne = totalDuration; ns = totalDuration - dur; }
      setStartTime(Math.round(clamp(ns, 0, totalDuration)));
      setEndTime(Math.round(clamp(ne, 0, totalDuration)));
      if (playerRef.current) playerRef.current.currentTime = Math.round(clamp(ns, 0, totalDuration));
    },
    onPanResponderRelease: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
  }), [totalDuration]);

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

  const handleSaveToPhotos = async () => {
    if (Platform.OS === 'web') {
      showAlert("Not Available", "Saving to photos is only available on mobile devices.");
      return;
    }
    setSaving(true);
    try {
      let perm = mediaPermission;
      if (!perm?.granted) {
        perm = await requestMediaPermission();
        if (!perm.granted) {
          showAlert("Permission Required", "Please allow access to your photo library to save videos.");
          setSaving(false);
          return;
        }
      }
      await MediaLibrary.saveToLibraryAsync(videoUri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert("Saved", "Original video saved to your Photos.");
    } catch (err) {
      showAlert("Error", "Failed to save video to Photos.");
    }
    setSaving(false);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const startPct = timeToPercent(startTime);
  const endPct = timeToPercent(endTime);
  const widthPct = endPct - startPct;

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
            <View style={[styles.dimRegion, { left: 0, width: `${startPct}%` }]} />
            <View style={[styles.dimRegion, { right: 0, width: `${100 - endPct}%` }]} />

            <View
              style={[styles.selectedRegion, { left: `${startPct}%`, width: `${Math.max(widthPct, 0.5)}%` }]}
              {...regionPan.panHandlers}
            />

            <View
              style={[styles.handle, { left: `${startPct}%`, marginLeft: -HANDLE_HIT / 2 }]}
              {...startPan.panHandlers}
            >
              <View style={styles.handleGrip}>
                <View style={styles.gripLine} />
                <View style={styles.gripLine} />
              </View>
            </View>

            <View
              style={[styles.handle, { left: `${endPct}%`, marginLeft: -HANDLE_HIT / 2 }]}
              {...endPan.panHandlers}
            >
              <View style={styles.handleGrip}>
                <View style={styles.gripLine} />
                <View style={styles.gripLine} />
              </View>
            </View>

            {totalDuration > 0 && (
              <View
                style={[styles.playhead, { left: `${timeToPercent(currentTime)}%`, marginLeft: -1 }]}
              />
            )}
          </View>
          <View style={styles.trackLabels}>
            <Text style={styles.trackLabelText}>0:00</Text>
            <Text style={styles.trackLabelText}>{formatTime(totalDuration)}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        {Platform.OS !== 'web' && (
          <Pressable
            style={styles.savePhotosBtn}
            onPress={handleSaveToPhotos}
            disabled={saving || uploading}
            accessibilityLabel="Save original video to photos" accessibilityRole="button"
          >
            {saving ? (
              <ActivityIndicator size="small" color={Colors.colors.primary} />
            ) : (
              <>
                <Ionicons name="download-outline" size={18} color={Colors.colors.primary} />
                <Text style={styles.savePhotosBtnText}>Save Original to Photos</Text>
              </>
            )}
          </Pressable>
        )}
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
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  selectedRegion: {
    position: 'absolute', top: 0, bottom: 0,
    backgroundColor: 'rgba(232,81,47,0.15)',
    borderTopWidth: 3, borderBottomWidth: 3, borderColor: Colors.colors.primary,
  },
  handle: {
    position: 'absolute', top: -8, bottom: -8, width: HANDLE_HIT,
    alignItems: 'center', justifyContent: 'center', zIndex: 10,
  },
  handleGrip: {
    width: 18, height: 40, borderRadius: 6,
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
  footer: { paddingHorizontal: 20, paddingTop: 16, gap: 10 },
  savePhotosBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.colors.border,
    backgroundColor: Colors.colors.backgroundCard,
  },
  savePhotosBtnText: { fontFamily: 'Rubik_500Medium', fontSize: 14, color: Colors.colors.primary },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.colors.primary, paddingVertical: 16, borderRadius: 12,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontFamily: 'Rubik_600SemiBold', fontSize: 16, color: '#fff' },
});
