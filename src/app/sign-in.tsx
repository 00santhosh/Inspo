import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Notice, PrimaryButton, SecondaryButton, TextField, TextLink } from '@/components/form';
import { SkyHeader } from '@/components/sky-header';
import { useAuth } from '@/lib/auth';
import { colors, fonts } from '@/theme/tokens';

type Mode = 'signin' | 'signup' | 'reset' | 'recovery';
/** After sending an email: a "check your inbox" screen for that address. */
type Sent = { kind: 'confirm' | 'reset'; email: string } | null;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD = 8;

const TITLES: Record<Mode, string> = {
  signin: 'Welcome back',
  signup: 'Create your account',
  reset: 'Reset your password',
  recovery: 'Choose a new password',
};

const SUBTITLES: Record<Mode, string> = {
  signin: 'Sign in to see your canvas.',
  signup: 'Free to start. Save your first inspiration in under a minute.',
  reset: 'Enter your email and we’ll send you a link to choose a new password.',
  recovery: 'Pick a password you’ll remember. At least 8 characters.',
};

export default function SignIn() {
  const auth = useAuth();
  // Most visitors are new, so start on "Create your account".
  const [chosen, setMode] = useState<Mode>('signup');
  const mode: Mode = auth.recovery ? 'recovery' : chosen;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent>(null);
  const [resent, setResent] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const go = (next: Mode) => {
    setMode(next);
    setErrors({});
    setFormError(null);
    setSent(null);
    setResent(null);
    setShowPassword(false);
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
          setSent({ kind: 'confirm', email: email.trim() });
          setPassword('');
        }
      } else if (mode === 'reset') {
        const error = await auth.sendReset(email);
        if (error) setFormError(error);
        else setSent({ kind: 'reset', email: email.trim() });
      } else {
        const error = await auth.setNewPassword(password);
        if (error) setFormError(error);
      }
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!sent || busy) return;
    setBusy(true);
    setResent(null);
    setFormError(null);
    const error = sent.kind === 'confirm' ? await auth.resendConfirmation(sent.email) : await auth.sendReset(sent.email);
    setBusy(false);
    if (error) setFormError(error);
    else setResent(`Sent again to ${sent.email}.`);
  };

  const action = { signin: 'Sign in', signup: 'Create account', reset: 'Send reset link', recovery: 'Save new password' }[mode];
  const unconfirmed = mode === 'signin' && !!formError && /confirm your email/i.test(formError);

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
          {sent ? (
            <View style={styles.form}>
              <Text accessibilityRole="header" style={styles.title}>
                Check your inbox
              </Text>
              <Text style={styles.subtitle}>
                {sent.kind === 'confirm'
                  ? `We sent a confirmation link to ${sent.email}. Open it to finish creating your account, then come back and sign in.`
                  : `If ${sent.email} has an account, a reset link is on its way. Open it to choose a new password.`}
              </Text>
              {resent ? <Notice kind="success" text={resent} /> : null}
              {formError ? <Notice kind="error" text={formError} /> : null}
              <PrimaryButton label="Back to sign in" onPress={() => go('signin')} />
              <SecondaryButton label="Didn’t get it? Send again" onPress={resend} />
              <Text style={styles.small}>Check your spam folder too. It can take a minute to arrive.</Text>
              <View style={styles.links}>
                <TextLink label={sent.kind === 'confirm' ? 'Use a different email' : 'Try a different email'} onPress={() => go(sent.kind === 'confirm' ? 'signup' : 'reset')} />
              </View>
            </View>
          ) : (
            <View style={styles.form}>
              <Text accessibilityRole="header" style={styles.title}>
                {TITLES[mode]}
              </Text>
              <Text style={styles.subtitle}>{SUBTITLES[mode]}</Text>

              {formError ? <Notice kind="error" text={formError} /> : null}
              {unconfirmed ? (
                <TextLink
                  label="Resend the confirmation email"
                  onPress={async () => {
                    const error = await auth.resendConfirmation(email);
                    setFormError(null);
                    if (error) setFormError(error);
                    else setSent({ kind: 'confirm', email: email.trim() });
                  }}
                />
              ) : null}

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
                <View style={styles.passwordWrap}>
                  <TextField
                    ref={passwordRef}
                    label={mode === 'recovery' ? 'New password' : 'Password'}
                    value={password}
                    onChangeText={setPassword}
                    error={errors.password}
                    placeholder={mode === 'signin' ? 'Your password' : `At least ${MIN_PASSWORD} characters`}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    textContentType={mode === 'signin' ? 'password' : 'newPassword'}
                    returnKeyType="go"
                    onSubmitEditing={submit}
                  />
                  <View style={styles.showToggle}>
                    <TextLink label={showPassword ? 'Hide password' : 'Show password'} onPress={() => setShowPassword((v) => !v)} />
                  </View>
                </View>
              ) : null}

              {mode === 'signin' ? (
                <View style={styles.forgot}>
                  <TextLink label="Forgot password?" onPress={() => go('reset')} />
                </View>
              ) : null}

              <PrimaryButton label={action} onPress={submit} loading={busy} />

              <View style={styles.switchRow}>
                {mode === 'signin' ? (
                  <>
                    <Text style={styles.switchText}>New here?</Text>
                    <TextLink label="Create an account" onPress={() => go('signup')} />
                  </>
                ) : mode === 'signup' ? (
                  <>
                    <Text style={styles.switchText}>Already have an account?</Text>
                    <TextLink label="Sign in" onPress={() => go('signin')} />
                  </>
                ) : mode === 'reset' ? (
                  <TextLink label="Back to sign in" onPress={() => go('signin')} />
                ) : null}
              </View>
            </View>
          )}

          {!sent && (mode === 'signin' || mode === 'signup') ? (
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
  subtitle: { fontFamily: fonts.sans, fontSize: 14.5, lineHeight: 21, color: colors.textSecondary, marginTop: -8 },
  small: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.textTertiary, textAlign: 'center' },
  passwordWrap: { gap: 8 },
  showToggle: { alignItems: 'flex-end', paddingHorizontal: 4 },
  forgot: { alignItems: 'flex-end', paddingHorizontal: 4, marginTop: -6 },
  links: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 12, paddingHorizontal: 4 },
  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  switchText: { fontFamily: fonts.sans, fontSize: 14.5, color: colors.textSecondary },
  demo: { alignItems: 'center', gap: 6, paddingTop: 8 },
  demoText: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.textSecondary },
});
