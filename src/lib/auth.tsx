import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

type AuthError = { message: string; code?: string; status?: number } | null;

/** Plain-language message for an auth failure. */
export function friendlyAuthError(error: AuthError): string {
  if (!error) return 'Something went wrong. Please try again.';
  const text = error.message ?? '';
  switch (error.code) {
    case 'invalid_credentials':
      return 'That email and password don’t match.';
    case 'email_not_confirmed':
      return 'Please confirm your email first. Check your inbox for the link.';
    case 'user_already_exists':
    case 'email_exists':
      return 'An account with this email already exists. Try signing in instead.';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Too many attempts. Wait a minute and try again.';
    case 'signup_disabled':
      return 'New sign-ups are turned off for this app.';
    case 'same_password':
      return 'Choose a password you haven’t used before.';
  }
  if (/failed to fetch|network request failed|networkerror|load failed/i.test(text)) {
    return 'Can’t reach the server. Check your connection and try again.';
  }
  return text || 'Something went wrong. Please try again.';
}

type AuthState = {
  /** False until the saved session (if any) has been read. */
  ready: boolean;
  session: Session | null;
  user: User | null;
  /** True when Supabase is not set up, or the visitor chose to look around with demo content. */
  demo: boolean;
  /** Supabase keys are present. */
  configured: boolean;
  /** The user opened a password-reset link and must choose a new password. */
  recovery: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<{ error?: string; needsConfirmation?: boolean }>;
  signOut: () => Promise<void>;
  sendReset: (email: string) => Promise<string | null>;
  setNewPassword: (password: string) => Promise<string | null>;
  enterDemo: () => void;
  exitDemo: () => void;
};

const noop = async () => null;

const AuthContext = createContext<AuthState>({
  ready: true,
  session: null,
  user: null,
  demo: true,
  configured: false,
  recovery: false,
  signIn: noop,
  signUp: async () => ({}),
  signOut: async () => {},
  sendReset: noop,
  setNewPassword: noop,
  enterDemo: () => {},
  exitDemo: () => {},
});

export const useAuth = () => useContext(AuthContext);

/** Where email links (confirm sign-up, reset password) should send the user back to. */
function redirectUrl() {
  if (Platform.OS === 'web') return typeof window !== 'undefined' ? window.location.origin : undefined;
  return Linking.createURL('/');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!supabase);
  const [session, setSession] = useState<Session | null>(null);
  const [recovery, setRecovery] = useState(false);
  const [lookAround, setLookAround] = useState(false);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let cancelled = false;

    client.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setReady(true);
    });
    // Only set state in here: calling back into supabase from this callback can deadlock.
    const { data: sub } = client.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') setRecovery(false);
      if (next) setLookAround(false);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Native: email links open the app with the session tokens in the URL. (On web,
  // supabase-js reads them from the address bar itself.)
  useEffect(() => {
    const client = supabase;
    if (!client || Platform.OS === 'web') return;

    const handle = async (url: string | null) => {
      if (!url) return;
      const fragment = url.includes('#') ? url.slice(url.indexOf('#') + 1) : '';
      const query = url.includes('?') ? url.slice(url.indexOf('?') + 1).split('#')[0] : '';
      const params = new URLSearchParams(fragment || query);
      const access = params.get('access_token');
      const refresh = params.get('refresh_token');
      if (!access || !refresh) return;
      const { error } = await client.auth.setSession({ access_token: access, refresh_token: refresh });
      if (!error && params.get('type') === 'recovery') setRecovery(true);
    };

    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return 'The app isn’t connected to a server yet.';
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? friendlyAuthError(error) : null;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: 'The app isn’t connected to a server yet.' };
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: redirectUrl() },
    });
    if (error) return { error: friendlyAuthError(error) };
    // With email confirmation on, an address that is already registered comes back as a
    // user with no identities (so sign-up can't be used to discover who has an account).
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      return { error: friendlyAuthError({ message: '', code: 'user_already_exists' }) };
    }
    return { needsConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    setLookAround(false);
    if (supabase) await supabase.auth.signOut();
  }, []);

  const sendReset = useCallback(async (email: string) => {
    if (!supabase) return 'The app isn’t connected to a server yet.';
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectUrl() });
    return error ? friendlyAuthError(error) : null;
  }, []);

  const setNewPassword = useCallback(async (password: string) => {
    if (!supabase) return 'The app isn’t connected to a server yet.';
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return friendlyAuthError(error);
    setRecovery(false);
    return null;
  }, []);

  const configured = !!supabase;
  const value = useMemo<AuthState>(
    () => ({
      ready,
      session,
      user: session?.user ?? null,
      demo: !configured || lookAround,
      configured,
      recovery,
      signIn,
      signUp,
      signOut,
      sendReset,
      setNewPassword,
      enterDemo: () => setLookAround(true),
      exitDemo: () => setLookAround(false),
    }),
    [ready, session, configured, lookAround, recovery, signIn, signUp, signOut, sendReset, setNewPassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
