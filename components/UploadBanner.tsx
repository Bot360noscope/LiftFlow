import { View, Text, StyleSheet, Pressable, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUploads } from '@/lib/upload-context';
import { useTheme } from '@/lib/theme-context';

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
        <ActivityIndicator size="small" color="#fff" />
      )}
      {isPending && (
        <Ionicons name="time-outline" size={18} color="rgba(255,255,255,0.8)" />
      )}
      {isDone && <Ionicons name="checkmark-circle" size={18} color="#fff" />}
      {isError && <Ionicons name="alert-circle" size={18} color="#fff" />}

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
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
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
