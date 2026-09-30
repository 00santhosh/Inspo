import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ItemsProvider } from '@/data/items';
import { colors } from '@/theme/tokens';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ItemsProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="item/[id]" options={{ presentation: 'modal', animation: 'fade_from_bottom' }} />
          </Stack>
        </ItemsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
