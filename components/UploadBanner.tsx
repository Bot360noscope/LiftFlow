import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Svg, Circle } from 'react-native-svg';
import { useUploads } from '@/lib/upload-context';
import { useTheme } from '@/lib/theme-context';

const RING_SIZE = 32;
const STROKE = 3;
const RADIUS = (RING_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function CircularProgress({ progress, color }: { progress: number; color: string }) {
  const pct = Math.max(0, Math.min(1, progress));
  const dash = CIRCUMFERENCE * pct;
  const gap = CIRCUMFERENCE - dash;
  const pctLabel = Math.round(pct * 100);

  return (
    <View style={{ width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={RING_SIZE} height={RING_SIZE} style={{ position: 'absolute' }}>
        {/* Track */}
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RADIUS}
          stroke="rgba(255,255,255,0.25)"
          strokeWidth={STROKE}
          fill="none"
        />
        {/* Progress arc — rotated so it starts from the top */}
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RADIUS}
          stroke="#fff"
          strokeWidth={STROKE}
          fill="none"
          strokeDasharray={`${dash} ${gap}`}
          strokeLinecap="round"
          rotation="-90"
          originX={RING_SIZE / 2}
          originY={RING_SIZE / 2}
        />
      </Svg>
      <Text style={[styles.pct, { color: '#fff' }]}>{pctLabel}</Text>
    </View>
  );
}

export default function UploadBanner() {
  const { uploads, retryUpload, dismissUpload } = useUploads();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  if (uploads.length === 0) return null;

  const active = uploads[0];
  const isPending = active.status === 'pending';
  const isUploading = active.status === 'uploading';
  const isDone = active.status === 'done';
  const isError = active.status === 'error';
  const isActive = isPending || isUploading;

  const bg = isDone ? '#1a7a3c' : isError ? '#c0392b' : colors.primary;

  const label = isDone
    ? `Uploaded — ${active.exerciseName}`
    : isError
    ? `Upload failed — ${active.exerciseName}`
    : isUploading
    ? `Uploading ${active.exerciseName}…`
    : `Queued — ${active.exerciseName}`;

  return (
    <View style={[
      styles.banner,
      { backgroundColor: bg, bottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 12 }
    ]}>
      {isUploading && (
        <CircularProgress progress={active.progress} color={colors.primary} />
      )}
      {isPending && (
        <Ionicons name="time-outline" size={20} color="rgba(255,255,255,0.8)" />
      )}
      {isDone && <Ionicons name="checkmark-circle" size={22} color="#fff" />}
      {isError && <Ionicons name="alert-circle" size={22} color="#fff" />}

      <Text style={styles.text} numberOfLines={1}>{label}</Text>

      {uploads.length > 1 && isActive && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>+{uploads.length - 1}</Text>
        </View>
      )}

      {isError && (
        <Pressable onPress={() => retryUpload(active.id)} hitSlop={8}>
          <Text style={styles.action}>Retry</Text>
        </Pressable>
      )}
      {(isDone || isError) && (
        <Pressable onPress={() => dismissUpload(active.id)} hitSlop={8} style={{ marginLeft: 4 }}>
          <Ionicons name="close" size={16} color="rgba(255,255,255,0.8)" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
  },
  pct: {
    fontSize: 8,
    fontFamily: 'Rubik_700Bold',
    letterSpacing: -0.3,
  },
  text: {
    flex: 1,
    fontFamily: 'Rubik_500Medium',
    fontSize: 13,
    color: '#fff',
  },
  badge: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: {
    fontFamily: 'Rubik_600SemiBold',
    fontSize: 11,
    color: '#fff',
  },
  action: {
    fontFamily: 'Rubik_600SemiBold',
    fontSize: 13,
    color: '#fff',
    textDecorationLine: 'underline',
  },
});
