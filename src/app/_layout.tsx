import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastProvider } from '@/components/toast';
import { ItemsProvider } from '@/data/items';
import { AuthProvider, useAuth } from '@/lib/auth';
import { colors } from '@/theme/tokens';

const modal = { presentation: 'modal' } as const;

function Routes() {
  const { ready, session, demo, recovery } = useAuth();

  // Reading the saved session takes a moment; don't flash the sign-in screen at someone who is signed in.
  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}>
        <ActivityIndicator color={colors.textSecondary} />
      </View>
    );
  }

  // A password-reset link signs the user in, but they must pick a new password first.
  const inApp = demo || (!!session && !recovery);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
      <Stack.Protected guard={!inApp}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={inApp}>
        <Stack.Screen name="index" />
        <Stack.Screen name="item/[id]" options={{ presentation: 'modal', animation: 'fade_from_bottom' }} />
        <Stack.Screen name="add/note" options={modal} />
        <Stack.Screen name="add/link" options={modal} />
        <Stack.Screen name="add/voice" options={modal} />
        <Stack.Screen name="account" options={modal} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <ToastProvider>
            <ItemsProvider>
              <StatusBar style="light" />
              <Routes />
            </ItemsProvider>
          </ToastProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
