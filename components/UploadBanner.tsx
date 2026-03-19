import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
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
  const isUploading = active.status === 'uploading' || active.status === 'pending';
  const isDone = active.status === 'done';
  const isError = active.status === 'error';

  const bg = isDone ? '#1a7a3c' : isError ? '#c0392b' : colors.primary;

  return (
    <View style={[
      styles.banner,
      { backgroundColor: bg, bottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 12 }
    ]}>
      {isUploading && (
        <View style={styles.spinner}>
          <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
        </View>
      )}
      {isDone && <Ionicons name="checkmark-circle" size={18} color="#fff" />}
      {isError && <Ionicons name="alert-circle" size={18} color="#fff" />}

      <Text style={styles.text} numberOfLines={1}>
        {isDone
          ? `Video uploaded — ${active.exerciseName}`
          : isError
          ? `Upload failed — ${active.exerciseName}`
          : `Uploading ${active.exerciseName}…`}
      </Text>

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
  spinner: { opacity: 0.9 },
  text: {
    flex: 1,
    fontFamily: 'Rubik_500Medium',
    fontSize: 13,
    color: '#fff',
  },
  action: {
    fontFamily: 'Rubik_600SemiBold',
    fontSize: 13,
    color: '#fff',
    textDecorationLine: 'underline',
  },
});
