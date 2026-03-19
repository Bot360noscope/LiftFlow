import { StyleSheet, Text, View, ScrollView, Pressable, Platform, TextInput, ActivityIndicator, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as WebBrowser from "expo-web-browser";
import Animated, { FadeInDown } from "react-native-reanimated";
import Colors from "@/constants/colors";
import { useTheme } from "@/lib/theme-context";
import NetworkError from "@/components/NetworkError";
import { ProfileSkeleton } from "@/components/SkeletonLoader";
import { confirmAction, showAlert } from "@/lib/confirm";
import { getProfile, saveProfile, getPRs, getPrograms, getClients, resetCoachCode, deleteAccount, getCachedProfile, getCachedPRs, getCachedPrograms, getCachedClients, leaveCoach, getMyCoach, type UserProfile } from "@/lib/storage";
import { useAuth } from "@/lib/auth-context";
import { uploadAvatar, deleteAvatar, getAvatarUrl } from "@/lib/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Modal } from "react-native";

function CoachCodeCard({ coachCode, onReset }: { coachCode: string; onReset: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const { colors } = useTheme();
  return (
    <View style={[styles.coachCodeCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
      <View style={styles.coachCodeHeader}>
        <View>
          <Text style={[styles.coachCodeLabel, { color: colors.text }]}>Coach Code</Text>
          <Text style={[styles.coachCodeSub, { color: colors.textMuted }]}>Share with clients to connect</Text>
        </View>
        <Pressable style={styles.resetCodeBtn} onPress={onReset}>
          <Ionicons name="refresh" size={16} color={colors.primary} />
          <Text style={[styles.resetCodeText, { color: colors.primary }]}>Reset</Text>
        </Pressable>
      </View>
      <Pressable
        style={[styles.coachCodeDisplay, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => {
          setRevealed(!revealed);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
      >
        {revealed ? (
          <Text style={[styles.coachCodeValue, { color: colors.primary }]}>{coachCode}</Text>
        ) : (
          <View style={styles.coachCodeHidden}>
            <Ionicons name="eye-outline" size={20} color={colors.textMuted} />
            <Text style={[styles.coachCodeHiddenText, { color: colors.textMuted }]}>Tap to reveal</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { logout: authLogout } = useAuth();
  const { colors, theme, toggleTheme } = useTheme();
  const cached = getCachedProfile();
  const [profile, setProfile] = useState<UserProfile>(cached || { id: '', name: '', role: 'coach', weightUnit: 'kg', coachCode: '', avatarUrl: '', plan: 'free', planUserLimit: 1 });
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(cached?.name || '');
  const [bwInput, setBwInput] = useState(cached?.bodyWeight ? String(cached.bodyWeight) : '');
  const [stats, setStats] = useState({ prs: getCachedPRs().length, programs: getCachedPrograms().length, clients: getCachedClients().length });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [myCoach, setMyCoach] = useState<{ coachId: string; coachName: string } | null>(null);
  const [showRemoveCoachModal, setShowRemoveCoachModal] = useState(false);
  const [removeCoachInput, setRemoveCoachInput] = useState('');
  const [removingCoach, setRemovingCoach] = useState(false);

  const [loading, setLoading] = useState(!getCachedProfile());
  const [error, setError] = useState(false);

  const handlePickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;
    setAvatarUploading(true);
    try {
      const avatarUrl = await uploadAvatar(profile.id, result.assets[0].uri);
      setProfile({ ...profile, avatarUrl });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      console.error('Avatar upload error:', err);
      showAlert('Error', err?.message || 'Failed to upload photo');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleRemoveAvatar = () => {
    confirmAction('Remove Photo', 'Are you sure you want to remove your profile photo?', async () => {
      try {
        await deleteAvatar(profile.id);
        setProfile({ ...profile, avatarUrl: '' });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        showAlert('Error', 'Failed to remove photo');
      }
    }, 'Remove');
  };

  const loadData = useCallback(async () => {
    try {
      const [p, prs, progs, cl] = await Promise.all([getProfile(), getPRs(), getPrograms(), getClients()]);
      setProfile(p);
      setNameInput(p.name);
      setBwInput(p.bodyWeight ? String(p.bodyWeight) : '');
      setStats({ prs: prs.length, programs: progs.length, clients: cl.length });
      if (p.role === 'client') {
        try {
          const coach = await getMyCoach();
          setMyCoach(coach);
        } catch { setMyCoach(null); }
      } else {
        setMyCoach(null);
      }
      setError(false);
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleSave = async () => {
    const updated = { ...profile, name: nameInput };
    await saveProfile(updated);
    setProfile(updated);
    setEditing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };


  const handleResetCoachCode = () => {
    confirmAction(
      "Reset Coach Code",
      "This will generate a new coach code. Existing clients will still be connected, but new clients will need the updated code.",
      async () => {
        try {
          const newCode = await resetCoachCode();
          setProfile({ ...profile, coachCode: newCode });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {
          showAlert("Error", "Unable to reset coach code. Please check your internet connection.");
        }
      },
      "Reset Code"
    );
  };

  const toggleRole = () => {
    const newRole = profile.role === 'coach' ? 'client' : 'coach';
    const label = newRole === 'coach' ? 'Coach' : 'Athlete';
    confirmAction(
      `Switch to ${label} Mode?`,
      newRole === 'coach'
        ? 'You will see your client roster and coaching tools. Your own training programs will be hidden.'
        : 'You will see your own training programs. Your client roster will be hidden.',
      async () => {
        const updated = { ...profile, role: newRole };
        await saveProfile(updated);
        setProfile(updated);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        loadData();
      },
      `Switch to ${label}`
    );
  };

  const handleRemoveCoach = async () => {
    if (removeCoachInput !== 'REMOVE') return;
    setRemovingCoach(true);
    try {
      await leaveCoach();
      setMyCoach(null);
      setShowRemoveCoachModal(false);
      setRemoveCoachInput('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert("Coach Removed", "You've been disconnected from your coach. You can join a new coach anytime.");
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to remove coach');
    }
    setRemovingCoach(false);
  };

  const handleDeleteAccount = async () => {
    if (deleteInput !== 'DELETE') return;
    setDeleting(true);
    try {
      await deleteAccount('DELETE');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setShowDeleteModal(false);
      await authLogout();
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to delete account');
    }
    setDeleting(false);
  };

  const isCoach = profile.role === 'coach';
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + webTopInset }}>
        <ProfileSkeleton />
      </View>
    );
  }

  if (error && !getCachedProfile()) {
    return <NetworkError onRetry={loadData} />;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset, backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
      >
        <Animated.View entering={FadeInDown.duration(400)} style={[styles.profileCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
          <Pressable style={styles.avatarContainer} onPress={handlePickAvatar} onLongPress={profile.avatarUrl ? handleRemoveAvatar : undefined} accessibilityLabel="Change profile picture" accessibilityRole="imagebutton">
            {avatarUploading ? (
              <View style={[styles.avatar, { borderColor: colors.primary }]}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : profile.avatarUrl ? (
              <Image source={{ uri: getAvatarUrl(profile.avatarUrl) }} style={[styles.avatarImage, { borderColor: colors.primary }]} />
            ) : (
              <View style={[styles.avatar, { borderColor: colors.primary }]}>
                <Ionicons name="person" size={32} color={colors.primary} />
              </View>
            )}
            <View style={[styles.avatarBadge, { backgroundColor: colors.primary, borderColor: colors.backgroundCard }]}>
              <Ionicons name="camera" size={12} color="#fff" />
            </View>
          </Pressable>
          {editing ? (
            <View style={styles.nameEditRow}>
              <TextInput
                style={[styles.nameInput, { color: colors.text, backgroundColor: colors.surfaceLight }]}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="Enter your name"
                placeholderTextColor={colors.textMuted}
                autoFocus
                accessibilityLabel="Your name"
              />
              <Pressable onPress={handleSave} hitSlop={8} accessibilityLabel="Save name" accessibilityRole="button">
                <Ionicons name="checkmark-circle" size={28} color={colors.success} />
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setEditing(true)} style={styles.nameRow} accessibilityLabel="Edit name" accessibilityRole="button">
              <Text style={[styles.profileName, { color: colors.text }]}>{profile.name || 'Tap to set name'}</Text>
              <Ionicons name="pencil" size={16} color={colors.textMuted} />
            </Pressable>
          )}
          <View style={styles.roleBadge}>
            <Text style={[styles.roleText, { color: colors.primary }]}>{isCoach ? 'Coach' : 'Athlete'}</Text>
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

        {isCoach && (
          <Animated.View entering={FadeInDown.delay(90).duration(400)}>
            <View style={[styles.planCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
              <View style={styles.planHeader}>
                <View style={styles.planBadge}>
                  <Ionicons name={profile.plan === 'free' ? 'star-outline' : 'star'} size={16} color={profile.plan === 'free' ? colors.textMuted : '#FFD700'} />
                  <Text style={[styles.planBadgeText, { color: colors.textMuted }, profile.plan !== 'free' && { color: '#FFD700' }]}>
                    {profile.plan === 'free' ? 'Free Plan' : profile.plan === 'tier_5' ? 'Starter Plan' : profile.plan === 'tier_10' ? 'Growth Plan' : profile.plan === 'saas' ? 'SaaS Plan' : profile.plan === 'enterprise' ? 'Enterprise' : profile.plan.charAt(0).toUpperCase() + profile.plan.slice(1)}
                  </Text>
                </View>
                <Pressable
                  style={styles.upgradeBtnSmall}
                  onPress={() => {
                    WebBrowser.openBrowserAsync('https://liftflow-paysite.onrender.com/pricing');
                  }}
                >
                  <Text style={[styles.upgradeBtnSmallText, { color: colors.primary }]}>{profile.plan === 'free' ? 'Upgrade' : 'Manage'}</Text>
                </Pressable>
              </View>
              <View style={styles.planDetails}>
                <View style={styles.planDetailRow}>
                  <Ionicons name="people-outline" size={16} color={colors.textMuted} />
                  <Text style={[styles.planDetailText, { color: colors.textSecondary }]}>
                    {stats.clients} / {profile.planUserLimit === 999 ? 'Unlimited' : profile.planUserLimit} client{profile.planUserLimit !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.statsRow}>
          {isCoach ? (
            <>
              <View style={[styles.statCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
                <Ionicons name="people" size={22} color={colors.textMuted} />
                <Text style={[styles.statValue, { color: colors.text }]}>{stats.clients}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Clients</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
                <Ionicons name="barbell" size={22} color={colors.textMuted} />
                <Text style={[styles.statValue, { color: colors.text }]}>{stats.programs}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Programs</Text>
              </View>
            </>
          ) : (
            <>
              <View style={[styles.statCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
                <Ionicons name="trophy" size={22} color={colors.textMuted} />
                <Text style={[styles.statValue, { color: colors.text }]}>{stats.prs}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>PRs Logged</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
                <Ionicons name="barbell" size={22} color={colors.textMuted} />
                <Text style={[styles.statValue, { color: colors.text }]}>{stats.programs}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Programs</Text>
              </View>
            </>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(400)}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Training</Text>

          {/* Unit toggle */}
          <View style={[styles.settingItem, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(102,102,102,0.12)' }]}>
                <Ionicons name="barbell-outline" size={18} color={colors.textMuted} />
              </View>
              <View style={styles.settingTextWrap}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Weight Unit</Text>
                <Text style={[styles.settingValue, { color: colors.textMuted }]}>Used for PRs and totals</Text>
              </View>
            </View>
            <View style={[styles.unitToggle, { backgroundColor: colors.surfaceLight }]}>
              {(['kg', 'lbs'] as const).map(u => (
                <Pressable
                  key={u}
                  style={[styles.unitOption, profile.weightUnit === u && { backgroundColor: colors.primary }]}
                  onPress={async () => {
                    if (profile.weightUnit === u) return;
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    const updated = { ...profile, weightUnit: u };
                    await saveProfile(updated);
                    setProfile(updated);
                  }}
                >
                  <Text style={[styles.unitOptionText, { color: profile.weightUnit === u ? '#fff' : colors.textMuted }]}>{u}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Body weight */}
          <View style={[styles.settingItem, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(102,102,102,0.12)' }]}>
                <Ionicons name="person-outline" size={18} color={colors.textMuted} />
              </View>
              <View style={styles.settingTextWrap}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Body Weight</Text>
                <Text style={[styles.settingValue, { color: colors.textMuted }]}>Used for Dots score</Text>
              </View>
            </View>
            <View style={styles.bwRow}>
              <TextInput
                style={[styles.bwInput, { color: colors.text, backgroundColor: colors.surfaceLight }]}
                value={bwInput}
                onChangeText={setBwInput}
                keyboardType="numeric"
                placeholder="—"
                placeholderTextColor={colors.textMuted}
                returnKeyType="done"
                onEndEditing={async () => {
                  const val = parseFloat(bwInput);
                  const bw = isNaN(val) ? undefined : Math.round(val);
                  const updated = { ...profile, bodyWeight: bw };
                  await saveProfile(updated);
                  setProfile(updated);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              />
              <Text style={[styles.bwUnit, { color: colors.textMuted }]}>{profile.weightUnit}</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Settings</Text>

          <Pressable style={[styles.settingItem, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]} onPress={toggleRole}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(102, 102, 102, 0.12)' }]}>
                <Ionicons name={isCoach ? 'school' : 'fitness'} size={18} color={colors.textMuted} />
              </View>
              <View style={styles.settingTextWrap}>
                <Text style={[styles.settingLabel, { color: colors.text }]} numberOfLines={1}>Switch Role</Text>
                <Text style={[styles.settingValue, { color: colors.textMuted }]} numberOfLines={1}>Currently: {isCoach ? 'Coach' : 'Athlete'} — Tap to switch</Text>
              </View>
            </View>
            <Ionicons name="swap-horizontal" size={20} color={colors.textMuted} />
          </Pressable>

          <Pressable style={[styles.settingItem, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]} onPress={toggleTheme}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(102, 102, 102, 0.12)' }]}>
                <Ionicons name={theme === 'dark' ? 'moon' : 'sunny'} size={18} color={colors.textMuted} />
              </View>
              <View style={styles.settingTextWrap}>
                <Text style={[styles.settingLabel, { color: colors.text }]} numberOfLines={1}>Theme</Text>
                <Text style={[styles.settingValue, { color: colors.textMuted }]} numberOfLines={1}>Currently: {theme === 'dark' ? 'Dark' : 'Light'} — Tap to switch</Text>
              </View>
            </View>
            <Ionicons name={theme === 'dark' ? 'sunny-outline' : 'moon-outline'} size={20} color={colors.textMuted} />
          </Pressable>

        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <Text style={[styles.sectionTitle, { marginTop: 24, color: colors.textSecondary }]}>Data</Text>

          {!isCoach && myCoach && (
            <Pressable style={[styles.settingItem, styles.dangerItem, { backgroundColor: colors.backgroundCard }]} onPress={() => { setRemoveCoachInput(''); setShowRemoveCoachModal(true); }} accessibilityLabel="Remove coach" accessibilityRole="button">
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: 'rgba(102, 102, 102, 0.12)' }]}>
                  <Ionicons name="person-remove" size={18} color={colors.textMuted} />
                </View>
                <View style={styles.settingTextWrap}>
                  <Text style={[styles.settingLabel, { color: colors.text }]} numberOfLines={1}>Remove Coach</Text>
                  <Text style={[styles.settingValue, { color: colors.textMuted }]} numberOfLines={2}>Disconnect from {myCoach.coachName}</Text>
                </View>
              </View>
            </Pressable>
          )}

          {!isCoach && !myCoach && (
            <Pressable style={[styles.settingItem, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]} onPress={() => router.push('/join-coach')} accessibilityLabel="Add coach" accessibilityRole="button">
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: 'rgba(102, 102, 102, 0.12)' }]}>
                  <Ionicons name="person-add" size={18} color={colors.primary} />
                </View>
                <View style={styles.settingTextWrap}>
                  <Text style={[styles.settingLabel, { color: colors.text }]} numberOfLines={1}>Add Coach</Text>
                  <Text style={[styles.settingValue, { color: colors.textMuted }]} numberOfLines={2}>Enter a coach code to connect</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Pressable>
          )}

          <Pressable style={[styles.settingItem, styles.dangerItem, { backgroundColor: colors.backgroundCard }]} onPress={() => { setDeleteInput(''); setShowDeleteModal(true); }} accessibilityLabel="Delete account" accessibilityRole="button">
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(102, 102, 102, 0.12)' }]}>
                <Ionicons name="trash" size={18} color={colors.textMuted} />
              </View>
              <View style={styles.settingTextWrap}>
                <Text style={[styles.settingLabel, { color: colors.text }]} numberOfLines={1}>Delete Account</Text>
                <Text style={[styles.settingValue, { color: colors.textMuted }]} numberOfLines={2}>Permanently delete your account and all data</Text>
              </View>
            </View>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(350).duration(400)}>
          <Pressable
            style={[styles.logoutBtn, { backgroundColor: colors.backgroundCard }]}
            accessibilityLabel="Sign out"
            accessibilityRole="button"
            onPress={() => {
              confirmAction(
                "Sign Out",
                "Are you sure you want to sign out?",
                async () => {
                  await authLogout();
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                },
                "Sign Out"
              );
            }}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            <Text style={[styles.logoutText, { color: colors.danger }]}>Sign Out</Text>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.legalSection}>
          <Pressable
            style={[styles.legalLink, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}
            accessibilityLabel="Privacy Policy"
            accessibilityRole="button"
            onPress={() => router.push({ pathname: "/legal", params: { type: "privacy" } })}
          >
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.textMuted} />
            <Text style={[styles.legalLinkText, { color: colors.textSecondary }]}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
          </Pressable>
          <Pressable
            style={[styles.legalLink, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}
            accessibilityLabel="Terms of Service"
            accessibilityRole="button"
            onPress={() => router.push({ pathname: "/legal", params: { type: "terms" } })}
          >
            <Ionicons name="document-text-outline" size={18} color={colors.textMuted} />
            <Text style={[styles.legalLinkText, { color: colors.textSecondary }]}>Terms of Service</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
          </Pressable>
        </Animated.View>

      </ScrollView>

      <Modal visible={showRemoveCoachModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
            <Ionicons name="person-remove" size={40} color={colors.danger} />
            <Text style={[styles.modalTitle, { color: colors.danger }]}>Remove Coach</Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              This will disconnect you from {myCoach?.coachName || 'your coach'}. Your chat messages will be deleted and program assignments will be removed. This action cannot be undone.
            </Text>
            <Text style={[styles.modalPrompt, { color: colors.text }]}>Type REMOVE to confirm:</Text>
            <TextInput
              style={[styles.modalInput, { color: colors.danger, backgroundColor: colors.surface, borderColor: colors.border }]}
              value={removeCoachInput}
              onChangeText={setRemoveCoachInput}
              placeholder="Type REMOVE"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              accessibilityLabel="Type REMOVE to confirm coach removal"
            />
            <View style={styles.modalButtons}>
              <Pressable style={[styles.modalCancelBtn, { backgroundColor: colors.surfaceLight }]} onPress={() => setShowRemoveCoachModal(false)} accessibilityLabel="Cancel" accessibilityRole="button">
                <Text style={[styles.modalCancelText, { color: colors.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalDeleteBtn, { backgroundColor: colors.danger }, removeCoachInput !== 'REMOVE' && styles.modalDeleteBtnDisabled]}
                onPress={handleRemoveCoach}
                disabled={removeCoachInput !== 'REMOVE' || removingCoach}
                accessibilityLabel="Remove coach permanently"
                accessibilityRole="button"
              >
                <Text style={styles.modalDeleteText}>{removingCoach ? 'Removing...' : 'Remove Coach'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showDeleteModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
            <Ionicons name="warning" size={40} color={colors.danger} />
            <Text style={[styles.modalTitle, { color: colors.danger }]}>Delete Account</Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              This will permanently delete your account, all programs, clients, messages, PRs, and all associated data. This action cannot be undone.
            </Text>
            <Text style={[styles.modalPrompt, { color: colors.text }]}>Type DELETE to confirm:</Text>
            <TextInput
              style={[styles.modalInput, { color: colors.danger, backgroundColor: colors.surface, borderColor: colors.border }]}
              value={deleteInput}
              onChangeText={setDeleteInput}
              placeholder="Type DELETE"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              accessibilityLabel="Type DELETE to confirm account deletion"
            />
            <View style={styles.modalButtons}>
              <Pressable style={[styles.modalCancelBtn, { backgroundColor: colors.surfaceLight }]} onPress={() => setShowDeleteModal(false)} accessibilityLabel="Cancel" accessibilityRole="button">
                <Text style={[styles.modalCancelText, { color: colors.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalDeleteBtn, { backgroundColor: colors.danger }, deleteInput !== 'DELETE' && styles.modalDeleteBtnDisabled]}
                onPress={handleDeleteAccount}
                disabled={deleteInput !== 'DELETE' || deleting}
                accessibilityLabel="Delete account permanently"
                accessibilityRole="button"
              >
                <Text style={styles.modalDeleteText}>{deleting ? 'Deleting...' : 'Delete Forever'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.colors.background },
  header: { paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { fontFamily: 'Rubik_700Bold', fontSize: 28, color: Colors.colors.text },
  scrollContent: { paddingHorizontal: 20 },
  profileCard: {
    backgroundColor: Colors.colors.backgroundCard, borderRadius: 12, padding: 24,
    alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: Colors.colors.border,
  },
  avatarContainer: { marginBottom: 14, position: 'relative' as const },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(232, 81, 47, 0.12)',
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.colors.primary,
  },
  avatarImage: {
    width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: Colors.colors.primary,
  },
  avatarBadge: {
    position: 'absolute' as const, bottom: 0, right: -2, width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.colors.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.colors.backgroundCard,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  profileName: { fontFamily: 'Rubik_600SemiBold', fontSize: 20, color: Colors.colors.text },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%' },
  nameInput: {
    flex: 1, fontFamily: 'Rubik_500Medium', fontSize: 18, color: Colors.colors.text,
    backgroundColor: Colors.colors.surfaceLight, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  roleBadge: {
    backgroundColor: 'rgba(232, 81, 47, 0.12)', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 12, marginTop: 10,
  },
  roleText: { fontFamily: 'Rubik_500Medium', fontSize: 13, color: Colors.colors.primary },
  coachCodeCard: {
    backgroundColor: Colors.colors.backgroundCard, borderRadius: 12, padding: 18,
    borderWidth: 1, borderColor: Colors.colors.border, marginBottom: 16,
  },
  coachCodeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  coachCodeLabel: { fontFamily: 'Rubik_600SemiBold', fontSize: 15, color: Colors.colors.text },
  coachCodeSub: { fontFamily: 'Rubik_400Regular', fontSize: 13, color: Colors.colors.textMuted, marginTop: 2 },
  resetCodeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(232,81,47,0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  resetCodeText: { fontFamily: 'Rubik_500Medium', fontSize: 13, color: Colors.colors.primary },
  coachCodeDisplay: {
    alignItems: 'center', backgroundColor: Colors.colors.surface, borderRadius: 12,
    paddingVertical: 16, marginTop: 14, borderWidth: 1, borderColor: Colors.colors.border,
  },
  coachCodeValue: { fontFamily: 'Rubik_700Bold', fontSize: 28, color: Colors.colors.primary, letterSpacing: 4 },
  coachCodeHidden: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  coachCodeHiddenText: { fontFamily: 'Rubik_500Medium', fontSize: 14, color: Colors.colors.textMuted },
  planCard: {
    backgroundColor: Colors.colors.backgroundCard, borderRadius: 12, padding: 18,
    borderWidth: 1, borderColor: Colors.colors.border, marginBottom: 16,
  },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  planBadgeText: { fontFamily: 'Rubik_600SemiBold', fontSize: 15, color: Colors.colors.textMuted },
  upgradeBtnSmall: {
    backgroundColor: 'rgba(232,81,47,0.12)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8,
  },
  upgradeBtnSmallText: { fontFamily: 'Rubik_600SemiBold', fontSize: 13, color: Colors.colors.primary },
  planDetails: { marginTop: 12 },
  planDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planDetailText: { fontFamily: 'Rubik_400Regular', fontSize: 14, color: Colors.colors.textSecondary },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: {
    flex: 1, backgroundColor: Colors.colors.backgroundCard, borderRadius: 12, padding: 18,
    alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.colors.border,
  },
  statValue: { fontFamily: 'Rubik_700Bold', fontSize: 24, color: Colors.colors.text },
  statLabel: { fontFamily: 'Rubik_400Regular', fontSize: 13, color: Colors.colors.textMuted },
  sectionTitle: {
    fontFamily: 'Rubik_600SemiBold', fontSize: 16, color: Colors.colors.textSecondary,
    marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  settingItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.colors.backgroundCard, borderRadius: 12, padding: 16,
    marginBottom: 8, borderWidth: 1, borderColor: Colors.colors.border,
  },
  dangerItem: { borderWidth: 2, borderColor: 'rgba(255, 59, 48, 0.4)' },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  settingIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  settingTextWrap: { flex: 1 },
  settingLabel: { fontFamily: 'Rubik_500Medium', fontSize: 15, color: Colors.colors.text },
  settingValue: { fontFamily: 'Rubik_400Regular', fontSize: 13, color: Colors.colors.textMuted, marginTop: 1 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.colors.backgroundCard, borderRadius: 12, padding: 16,
    marginTop: 24, borderWidth: 2, borderColor: 'rgba(255, 59, 48, 0.4)',
  },
  logoutText: { fontFamily: 'Rubik_600SemiBold', fontSize: 15, color: Colors.colors.danger },
  legalSection: { marginTop: 20, gap: 6 },
  legalLink: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 16,
    backgroundColor: Colors.colors.backgroundCard, borderRadius: 12, borderWidth: 1, borderColor: Colors.colors.border,
  },
  legalLinkText: { fontFamily: 'Rubik_400Regular', fontSize: 14, color: Colors.colors.textSecondary, flex: 1 },
  version: { fontFamily: 'Rubik_400Regular', fontSize: 13, color: Colors.colors.textMuted, textAlign: 'center', marginTop: 30 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: Colors.colors.backgroundCard, borderRadius: 12, padding: 28,
    width: '100%', maxWidth: 360, alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: Colors.colors.border,
  },
  modalTitle: { fontFamily: 'Rubik_700Bold', fontSize: 22, color: Colors.colors.danger },
  modalMessage: { fontFamily: 'Rubik_400Regular', fontSize: 14, color: Colors.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  modalPrompt: { fontFamily: 'Rubik_600SemiBold', fontSize: 14, color: Colors.colors.text, marginTop: 8 },
  modalInput: {
    fontFamily: 'Rubik_600SemiBold', fontSize: 18, color: Colors.colors.danger, textAlign: 'center',
    backgroundColor: Colors.colors.surface, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12,
    width: '100%', borderWidth: 1, borderColor: Colors.colors.border, letterSpacing: 4,
  },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8, width: '100%' },
  modalCancelBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 12,
    backgroundColor: Colors.colors.surfaceLight,
  },
  modalCancelText: { fontFamily: 'Rubik_600SemiBold', fontSize: 15, color: Colors.colors.text },
  modalDeleteBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 12,
    backgroundColor: Colors.colors.danger,
  },
  modalDeleteBtnDisabled: { opacity: 0.4 },
  modalDeleteText: { fontFamily: 'Rubik_600SemiBold', fontSize: 15, color: '#fff' },
  unitToggle: { flexDirection: 'row', borderRadius: 8, padding: 3, gap: 2 },
  unitOption: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
  unitOptionText: { fontFamily: 'Rubik_600SemiBold', fontSize: 13 },
  bwRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bwInput: { fontFamily: 'Rubik_600SemiBold', fontSize: 16, width: 64, textAlign: 'center', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  bwUnit: { fontFamily: 'Rubik_400Regular', fontSize: 14 },
});
