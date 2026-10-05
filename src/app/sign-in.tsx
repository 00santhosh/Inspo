import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Notice, PrimaryButton, TextField, TextLink } from '@/components/form';
import { SkyHeader } from '@/components/sky-header';
import { useAuth } from '@/lib/auth';
import { colors, fonts } from '@/theme/tokens';

type Mode = 'signin' | 'signup' | 'reset' | 'recovery';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD = 8;

const TITLES: Record<Mode, string> = {
  signin: 'Welcome back',
  signup: 'Create your account',
  reset: 'Reset your password',
  recovery: 'Choose a new password',
};

export default function SignIn() {
  const auth = useAuth();
  const [chosen, setMode] = useState<Mode>('signin');
  const mode: Mode = auth.recovery ? 'recovery' : chosen;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const go = (next: Mode) => {
    setMode(next);
    setErrors({});
    setFormError(null);
    setMessage(null);
  };

  const submit = async () => {
    if (busy) return;
    const e: typeof errors = {};
    if (mode !== 'recovery' && !EMAIL.test(email.trim())) e.email = 'Enter a valid email address.';
    if (mode !== 'reset') {
      if (!password) e.password = mode === 'recovery' ? 'Enter a new password.' : 'Enter your password.';
      else if ((mode === 'signup' || mode === 'recovery') && password.length < MIN_PASSWORD)
        e.password = `Use at least ${MIN_PASSWORD} characters.`;
    }
    setErrors(e);
    setFormError(null);
    setMessage(null);
    if (e.email || e.password) return;

    setBusy(true);
    try {
      if (mode === 'signin') {
        const error = await auth.signIn(email, password);
        if (error) setFormError(error);
      } else if (mode === 'signup') {
        const res = await auth.signUp(email, password);
        if (res.error) setFormError(res.error);
        else if (res.needsConfirmation) {
          setMessage(`We sent a confirmation link to ${email.trim()}. Open it, then come back and sign in.`);
          setMode('signin');
          setPassword('');
        }
      } else if (mode === 'reset') {
        const error = await auth.sendReset(email);
        if (error) setFormError(error);
        else setMessage(`If ${email.trim()} has an account, a reset link is on its way.`);
      } else {
        const error = await auth.setNewPassword(password);
        if (error) setFormError(error);
      }
    } finally {
      setBusy(false);
    }
  };

  const action = { signin: 'Sign in', signup: 'Create account', reset: 'Send reset link', recovery: 'Save new password' }[mode];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <SkyHeader style={{ paddingBottom: 28, gap: 8 }}>
          <Text accessibilityRole="header" style={styles.brand}>
            Inspo Canvas
          </Text>
          <Text style={styles.tagline}>Save inspiration from anywhere. Find it again at the right time.</Text>
        </SkyHeader>

        <View style={styles.formWrap}>
          <View style={styles.form}>
            <Text accessibilityRole="header" style={styles.title}>
              {TITLES[mode]}
            </Text>

            {message ? <Notice kind="success" text={message} /> : null}
            {formError ? <Notice kind="error" text={formError} /> : null}

            {mode !== 'recovery' ? (
              <TextField
                label="Email"
                value={email}
                onChangeText={setEmail}
                error={errors.email}
                placeholder="you@example.com"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType={mode === 'reset' ? 'send' : 'next'}
                onSubmitEditing={() => (mode === 'reset' ? submit() : passwordRef.current?.focus())}
              />
            ) : null}

            {mode !== 'reset' ? (
              <TextField
                ref={passwordRef}
                label={mode === 'recovery' ? 'New password' : 'Password'}
                value={password}
                onChangeText={setPassword}
                error={errors.password}
                placeholder={mode === 'signin' ? 'Your password' : `At least ${MIN_PASSWORD} characters`}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                textContentType={mode === 'signin' ? 'password' : 'newPassword'}
                returnKeyType="go"
                onSubmitEditing={submit}
              />
            ) : null}

            <PrimaryButton label={action} onPress={submit} loading={busy} />

            <View style={styles.links}>
              {mode === 'signin' ? (
                <>
                  <TextLink label="Forgot password?" onPress={() => go('reset')} />
                  <TextLink label="Create an account" onPress={() => go('signup')} />
                </>
              ) : mode === 'signup' ? (
                <TextLink label="I already have an account" onPress={() => go('signin')} />
              ) : mode === 'reset' ? (
                <TextLink label="Back to sign in" onPress={() => go('signin')} />
              ) : null}
            </View>
          </View>

          {mode === 'signin' || mode === 'signup' ? (
            <View style={styles.demo}>
              <Text style={styles.demoText}>Just curious?</Text>
              <TextLink label="Look around with demo content" onPress={auth.enterDemo} />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  scroll: { flexGrow: 1, paddingBottom: 32 },
  brand: { fontFamily: fonts.sans, fontSize: 36, fontWeight: '800', letterSpacing: -0.9, color: colors.text },
  tagline: { fontFamily: fonts.sans, fontSize: 15.5, lineHeight: 22, color: 'rgba(255, 255, 255, 0.9)', maxWidth: 360 },
  formWrap: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 28, gap: 22 },
  form: { width: '100%', maxWidth: 440, gap: 16 },
  title: { fontFamily: fonts.sans, fontSize: 22, fontWeight: '700', letterSpacing: -0.3, color: colors.text },
  links: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, paddingHorizontal: 4 },
  demo: { alignItems: 'center', gap: 6, paddingTop: 8 },
  demoText: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.textSecondary },
});
