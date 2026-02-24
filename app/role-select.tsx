import { StyleSheet, Text, View, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect } from "react";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import Colors from "@/constants/colors";
import { getProfile, saveProfile, generateCode } from "@/lib/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";

export default function RoleSelectScreen() {
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('liftflow_profile').then(data => {
      if (data) {
        const profile = JSON.parse(data);
        if (profile.name) {
          router.replace('/(tabs)');
          return;
        }
      }
      setReady(true);
    });
  }, []);

  const handleSelect = async (role: 'coach' | 'client') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const profile = await getProfile();
    const updated = { ...profile, role, coachCode: role === 'coach' ? (profile.coachCode || generateCode()) : profile.coachCode };
    await saveProfile(updated);
    router.replace('/(tabs)');
  };

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  if (!ready) return null;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <Animated.View entering={FadeInDown.duration(500)} style={styles.logoSection}>
        <View style={styles.logoIcon}>
          <Ionicons name="barbell" size={36} color={Colors.colors.primary} />
        </View>
        <Text style={styles.logoTitle}>LiftFlow</Text>
        <Text style={styles.logoSubtitle}>Choose your role to get started</Text>
      </Animated.View>

      <View style={styles.cardsContainer}>
        <Animated.View entering={FadeInDown.delay(200).duration(500)}>
          <Pressable
            style={({ pressed }) => [styles.roleCard, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
            onPress={() => handleSelect('coach')}
          >
            <View style={styles.roleIconWrap}>
              <Ionicons name="school" size={36} color={Colors.colors.primary} />
            </View>
            <Text style={styles.roleTitle}>I'm a Coach</Text>
            <Text style={styles.roleDesc}>Build programs, track clients, leave feedback</Text>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(350).duration(500)}>
          <Pressable
            style={({ pressed }) => [styles.roleCard, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
            onPress={() => handleSelect('client')}
          >
            <View style={styles.roleIconWrap}>
              <Ionicons name="fitness" size={36} color={Colors.colors.primary} />
            </View>
            <Text style={styles.roleTitle}>I'm a Client</Text>
            <Text style={styles.roleDesc}>Follow programs, log workouts, track PRs</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.colors.background,
    paddingHorizontal: 24,
  },
  logoSection: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 50,
  },
  logoIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(232,81,47,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoTitle: {
    fontFamily: 'Rubik_700Bold',
    fontSize: 34,
    color: Colors.colors.text,
    marginBottom: 8,
  },
  logoSubtitle: {
    fontFamily: 'Rubik_400Regular',
    fontSize: 15,
    color: Colors.colors.textSecondary,
  },
  cardsContainer: {
    gap: 16,
  },
  roleCard: {
    backgroundColor: Colors.colors.backgroundCard,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.colors.border,
    gap: 10,
  },
  roleIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: 'rgba(232,81,47,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  roleTitle: {
    fontFamily: 'Rubik_700Bold',
    fontSize: 22,
    color: Colors.colors.text,
  },
  roleDesc: {
    fontFamily: 'Rubik_400Regular',
    fontSize: 14,
    color: Colors.colors.textSecondary,
    textAlign: 'center',
  },
});
