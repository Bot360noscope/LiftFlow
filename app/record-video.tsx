import { StyleSheet, Text, View, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState, useRef, useEffect, useCallback } from "react";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from "expo-av";
import { PanResponder } from "react-native";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useTheme } from "@/lib/theme-context";
import { showAlert, confirmAction } from "@/lib/confirm";
import { useNetworkStatus } from "@/lib/sync-manager";

export default function RecordVideoScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{
    programId: string;
    exerciseId: string;
    uploadedBy: string;
    coachId: string;
    exerciseName: string;
  }>();

  const navigation = useNavigation();
  const [permission, requestPermission] = useCameraPermissions();
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [zoom, setZoom] = useState(0);
  const { isOnline } = useNetworkStatus();
  const cameraRef = useRef<CameraView>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);
  const discardRef = useRef(false);
  const zoomRef = useRef(0);
  const baseZoomRef = useRef(0);
  const lastPinchRef = useRef(1);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, []);

  useEffect(() => {
    configureAudioSession();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !recording });
  }, [recording, navigation]);

  const updateZoom = useCallback((v: number) => {
    zoomRef.current = v;
    setZoom(v);
  }, []);

  const zoomPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => gs.numberActiveTouches === 2,
      onPanResponderGrant: () => {
        baseZoomRef.current = zoomRef.current;
        lastPinchRef.current = 1;
      },
      onPanResponderMove: (evt) => {
        if (evt.nativeEvent.touches.length < 2) return;
        const [t1, t2] = evt.nativeEvent.touches;
        const dist = Math.sqrt(
          Math.pow(t1.pageX - t2.pageX, 2) + Math.pow(t1.pageY - t2.pageY, 2)
        );
        if (lastPinchRef.current === 1) {
          lastPinchRef.current = dist;
          return;
        }
        const scale = dist / lastPinchRef.current;
        const newZoom = Math.max(0, Math.min(1, baseZoomRef.current + (scale - 1) * 0.5));
        zoomRef.current = newZoom;
        setZoom(newZoom);
      },
      onPanResponderRelease: () => {
        baseZoomRef.current = zoomRef.current;
        lastPinchRef.current = 1;
      },
    })
  ).current;

  const configureAudioSession = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
        shouldDuckAndroid: true,
      });
    } catch (e) {}
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    if (!cameraRef.current) return;
    discardRef.current = false;

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
        shouldDuckAndroid: true,
      });
    } catch (e) {}

    setRecording(true);
    setElapsed(0);
    elapsedRef.current = 0;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
    }, 1000);

    try {
      const recordOptions: any = {
        maxDuration: 120,
      };
      if (Platform.OS === 'ios') {
        recordOptions.mute = true;
      }

      const video = await cameraRef.current.recordAsync(recordOptions);

      if (timerRef.current) clearInterval(timerRef.current);
      setRecording(false);

      if (discardRef.current) return;

      if (video?.uri) {
        router.replace({
          pathname: '/trim-video',
          params: {
            videoUri: video.uri,
            videoDuration: String(elapsedRef.current * 1000),
            programId: params.programId,
            exerciseId: params.exerciseId,
            uploadedBy: params.uploadedBy,
            coachId: params.coachId,
            exerciseName: params.exerciseName,
          },
        });
      }
    } catch (err: any) {
      if (timerRef.current) clearInterval(timerRef.current);
      setRecording(false);
      console.error("[RecordVideo] Recording error:", err?.message || err);
      showAlert("Error", "Failed to record video. Please check camera permissions and try again.");
    }
  };

  const stopRecording = () => {
    if (cameraRef.current && recording) {
      cameraRef.current.stopRecording();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleClose = () => {
    if (recording) {
      confirmAction(
        'Stop Recording?',
        'Your current recording will be discarded.',
        () => { discardRef.current = true; stopRecording(); router.back(); },
        'Discard'
      );
    } else {
      router.back();
    }
  };

  const flipCamera = () => {
    setFacing(prev => prev === 'back' ? 'front' : 'back');
    zoomRef.current = 0;
    baseZoomRef.current = 0;
    setZoom(0);
    Haptics.selectionAsync();
  };

  if (!permission?.granted) {
    return (
      <View style={[styles.container, { backgroundColor: '#000', paddingTop: insets.top }]}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={48} color="#fff" />
          <Text style={styles.permissionText}>Camera access is required to record form check videos.</Text>
          <Pressable style={styles.permissionBtn} onPress={requestPermission}>
            <Text style={styles.permissionBtnText}>Grant Access</Text>
          </Pressable>
          <Pressable style={styles.cancelBtn} onPress={() => router.back()}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: '#000' }]}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        mode="video"
        zoom={zoom}
      />
      <View style={styles.zoomOverlay} {...zoomPanResponder.panHandlers} />

      {!isOnline && (
        <View style={[styles.offlineBar, { top: insets.top + 48 }]}>
          <Ionicons name="cloud-offline" size={14} color="#fff" />
          <Text style={styles.offlineBarText}>You're offline — video can't be uploaded right now</Text>
        </View>
      )}

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={handleClose} hitSlop={12}>
          <Ionicons name="close" size={30} color="#fff" />
        </Pressable>
        <Text style={styles.exerciseName} numberOfLines={1}>{params.exerciseName || 'Form Check'}</Text>
        <Pressable onPress={flipCamera} hitSlop={12} disabled={recording}>
          <Ionicons name="camera-reverse-outline" size={28} color={recording ? 'rgba(255,255,255,0.3)' : '#fff'} />
        </Pressable>
      </View>

      {recording && (
        <View style={styles.timerBadge}>
          <View style={styles.timerDot} />
          <Text style={styles.timerText}>{formatTime(elapsed)}</Text>
        </View>
      )}

      {zoom > 0.01 && (
        <View style={styles.zoomBadge}>
          <Text style={styles.zoomText}>{(1 + zoom * 9).toFixed(1)}x</Text>
        </View>
      )}

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.recordRow}>
          <Pressable
            style={[styles.recordBtn, recording && styles.recordBtnActive]}
            onPress={recording ? stopRecording : startRecording}
          >
            {recording ? (
              <View style={styles.stopIcon} />
            ) : (
              <View style={styles.recordIcon} />
            )}
          </Pressable>
        </View>
        <Text style={styles.hint}>
          {recording ? 'Tap to stop' : 'Tap to record'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { ...StyleSheet.absoluteFillObject },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  exerciseName: {
    fontFamily: 'Rubik_600SemiBold', fontSize: 16, color: '#fff',
    flex: 1, textAlign: 'center', marginHorizontal: 12,
  },
  timerBadge: {
    position: 'absolute', top: '50%', alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, marginTop: -60,
  },
  timerDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#E8512F',
  },
  timerText: {
    fontFamily: 'Rubik_600SemiBold', fontSize: 16, color: '#fff',
  },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    alignItems: 'center', paddingTop: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  recordRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  recordBtn: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 4, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  recordBtnActive: {
    borderColor: '#E8512F',
  },
  recordIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#E8512F',
  },
  stopIcon: {
    width: 28, height: 28, borderRadius: 4,
    backgroundColor: '#E8512F',
  },
  hint: {
    fontFamily: 'Rubik_400Regular', fontSize: 13, color: 'rgba(255,255,255,0.7)',
    marginTop: 10,
  },
  permissionContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 32,
  },
  permissionText: {
    fontFamily: 'Rubik_400Regular', fontSize: 15, color: '#fff', textAlign: 'center',
  },
  permissionBtn: {
    backgroundColor: '#E8512F', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, marginTop: 8,
  },
  permissionBtnText: {
    fontFamily: 'Rubik_600SemiBold', fontSize: 15, color: '#fff',
  },
  cancelBtn: {
    paddingHorizontal: 24, paddingVertical: 12,
  },
  cancelBtnText: {
    fontFamily: 'Rubik_400Regular', fontSize: 15, color: 'rgba(255,255,255,0.6)',
  },
  offlineBar: {
    position: 'absolute', left: 16, right: 16, zIndex: 20,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255, 59, 48, 0.85)', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 10,
  },
  offlineBarText: {
    fontFamily: 'Rubik_500Medium', fontSize: 12, color: '#fff', flex: 1,
  },
  zoomBadge: {
    position: 'absolute', alignSelf: 'center', bottom: '30%',
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 16,
  },
  zoomText: {
    fontFamily: 'Rubik_600SemiBold', fontSize: 14, color: '#fff',
  },
  zoomOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 180,
    zIndex: 1,
  },
});
