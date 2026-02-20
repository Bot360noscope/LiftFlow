import { StyleSheet, Text, View, Pressable, Platform, TextInput, KeyboardAvoidingView, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import Colors from "@/constants/colors";
import { useAuth } from "@/lib/auth-context";

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'coach' | 'client'>('client');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }
    if (mode === 'signup' && !name.trim()) {
      setError('Please enter your name');
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await register(email.trim(), password, name.trim(), role);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + webTopInset + 40, paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 20) },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoSection}>
          <View style={styles.logoIcon}>
            <Ionicons name="barbell-outline" size={36} color={Colors.colors.primary} />
          </View>
          <Text style={styles.logoText}>LiftFlow</Text>
          <Text style={styles.logoSub}>
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </Text>
        </View>

        <View style={styles.form}>
          {mode === 'signup' && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor={Colors.colors.textMuted}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoComplete="name"
                accessibilityLabel="Name"
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={Colors.colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              accessibilityLabel="Email address"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="Min 6 characters"
                placeholderTextColor={Colors.colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                accessibilityLabel="Password"
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn} hitSlop={8} accessibilityLabel={showPassword ? "Hide password" : "Show password"} accessibilityRole="button">
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={Colors.colors.textMuted} />
              </Pressable>
            </View>
          </View>

          {mode === 'signup' && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>I am a...</Text>
              <View style={styles.roleRow}>
                <Pressable
                  style={[styles.roleBtn, role === 'coach' && styles.roleBtnActive]}
                  onPress={() => { setRole('coach'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                >
                  <Ionicons name="fitness-outline" size={20} color={role === 'coach' ? '#fff' : Colors.colors.textSecondary} />
                  <Text style={[styles.roleBtnText, role === 'coach' && styles.roleBtnTextActive]}>Coach</Text>
                </Pressable>
                <Pressable
                  style={[styles.roleBtn, role === 'client' && styles.roleBtnActive]}
                  onPress={() => { setRole('client'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                >
                  <Ionicons name="person-outline" size={20} color={role === 'client' ? '#fff' : Colors.colors.textSecondary} />
                  <Text style={[styles.roleBtnText, role === 'client' && styles.roleBtnTextActive]}>Athlete</Text>
                </Pressable>
              </View>
            </View>
          )}

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            accessibilityLabel={mode === 'login' ? 'Sign in' : 'Create account'}
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.submitBtnText}>{mode === 'login' ? 'Sign In' : 'Create Account'}</Text>
            )}
          </Pressable>

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
            </Text>
            <Pressable onPress={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }} accessibilityLabel={mode === 'login' ? 'Switch to sign up' : 'Switch to sign in'} accessibilityRole="button">
              <Text style={styles.switchLink}>{mode === 'login' ? 'Sign Up' : 'Sign In'}</Text>
            </Pressable>
          </View>

          <View style={styles.legalRow}>
            <Text style={styles.legalText}>
              By continuing, you agree to our{' '}
              <Text style={styles.legalLink} accessibilityRole="link" accessibilityLabel="Terms of Service" onPress={() => {
                const base = Platform.OS === 'web' ? window.location.origin.replace(':8081', ':5000') : (() => { const d = process.env.EXPO_PUBLIC_DOMAIN || ''; return d ? `https://${d.replace(/:\d+$/, '')}` : 'http://localhost:5000'; })();
                WebBrowser.openBrowserAsync(`${base}/terms`);
              }}>Terms of Service</Text>
              {' '}and{' '}
              <Text style={styles.legalLink} accessibilityRole="link" accessibilityLabel="Privacy Policy" onPress={() => {
                const base = Platform.OS === 'web' ? window.location.origin.replace(':8081', ':5000') : (() => { const d = process.env.EXPO_PUBLIC_DOMAIN || ''; return d ? `https://${d.replace(/:\d+$/, '')}` : 'http://localhost:5000'; })();
                WebBrowser.openBrowserAsync(`${base}/privacy`);
              }}>Privacy Policy</Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.colors.background },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, justifyContent: 'center' },
  logoSection: { alignItems: 'center', marginBottom: 40 },
  logoIcon: {
    width: 64, height: 64, borderRadius: 16, backgroundColor: 'rgba(232,81,47,0.12)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  logoText: { fontFamily: 'Rubik_700Bold', fontSize: 28, color: Colors.colors.text },
  logoSub: { fontFamily: 'Rubik_400Regular', fontSize: 15, color: Colors.colors.textSecondary, marginTop: 4 },
  form: { width: '100%', maxWidth: 400, alignSelf: 'center' },
  inputGroup: { marginBottom: 18 },
  inputLabel: { fontFamily: 'Rubik_600SemiBold', fontSize: 13, color: Colors.colors.textSecondary, marginBottom: 6 },
  input: {
    fontFamily: 'Rubik_400Regular', fontSize: 15, color: Colors.colors.text,
    backgroundColor: Colors.colors.backgroundCard, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: Colors.colors.border,
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn: { position: 'absolute', right: 14, top: 14 },
  roleRow: { flexDirection: 'row', gap: 10 },
  roleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.colors.backgroundCard, borderRadius: 12,
    paddingVertical: 14, borderWidth: 1, borderColor: Colors.colors.border,
  },
  roleBtnActive: { backgroundColor: Colors.colors.primary, borderColor: Colors.colors.primary },
  roleBtnText: { fontFamily: 'Rubik_600SemiBold', fontSize: 14, color: Colors.colors.textSecondary },
  roleBtnTextActive: { color: '#fff' },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 10, padding: 12, marginBottom: 16,
  },
  errorText: { fontFamily: 'Rubik_500Medium', fontSize: 13, color: '#ef4444', flex: 1 },
  submitBtn: {
    backgroundColor: Colors.colors.primary, borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', marginTop: 4,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { fontFamily: 'Rubik_700Bold', fontSize: 16, color: '#fff' },
  switchRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 20 },
  switchText: { fontFamily: 'Rubik_400Regular', fontSize: 14, color: Colors.colors.textSecondary },
  switchLink: { fontFamily: 'Rubik_600SemiBold', fontSize: 14, color: Colors.colors.primary },
  legalRow: { marginTop: 24, alignItems: 'center', paddingHorizontal: 12 },
  legalText: { fontFamily: 'Rubik_400Regular', fontSize: 12, color: Colors.colors.textMuted, textAlign: 'center' as const, lineHeight: 18 },
  legalLink: { color: Colors.colors.primary, fontFamily: 'Rubik_500Medium' },
});
