import { StyleSheet, Text, View, Pressable, Platform, TextInput, KeyboardAvoidingView, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState, useRef } from "react";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import Colors from "@/constants/colors";
import { useTheme } from "@/lib/theme-context";
import { useAuth } from "@/lib/auth-context";
import { getApiUrl } from "@/lib/query-client";

type Mode = 'login' | 'signup' | 'forgot_email' | 'forgot_code' | 'forgot_newpass';

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'coach' | 'client'>('client');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const codeInputRefs = useRef<(TextInput | null)[]>([]);
  const [codeDigits, setCodeDigits] = useState(['', '', '', '', '', '']);

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

  const handleSendCode = async () => {
    if (!resetEmail.trim()) {
      setError('Please enter your email');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const baseUrl = getApiUrl();
      const res = await fetch(new URL('/api/auth/forgot-password', baseUrl).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send code');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMode('forgot_code');
      setSuccess('Check your email for the 6-digit code');
    } catch (e: any) {
      setError(e.message || 'Failed to send reset code');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    setLoading(false);
  };

  const handleVerifyCode = async () => {
    const code = codeDigits.join('');
    if (code.length !== 6) {
      setError('Please enter the full 6-digit code');
      return;
    }
    setResetCode(code);
    setError('');
    setSuccess('');
    setMode('forgot_newpass');
  };

  const handleResetPassword = async () => {
    if (!newPassword.trim()) {
      setError('Please enter a new password');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const code = resetCode || codeDigits.join('');
      const baseUrl = getApiUrl();
      const res = await fetch(new URL('/api/auth/verify-reset-code', baseUrl).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail.trim(), code, newPassword: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccess('Password reset! You can now sign in.');
      setEmail(resetEmail);
      setPassword('');
      setResetEmail('');
      setResetCode('');
      setCodeDigits(['', '', '', '', '', '']);
      setNewPassword('');
      setMode('login');
    } catch (e: any) {
      setError(e.message || 'Failed to reset password');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    setLoading(false);
  };

  const handleCodeDigitChange = (text: string, index: number) => {
    const newDigits = [...codeDigits];
    if (text.length > 1) {
      const chars = text.replace(/\D/g, '').split('').slice(0, 6);
      for (let i = 0; i < 6; i++) {
        newDigits[i] = chars[i] || '';
      }
      setCodeDigits(newDigits);
      const lastFilled = Math.min(chars.length, 5);
      codeInputRefs.current[lastFilled]?.focus();
      return;
    }
    newDigits[index] = text.replace(/\D/g, '');
    setCodeDigits(newDigits);
    if (text && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !codeDigits[index] && index > 0) {
      const newDigits = [...codeDigits];
      newDigits[index - 1] = '';
      setCodeDigits(newDigits);
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  const goBackToLogin = () => {
    setMode('login');
    setError('');
    setSuccess('');
    setResetEmail('');
    setResetCode('');
    setCodeDigits(['', '', '', '', '', '']);
    setNewPassword('');
  };

  const renderForgotFlow = () => {
    if (mode === 'forgot_email') {
      return (
        <View style={styles.form}>
          <View style={[styles.forgotCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
            <Ionicons name="mail-outline" size={32} color={colors.primary} style={{ alignSelf: 'center', marginBottom: 12 }} />
            <Text style={[styles.forgotTitle, { color: colors.text }]}>Enter your email</Text>
            <Text style={[styles.forgotDesc, { color: colors.textSecondary }]}>
              We'll send a 6-digit code to reset your password.
            </Text>
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border, marginTop: 8 }]}
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              value={resetEmail}
              onChangeText={setResetEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              accessibilityLabel="Email for password reset"
            />
          </View>

          {error ? (
            <View style={[styles.errorBox, { marginTop: 12 }]}>
              <Ionicons name="alert-circle" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.submitBtn, { backgroundColor: colors.primary, marginTop: 16 }, loading && styles.submitBtnDisabled]}
            onPress={handleSendCode}
            disabled={loading}
            accessibilityLabel="Send reset code"
            accessibilityRole="button"
          >
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitBtnText}>Send Code</Text>}
          </Pressable>

          <Pressable onPress={goBackToLogin} style={styles.forgotRow} accessibilityLabel="Back to sign in" accessibilityRole="button">
            <Text style={[styles.forgotText, { color: colors.primary }]}>Back to Sign In</Text>
          </Pressable>
        </View>
      );
    }

    if (mode === 'forgot_code') {
      return (
        <View style={styles.form}>
          <View style={[styles.forgotCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
            <Ionicons name="keypad-outline" size={32} color={colors.primary} style={{ alignSelf: 'center', marginBottom: 12 }} />
            <Text style={[styles.forgotTitle, { color: colors.text }]}>Enter the code</Text>
            <Text style={[styles.forgotDesc, { color: colors.textSecondary }]}>
              We sent a 6-digit code to {resetEmail}
            </Text>

            <View style={styles.codeRow}>
              {codeDigits.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={(ref) => { codeInputRefs.current[i] = ref; }}
                  style={[styles.codeInput, { color: colors.text, backgroundColor: colors.background, borderColor: digit ? colors.primary : colors.border }]}
                  value={digit}
                  onChangeText={(t) => handleCodeDigitChange(t, i)}
                  onKeyPress={({ nativeEvent }) => handleCodeKeyPress(nativeEvent.key, i)}
                  keyboardType="number-pad"
                  maxLength={i === 0 ? 6 : 1}
                  selectTextOnFocus
                  accessibilityLabel={`Code digit ${i + 1}`}
                />
              ))}
            </View>
          </View>

          {success ? (
            <View style={[styles.successBox, { marginTop: 12 }]}>
              <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
              <Text style={styles.successText}>{success}</Text>
            </View>
          ) : null}

          {error ? (
            <View style={[styles.errorBox, { marginTop: 12 }]}>
              <Ionicons name="alert-circle" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.submitBtn, { backgroundColor: colors.primary, marginTop: 16 }]}
            onPress={handleVerifyCode}
            accessibilityLabel="Verify code"
            accessibilityRole="button"
          >
            <Text style={styles.submitBtnText}>Verify Code</Text>
          </Pressable>

          <Pressable onPress={() => { setMode('forgot_email'); setError(''); setSuccess(''); }} style={styles.forgotRow} accessibilityLabel="Resend code" accessibilityRole="button">
            <Text style={[styles.forgotText, { color: colors.primary }]}>Didn't get a code? Resend</Text>
          </Pressable>
        </View>
      );
    }

    if (mode === 'forgot_newpass') {
      return (
        <View style={styles.form}>
          <View style={[styles.forgotCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
            <Ionicons name="lock-open-outline" size={32} color={colors.primary} style={{ alignSelf: 'center', marginBottom: 12 }} />
            <Text style={[styles.forgotTitle, { color: colors.text }]}>Set new password</Text>
            <Text style={[styles.forgotDesc, { color: colors.textSecondary }]}>
              Choose a new password for your account.
            </Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0, marginTop: 8, color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                placeholder="Min 6 characters"
                placeholderTextColor={colors.textMuted}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNewPassword}
                autoComplete="new-password"
                accessibilityLabel="New password"
              />
              <Pressable onPress={() => setShowNewPassword(!showNewPassword)} style={[styles.eyeBtn, { top: 22 }]} hitSlop={8}>
                <Ionicons name={showNewPassword ? 'eye-off' : 'eye'} size={20} color={colors.textMuted} />
              </Pressable>
            </View>
          </View>

          {error ? (
            <View style={[styles.errorBox, { marginTop: 12 }]}>
              <Ionicons name="alert-circle" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.submitBtn, { backgroundColor: colors.primary, marginTop: 16 }, loading && styles.submitBtnDisabled]}
            onPress={handleResetPassword}
            disabled={loading}
            accessibilityLabel="Reset password"
            accessibilityRole="button"
          >
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitBtnText}>Reset Password</Text>}
          </Pressable>

          <Pressable onPress={goBackToLogin} style={styles.forgotRow} accessibilityLabel="Cancel" accessibilityRole="button">
            <Text style={[styles.forgotText, { color: colors.primary }]}>Cancel</Text>
          </Pressable>
        </View>
      );
    }

    return null;
  };

  const isForgot = mode.startsWith('forgot');

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
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
            <Ionicons name="barbell-outline" size={36} color={colors.primary} />
          </View>
          <Text style={[styles.logoText, { color: colors.text }]}>LiftFlow</Text>
          <Text style={[styles.logoSub, { color: colors.textSecondary }]}>
            {isForgot ? 'Reset your password' : mode === 'login' ? 'Welcome back' : 'Create your account'}
          </Text>
        </View>

        {isForgot ? renderForgotFlow() : (

        <View style={styles.form}>
          {mode === 'signup' && (
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Name</Text>
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.backgroundCard, borderColor: colors.border }]}
                placeholder="Your name"
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoComplete="name"
                accessibilityLabel="Name"
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Email</Text>
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.backgroundCard, borderColor: colors.border }]}
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
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
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0, color: colors.text, backgroundColor: colors.backgroundCard, borderColor: colors.border }]}
                placeholder="Min 6 characters"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                accessibilityLabel="Password"
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn} hitSlop={8} accessibilityLabel={showPassword ? "Hide password" : "Show password"} accessibilityRole="button">
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.textMuted} />
              </Pressable>
            </View>
          </View>

          {mode === 'signup' && (
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>I am a...</Text>
              <View style={styles.roleRow}>
                <Pressable
                  style={[styles.roleBtn, { backgroundColor: colors.backgroundCard, borderColor: colors.border }, role === 'coach' && [styles.roleBtnActive, { backgroundColor: colors.primary, borderColor: colors.primary }]]}
                  onPress={() => { setRole('coach'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                >
                  <Ionicons name="fitness-outline" size={20} color={role === 'coach' ? '#fff' : colors.textSecondary} />
                  <Text style={[styles.roleBtnText, { color: colors.textSecondary }, role === 'coach' && styles.roleBtnTextActive]}>Coach</Text>
                </Pressable>
                <Pressable
                  style={[styles.roleBtn, { backgroundColor: colors.backgroundCard, borderColor: colors.border }, role === 'client' && [styles.roleBtnActive, { backgroundColor: colors.primary, borderColor: colors.primary }]]}
                  onPress={() => { setRole('client'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                >
                  <Ionicons name="person-outline" size={20} color={role === 'client' ? '#fff' : colors.textSecondary} />
                  <Text style={[styles.roleBtnText, { color: colors.textSecondary }, role === 'client' && styles.roleBtnTextActive]}>Athlete</Text>
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

          {success ? (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
              <Text style={styles.successText}>{success}</Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.submitBtn, { backgroundColor: colors.primary }, loading && styles.submitBtnDisabled]}
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

          {mode === 'login' && (
            <Pressable
              onPress={() => { setMode('forgot_email'); setError(''); setSuccess(''); }}
              style={styles.forgotRow}
              accessibilityLabel="Forgot password"
              accessibilityRole="button"
            >
              <Text style={[styles.forgotText, { color: colors.primary }]}>Forgot Password?</Text>
            </Pressable>
          )}

          <View style={styles.switchRow}>
            <Text style={[styles.switchText, { color: colors.textSecondary }]}>
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
            </Text>
            <Pressable onPress={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setSuccess(''); }} accessibilityLabel={mode === 'login' ? 'Switch to sign up' : 'Switch to sign in'} accessibilityRole="button">
              <Text style={[styles.switchLink, { color: colors.primary }]}>{mode === 'login' ? 'Sign Up' : 'Sign In'}</Text>
            </Pressable>
          </View>

          <View style={styles.legalRow}>
            <Text style={[styles.legalText, { color: colors.textMuted }]}>
              By continuing, you agree to our{' '}
              <Text style={[styles.legalLink, { color: colors.primary }]} accessibilityRole="link" accessibilityLabel="Terms of Service" onPress={() => {
                const base = Platform.OS === 'web' ? window.location.origin.replace(':8081', ':5000') : (() => { const d = process.env.EXPO_PUBLIC_DOMAIN || ''; return d ? `https://${d.replace(/:\d+$/, '')}` : 'http://localhost:5000'; })();
                WebBrowser.openBrowserAsync(`${base}/terms`);
              }}>Terms of Service</Text>
              {' '}and{' '}
              <Text style={[styles.legalLink, { color: colors.primary }]} accessibilityRole="link" accessibilityLabel="Privacy Policy" onPress={() => {
                const base = Platform.OS === 'web' ? window.location.origin.replace(':8081', ':5000') : (() => { const d = process.env.EXPO_PUBLIC_DOMAIN || ''; return d ? `https://${d.replace(/:\d+$/, '')}` : 'http://localhost:5000'; })();
                WebBrowser.openBrowserAsync(`${base}/privacy`);
              }}>Privacy Policy</Text>
            </Text>
          </View>
        </View>
        )}
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
  successBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: 10, padding: 12, marginBottom: 16,
  },
  successText: { fontFamily: 'Rubik_500Medium', fontSize: 13, color: '#22c55e', flex: 1 },
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
  forgotRow: { alignItems: 'center', marginTop: 16 },
  forgotText: { fontFamily: 'Rubik_600SemiBold', fontSize: 14 },
  forgotCard: {
    borderRadius: 16, borderWidth: 1, padding: 24,
  },
  forgotTitle: { fontFamily: 'Rubik_600SemiBold', fontSize: 17, textAlign: 'center' as const, marginBottom: 8 },
  forgotDesc: { fontFamily: 'Rubik_400Regular', fontSize: 14, textAlign: 'center' as const, lineHeight: 20, marginBottom: 8 },
  codeRow: {
    flexDirection: 'row' as const, justifyContent: 'center' as const, gap: 8, marginTop: 16,
  },
  codeInput: {
    width: 44, height: 52, borderRadius: 10, borderWidth: 1.5,
    textAlign: 'center' as const, fontSize: 22, fontFamily: 'Rubik_700Bold',
  },
});
