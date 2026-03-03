import { StyleSheet, Text, View, Pressable, Platform, ActivityIndicator, PanResponder, LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import * as Haptics from "expo-haptics";
import * as MediaLibrary from "expo-media-library";
import Colors from "@/constants/colors";
import { useTheme } from "@/lib/theme-context";
import { uploadVideo } from "@/lib/api";
import { showAlert } from "@/lib/confirm";
import { trimResult } from "@/lib/trim-result";

const MAX_DURATION = 60;
const TRACK_H = 48;
const HANDLE_W = 22;

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
  const [trackWidth, setTrackWidth] = useState(0);
  const trackWidthRef = useRef(0);
  const dragOriginRef = useRef({ start: 0, end: 0 });
  const lastPlayheadUpdateRef = useRef(0);
  const isDraggingRef = useRef(false);

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

  const [isPlaying, setIsPlaying] = useState(true);

  const player = useVideoPlayer(videoUri || null, (p) => {
    p.loop = true;
    p.play();
  });

  const playerRef = useRef(player);
  playerRef.current = player;

  useEffect(() => {
    if (!player) return;
    const sub = player.addListener('timeUpdate', ({ currentTime: ct }) => {
      if (!isDraggingRef.current && Date.now() - lastPlayheadUpdateRef.current > 200) {
        setCurrentTime(ct);
        lastPlayheadUpdateRef.current = Date.now();
      }
      if (ct >= endRef.current) {
        player.currentTime = startRef.current;
      }
    });
    return () => sub.remove();
  }, [player]);

  const handleTrackLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) {
      trackWidthRef.current = w;
      setTrackWidth(w);
    }
  }, []);

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const timeToX = (t: number) => {
    if (totalDuration <= 0 || trackWidth <= 0) return 0;
    return (t / totalDuration) * trackWidth;
  };

  const xToTime = useCallback((dx: number) => {
    if (trackWidthRef.current <= 0) return 0;
    return (dx / trackWidthRef.current) * totalDuration;
  }, [totalDuration]);

  const togglePlayPause = useCallback(() => {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pause();
    } else {
      playerRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const nudgeStart = useCallback((delta: number) => {
    const ns = clamp(startRef.current + delta, 0, endRef.current - 1);
    const finalNs = (endRef.current - ns > MAX_DURATION) ? endRef.current - MAX_DURATION : ns;
    setStartTime(finalNs);
    if (playerRef.current) {
      playerRef.current.pause();
      playerRef.current.currentTime = finalNs;
    }
    setIsPlaying(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const nudgeEnd = useCallback((delta: number) => {
    let ne = clamp(endRef.current + delta, startRef.current + 1, totalDuration);
    if (ne - startRef.current > MAX_DURATION) ne = startRef.current + MAX_DURATION;
    setEndTime(ne);
    if (playerRef.current) {
      playerRef.current.pause();
      playerRef.current.currentTime = ne;
    }
    setIsPlaying(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [totalDuration]);

  const startPan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      isDraggingRef.current = true;
      dragOriginRef.current = { start: startRef.current, end: endRef.current };
      playerRef.current?.pause();
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
      isDraggingRef.current = false;
      setIsPlaying(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
  }), [totalDuration]);

  const endPan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      isDraggingRef.current = true;
      dragOriginRef.current = { start: startRef.current, end: endRef.current };
      playerRef.current?.pause();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    onPanResponderMove: (_, gs) => {
      const dt = xToTime(gs.dx);
      let ne = Math.round(clamp(dragOriginRef.current.end + dt, dragOriginRef.current.start + 1, totalDuration));
      if (ne - dragOriginRef.current.start > MAX_DURATION) ne = dragOriginRef.current.start + MAX_DURATION;
      setEndTime(ne);
      if (playerRef.current) playerRef.current.currentTime = ne;
    },
    onPanResponderRelease: () => {
      isDraggingRef.current = false;
      setIsPlaying(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
  }), [totalDuration]);

  const regionPan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 4,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      isDraggingRef.current = true;
      dragOriginRef.current = { start: startRef.current, end: endRef.current };
      playerRef.current?.pause();
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
      isDraggingRef.current = false;
      setIsPlaying(false);
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

  const { colors } = useTheme();

  const startX = timeToX(startTime);
  const endX = timeToX(endTime);
  const playheadX = timeToX(currentTime);

  return (
    <View style={[styles.container, { backgroundColor: '#000' }]}>
      {videoUri ? (
        <VideoView
          player={player}
          style={styles.videoFull}
          nativeControls={false}
          contentFit="contain"
        />
      ) : (
        <View style={styles.videoPlaceholder}>
          <Ionicons name="videocam-off" size={48} color="rgba(255,255,255,0.4)" />
        </View>
      )}

      <Pressable style={styles.playPauseOverlay} onPress={togglePlayPause}>
        {!isPlaying && (
          <View style={styles.playPauseCircle}>
            <Ionicons name="play" size={36} color="#fff" style={{ marginLeft: 4 }} />
          </View>
        )}
      </Pressable>

      <View style={[styles.topBar, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 8) }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>
        <Text style={styles.topTitle} numberOfLines={1}>{exerciseName}</Text>
        <View style={styles.durationBadge}>
          <Text style={[styles.durationText, clipDuration > MAX_DURATION && { color: '#FF6B6B' }]}>
            {formatTime(clipDuration)}
          </Text>
        </View>
      </View>

      <View style={[styles.bottomOverlay, { paddingBottom: Math.max(insets.bottom, 16) + (Platform.OS === 'web' ? 34 : 8) }]}>
        <View style={styles.timeStepperRow}>
          <View style={styles.stepper}>
            <Pressable style={styles.stepBtn} onPress={() => nudgeStart(-1)} disabled={startTime <= 0}>
              <Ionicons name="chevron-back" size={18} color={startTime <= 0 ? 'rgba(255,255,255,0.2)' : '#fff'} />
            </Pressable>
            <View style={styles.stepTimeBox}>
              <Text style={styles.stepLabel}>START</Text>
              <Text style={styles.stepTime}>{formatTime(startTime)}</Text>
            </View>
            <Pressable style={styles.stepBtn} onPress={() => nudgeStart(1)} disabled={startTime >= endTime - 1}>
              <Ionicons name="chevron-forward" size={18} color={startTime >= endTime - 1 ? 'rgba(255,255,255,0.2)' : '#fff'} />
            </Pressable>
          </View>

          <View style={styles.stepper}>
            <Pressable style={styles.stepBtn} onPress={() => nudgeEnd(-1)} disabled={endTime <= startTime + 1}>
              <Ionicons name="chevron-back" size={18} color={endTime <= startTime + 1 ? 'rgba(255,255,255,0.2)' : '#fff'} />
            </Pressable>
            <View style={styles.stepTimeBox}>
              <Text style={styles.stepLabel}>END</Text>
              <Text style={styles.stepTime}>{formatTime(endTime)}</Text>
            </View>
            <Pressable style={styles.stepBtn} onPress={() => nudgeEnd(1)} disabled={endTime >= totalDuration}>
              <Ionicons name="chevron-forward" size={18} color={endTime >= totalDuration ? 'rgba(255,255,255,0.2)' : '#fff'} />
            </Pressable>
          </View>
        </View>

        <View style={styles.sliderArea}>
          <View style={styles.trimRow} onLayout={handleTrackLayout}>
            {trackWidth > 0 && (
              <>
                <View
                  {...startPan.panHandlers}
                  hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                  style={[styles.handle, { left: startX }]}
                >
                  <View style={styles.handleInner}>
                    <View style={styles.gripLine} />
                    <View style={styles.gripLine} />
                  </View>
                </View>

                <View style={styles.trackMiddle}>
                  {startX > 0 && <View style={[styles.dimOverlay, { left: 0, width: startX }]} />}
                  {endX < trackWidth && <View style={[styles.dimOverlay, { right: 0, width: trackWidth - endX }]} />}
                  <View
                    style={[styles.selectedZone, { left: startX, width: Math.max(endX - startX, 2) }]}
                    {...regionPan.panHandlers}
                  />
                  <View style={[styles.playhead, { left: Math.min(playheadX, trackWidth - 2) }]} />
                </View>

                <View
                  {...endPan.panHandlers}
                  hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                  style={[styles.handle, { left: endX }]}
                >
                  <View style={styles.handleInner}>
                    <View style={styles.gripLine} />
                    <View style={styles.gripLine} />
                  </View>
                </View>
              </>
            )}
          </View>
          <View style={styles.trackLabels}>
            <Text style={styles.trackLabelText}>0:00</Text>
            <Text style={styles.trackLabelText}>{formatTime(totalDuration)}</Text>
          </View>
        </View>

        <View style={styles.footerBtns}>
          {Platform.OS !== 'web' && (
            <Pressable
              style={styles.savePhotosBtn}
              onPress={handleSaveToPhotos}
              disabled={saving || uploading}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="download-outline" size={20} color="#fff" />
              )}
            </Pressable>
          )}
          <Pressable
            style={[styles.submitBtn, (!isValidClip || uploading) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!isValidClip || uploading}
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
                  Upload {formatTime(clipDuration)}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  videoFull: { flex: 1, width: '100%' },
  videoPlaceholder: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },
  playPauseOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', zIndex: 5,
  },
  playPauseCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  topTitle: {
    fontFamily: 'Rubik_600SemiBold', fontSize: 16, color: '#fff',
    flex: 1, textAlign: 'center', marginHorizontal: 12,
  },
  durationBadge: {
    backgroundColor: 'rgba(232,81,47,0.3)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14,
  },
  durationText: { fontFamily: 'Rubik_600SemiBold', fontSize: 14, color: '#E8512F' },
  bottomOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingTop: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  timeStepperRow: {
    flexDirection: 'row', justifyContent: 'space-around', marginBottom: 14,
  },
  stepper: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
  },
  stepBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  stepTimeBox: {
    alignItems: 'center', minWidth: 60, paddingHorizontal: 8,
  },
  stepLabel: {
    fontFamily: 'Rubik_500Medium', fontSize: 9, color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1, marginBottom: 2,
  },
  stepTime: {
    fontFamily: 'Rubik_700Bold', fontSize: 18, color: '#fff',
  },
  sliderArea: { marginBottom: 14 },
  trimRow: {
    flexDirection: 'row', alignItems: 'center',
    height: TRACK_H, position: 'relative',
  },
  handle: {
    width: HANDLE_W, height: TRACK_H, borderRadius: 6,
    backgroundColor: '#E8512F',
    alignItems: 'center', justifyContent: 'center',
    position: 'absolute', top: 0, zIndex: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4 },
      android: { elevation: 6 },
      web: {},
    }),
  },
  handleInner: { alignItems: 'center', justifyContent: 'center', gap: 3 },
  gripLine: { width: 8, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.8)' },
  trackMiddle: {
    flex: 1, height: TRACK_H,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden', position: 'relative',
  },
  dimOverlay: {
    position: 'absolute', top: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  selectedZone: {
    position: 'absolute', top: 0, bottom: 0,
    backgroundColor: 'rgba(232,81,47,0.2)',
    borderTopWidth: 3, borderBottomWidth: 3, borderColor: '#E8512F',
  },
  playhead: {
    position: 'absolute', top: 0, bottom: 0, width: 2,
    backgroundColor: '#fff', borderRadius: 1, zIndex: 5,
  },
  trackLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingHorizontal: 2 },
  trackLabelText: { fontFamily: 'Rubik_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  footerBtns: {
    flexDirection: 'row', gap: 10,
  },
  savePhotosBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  submitBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#E8512F', paddingVertical: 14, borderRadius: 12,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontFamily: 'Rubik_600SemiBold', fontSize: 16, color: '#fff' },
});
