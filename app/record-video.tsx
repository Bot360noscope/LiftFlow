import { StyleSheet, Text, View, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState, useRef, useEffect, useCallback } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from "expo-av";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useTheme } from "@/lib/theme-context";
import { showAlert } from "@/lib/confirm";

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

  const [permission, requestPermission] = useCameraPermissions();
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const cameraRef = useRef<CameraView>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);

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

  const flipCamera = () => {
    setFacing(prev => prev === 'back' ? 'front' : 'back');
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
        style={styles.camera}
        facing={facing}
        mode="video"
      />

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => { if (recording) stopRecording(); router.back(); }} hitSlop={12}>
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
  camera: { flex: 1 },
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
});
