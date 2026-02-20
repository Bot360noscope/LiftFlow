import { StyleSheet, Text, View, ScrollView, Pressable, Platform, TextInput, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import Colors from "@/constants/colors";
import { getProfile, saveProfile, getPRs, getPrograms, getClients, resetCoachCode, seedDemoData, type UserProfile } from "@/lib/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";

function CoachCodeCard({ coachCode, onReset }: { coachCode: string; onReset: () => void }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <View style={styles.coachCodeCard}>
      <View style={styles.coachCodeHeader}>
        <View>
          <Text style={styles.coachCodeLabel}>Coach Code</Text>
          <Text style={styles.coachCodeSub}>Share with clients to connect</Text>
        </View>
        <Pressable style={styles.resetCodeBtn} onPress={onReset}>
          <Ionicons name="refresh" size={16} color={Colors.colors.primary} />
          <Text style={styles.resetCodeText}>Reset</Text>
        </Pressable>
      </View>
      <Pressable
        style={styles.coachCodeDisplay}
        onPress={() => {
          setRevealed(!revealed);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
      >
        {revealed ? (
          <Text style={styles.coachCodeValue}>{coachCode}</Text>
        ) : (
          <View style={styles.coachCodeHidden}>
            <Ionicons name="eye-outline" size={20} color={Colors.colors.textMuted} />
            <Text style={styles.coachCodeHiddenText}>Tap to reveal</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<UserProfile>({ id: '', name: '', role: 'coach', weightUnit: 'kg', coachCode: '' });
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [stats, setStats] = useState({ prs: 0, programs: 0, clients: 0 });

  const loadData = useCallback(async () => {
    const [p, prs, progs, cl] = await Promise.all([getProfile(), getPRs(), getPrograms(), getClients()]);
    setProfile(p);
    setNameInput(p.name);
    setStats({ prs: prs.length, programs: progs.length, clients: cl.length });
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleSave = async () => {
    const updated = { ...profile, name: nameInput };
    await saveProfile(updated);
    setProfile(updated);
    setEditing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const toggleUnit = async () => {
    const newUnit = profile.weightUnit === 'kg' ? 'lbs' : 'kg';
    const updated = { ...profile, weightUnit: newUnit };
    await saveProfile(updated);
    setProfile(updated);
    Haptics.selectionAsync();
  };

  const handleResetCoachCode = () => {
    Alert.alert(
      "Reset Coach Code",
      "This will generate a new coach code. Existing clients will still be connected, but new clients will need the updated code.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset Code",
          onPress: async () => {
            const newCode = await resetCoachCode();
            setProfile({ ...profile, coachCode: newCode });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const toggleRole = async () => {
    const newRole = profile.role === 'coach' ? 'client' : 'coach';
    const updated = { ...profile, role: newRole };
    await saveProfile(updated);
    setProfile(updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    loadData();
  };

  const handleClearData = () => {
    Alert.alert(
      "Clear All Data",
      "This will delete all your programs, PRs, and settings. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear Everything",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.clear();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            router.replace('/role-select');
          },
        },
      ]
    );
  };

  const isCoach = profile.role === 'coach';
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
      >
        <Animated.View entering={FadeInDown.duration(400)} style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={32} color={Colors.colors.primary} />
            </View>
          </View>
          {editing ? (
            <View style={styles.nameEditRow}>
              <TextInput
                style={styles.nameInput}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="Enter your name"
                placeholderTextColor={Colors.colors.textMuted}
                autoFocus
              />
              <Pressable onPress={handleSave} hitSlop={8}>
                <Ionicons name="checkmark-circle" size={28} color={Colors.colors.success} />
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setEditing(true)} style={styles.nameRow}>
              <Text style={styles.profileName}>{profile.name || 'Tap to set name'}</Text>
              <Ionicons name="pencil" size={16} color={Colors.colors.textMuted} />
            </Pressable>
          )}
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{isCoach ? 'Coach' : 'Athlete'}</Text>
          </View>
        </Animated.View>

        {isCoach && (
          <Animated.View entering={FadeInDown.delay(80).duration(400)}>
            <CoachCodeCard
              coachCode={profile.coachCode}
              onReset={handleResetCoachCode}
            />
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.statsRow}>
          {isCoach ? (
            <>
              <View style={styles.statCard}>
                <Ionicons name="people" size={22} color={Colors.colors.primary} />
                <Text style={styles.statValue}>{stats.clients}</Text>
                <Text style={styles.statLabel}>Clients</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="barbell" size={22} color={Colors.colors.accent} />
                <Text style={styles.statValue}>{stats.programs}</Text>
                <Text style={styles.statLabel}>Programs</Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.statCard}>
                <Ionicons name="trophy" size={22} color={Colors.colors.accent} />
                <Text style={styles.statValue}>{stats.prs}</Text>
                <Text style={styles.statLabel}>PRs Logged</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="barbell" size={22} color={Colors.colors.primary} />
                <Text style={styles.statValue}>{stats.programs}</Text>
                <Text style={styles.statLabel}>Programs</Text>
              </View>
            </>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <Text style={styles.sectionTitle}>Settings</Text>

          <Pressable style={styles.settingItem} onPress={toggleRole}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(232, 81, 47, 0.12)' }]}>
                <Ionicons name={isCoach ? 'school' : 'fitness'} size={18} color={Colors.colors.primary} />
              </View>
              <View>
                <Text style={styles.settingLabel}>Role</Text>
                <Text style={styles.settingValue}>{isCoach ? 'Coach' : 'Athlete'}</Text>
              </View>
            </View>
            <Ionicons name="swap-horizontal" size={20} color={Colors.colors.primary} />
          </Pressable>

          <Pressable style={styles.settingItem} onPress={toggleUnit}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(255, 140, 66, 0.12)' }]}>
                <Ionicons name="scale" size={18} color={Colors.colors.accent} />
              </View>
              <View>
                <Text style={styles.settingLabel}>Weight Unit</Text>
                <Text style={styles.settingValue}>{profile.weightUnit === 'kg' ? 'Kilograms (kg)' : 'Pounds (lbs)'}</Text>
              </View>
            </View>
            <Ionicons name="swap-horizontal" size={20} color={Colors.colors.textMuted} />
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Data</Text>

          <Pressable style={styles.settingItem} onPress={async () => {
            await seedDemoData();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            loadData();
            Alert.alert("Demo Data Loaded", "Coach Mike with 3 clients (Sarah, Alex, and yourself) has been set up. Each client has their own program with exercise data, notes, and videos.");
          }}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(52, 199, 89, 0.12)' }]}>
                <Ionicons name="flask" size={18} color={Colors.colors.success} />
              </View>
              <View>
                <Text style={styles.settingLabel}>Load Demo Data</Text>
                <Text style={styles.settingValue}>Set up coach with clients and programs</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.colors.textMuted} />
          </Pressable>

          <Pressable style={[styles.settingItem, styles.dangerItem]} onPress={handleClearData}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: Colors.colors.dangerLight }]}>
                <Ionicons name="trash" size={18} color={Colors.colors.danger} />
              </View>
              <View>
                <Text style={[styles.settingLabel, { color: Colors.colors.danger }]}>Clear All Data</Text>
                <Text style={styles.settingValue}>Delete all programs, PRs, and settings</Text>
              </View>
            </View>
          </Pressable>
        </Animated.View>

        <Text style={styles.version}>LiftFlow v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.colors.background },
  header: { paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { fontFamily: 'Rubik_700Bold', fontSize: 28, color: Colors.colors.text },
  scrollContent: { paddingHorizontal: 20 },
  profileCard: {
    backgroundColor: Colors.colors.backgroundCard, borderRadius: 20, padding: 24,
    alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: Colors.colors.border,
  },
  avatarContainer: { marginBottom: 14 },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(232, 81, 47, 0.12)',
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.colors.primary,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  profileName: { fontFamily: 'Rubik_600SemiBold', fontSize: 20, color: Colors.colors.text },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%' },
  nameInput: {
    flex: 1, fontFamily: 'Rubik_500Medium', fontSize: 18, color: Colors.colors.text,
    backgroundColor: Colors.colors.surfaceLight, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
  },
  roleBadge: {
    backgroundColor: 'rgba(232, 81, 47, 0.12)', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 12, marginTop: 10,
  },
  roleText: { fontFamily: 'Rubik_500Medium', fontSize: 13, color: Colors.colors.primary },
  coachCodeCard: {
    backgroundColor: Colors.colors.backgroundCard, borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: Colors.colors.border, marginBottom: 16,
  },
  coachCodeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  coachCodeLabel: { fontFamily: 'Rubik_600SemiBold', fontSize: 15, color: Colors.colors.text },
  coachCodeSub: { fontFamily: 'Rubik_400Regular', fontSize: 11, color: Colors.colors.textMuted, marginTop: 2 },
  resetCodeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(232,81,47,0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  resetCodeText: { fontFamily: 'Rubik_500Medium', fontSize: 12, color: Colors.colors.primary },
  coachCodeDisplay: {
    alignItems: 'center', backgroundColor: Colors.colors.surface, borderRadius: 12,
    paddingVertical: 16, marginTop: 14, borderWidth: 1, borderColor: Colors.colors.border,
  },
  coachCodeValue: { fontFamily: 'Rubik_700Bold', fontSize: 28, color: Colors.colors.primary, letterSpacing: 4 },
  coachCodeHidden: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  coachCodeHiddenText: { fontFamily: 'Rubik_500Medium', fontSize: 14, color: Colors.colors.textMuted },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: {
    flex: 1, backgroundColor: Colors.colors.backgroundCard, borderRadius: 14, padding: 18,
    alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.colors.border,
  },
  statValue: { fontFamily: 'Rubik_700Bold', fontSize: 24, color: Colors.colors.text },
  statLabel: { fontFamily: 'Rubik_400Regular', fontSize: 12, color: Colors.colors.textMuted },
  sectionTitle: {
    fontFamily: 'Rubik_600SemiBold', fontSize: 16, color: Colors.colors.textSecondary,
    marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  settingItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.colors.backgroundCard, borderRadius: 14, padding: 16,
    marginBottom: 8, borderWidth: 1, borderColor: Colors.colors.border,
  },
  dangerItem: { borderColor: 'rgba(255, 59, 48, 0.2)' },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  settingLabel: { fontFamily: 'Rubik_500Medium', fontSize: 15, color: Colors.colors.text },
  settingValue: { fontFamily: 'Rubik_400Regular', fontSize: 12, color: Colors.colors.textMuted, marginTop: 1 },
  version: { fontFamily: 'Rubik_400Regular', fontSize: 12, color: Colors.colors.textMuted, textAlign: 'center', marginTop: 30 },
});
