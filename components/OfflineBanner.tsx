import { StyleSheet, Text, View, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStatus } from '@/lib/sync-manager';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';

export default function OfflineBanner() {
  const { isOnline, isSyncing, pendingCount } = useNetworkStatus();
  const insets = useSafeAreaInsets();

  if (isOnline && !isSyncing && pendingCount === 0) return null;

  let message = '';
  let bgColor = '#FF9500';
  let icon: 'cloud-offline' | 'sync' | 'checkmark-circle' = 'cloud-offline';

  if (!isOnline) {
    message = 'You\'re offline. Changes will sync when connected.';
    bgColor = '#FF3B30';
    icon = 'cloud-offline';
  } else if (isSyncing) {
    message = `Syncing ${pendingCount} change${pendingCount !== 1 ? 's' : ''}...`;
    bgColor = '#FF9500';
    icon = 'sync';
  } else if (pendingCount > 0) {
    message = `${pendingCount} change${pendingCount !== 1 ? 's' : ''} pending`;
    bgColor = '#FF9500';
    icon = 'sync';
  }

  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      exiting={FadeOutUp.duration(200)}
      style={[styles.container, { backgroundColor: bgColor, paddingTop: (Platform.OS !== 'web' ? insets.top : 0) + 6 }]}
    >
      <Ionicons name={icon} size={14} color="#fff" />
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingBottom: 6,
    paddingHorizontal: 16,
  },
  text: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
