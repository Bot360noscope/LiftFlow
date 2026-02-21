import { StyleSheet, Text, View, Pressable, Platform, TextInput } from "react-native";
import { showAlert } from "@/lib/confirm";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import Colors from "@/constants/colors";
import { joinCoach } from "@/lib/storage";

export default function JoinCoachScreen() {
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) {
      showAlert("Invalid Code", "Please enter a valid coach code.");
      return;
    }
    setJoining(true);
    try {
      const result = await joinCoach(trimmed);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert(
        "Connected!",
        `You've joined coach ${result.coach.name || 'your coach'}. They can now assign training programs to you.`
      );
      router.back();
    } catch (err: any) {
      const msg = err?.message || 'Unknown error';
      if (msg.includes('Invalid') || msg.includes('Not Found') || msg.includes('404')) {
        showAlert("Invalid Code", "No coach found with that code. Please double-check and try again.");
      } else if (msg.includes('already have a coach')) {
        showAlert("Already Connected", "You already have a coach. Remove your current coach from your Profile settings before joining a new one.");
      } else {
        showAlert("Connection Error", `Could not connect to coach. ${msg}`);
      }
    } finally {
      setJoining(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="close" size={28} color={Colors.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Join Coach</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.content}>
        <Animated.View entering={FadeInDown.duration(400)} style={styles.illustrationWrap}>
          <View style={styles.illustration}>
            <Ionicons name="people" size={48} color={Colors.colors.primary} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <Text style={styles.title}>Enter Coach Code</Text>
          <Text style={styles.subtitle}>Ask your coach for their 6-character code to connect and receive training programs</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <TextInput
            style={styles.codeInput}
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            placeholder="XXXXXX"
            placeholderTextColor={Colors.colors.textMuted}
            maxLength={6}
            autoCapitalize="characters"
            autoCorrect={false}
            textAlign="center"
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <Pressable
            style={[styles.joinBtn, (code.trim().length < 4 || joining) && styles.joinBtnDisabled]}
            onPress={handleJoin}
            disabled={code.trim().length < 4 || joining}
          >
            <Ionicons name="link" size={20} color="#fff" />
            <Text style={styles.joinBtnText}>{joining ? 'Connecting...' : 'Join Coach'}</Text>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(400)}>
          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={18} color={Colors.colors.textSecondary} />
            <Text style={styles.infoText}>Once connected, your coach can assign training programs to you. You'll be able to log your workouts, record videos, and add notes for your coach to review.</Text>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  headerTitle: { fontFamily: 'Rubik_700Bold', fontSize: 20, color: Colors.colors.text },
  content: { paddingHorizontal: 24, paddingTop: 20 },
  illustrationWrap: { alignItems: 'center', marginBottom: 24 },
  illustration: {
    width: 88, height: 88, borderRadius: 24, backgroundColor: 'rgba(232, 81, 47, 0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontFamily: 'Rubik_700Bold', fontSize: 24, color: Colors.colors.text, textAlign: 'center' },
  subtitle: {
    fontFamily: 'Rubik_400Regular', fontSize: 14, color: Colors.colors.textSecondary,
    textAlign: 'center', marginTop: 8, lineHeight: 20, paddingHorizontal: 10,
  },
  codeInput: {
    fontFamily: 'Rubik_700Bold', fontSize: 28, color: Colors.colors.text, letterSpacing: 8,
    backgroundColor: Colors.colors.backgroundCard, borderRadius: 16, paddingVertical: 20,
    paddingHorizontal: 24, borderWidth: 2, borderColor: Colors.colors.border, marginTop: 28,
  },
  joinBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.colors.primary, paddingVertical: 16, borderRadius: 14, marginTop: 20,
  },
  joinBtnDisabled: { opacity: 0.5 },
  joinBtnText: { fontFamily: 'Rubik_700Bold', fontSize: 16, color: '#fff' },
  infoBox: {
    flexDirection: 'row', gap: 8, backgroundColor: Colors.colors.surfaceLight,
    borderRadius: 12, padding: 14, marginTop: 24, alignItems: 'flex-start',
  },
  infoText: {
    flex: 1, fontFamily: 'Rubik_400Regular', fontSize: 12, color: Colors.colors.textSecondary, lineHeight: 18,
  },
});
