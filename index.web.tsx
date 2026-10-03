import '@expo/metro-runtime';

import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { App } from 'expo-router/build/qualified-entry';
import { renderRootComponent } from 'expo-router/build/renderRootComponent';

// The canvas is drawn with Skia, so its WebAssembly runtime (public/canvaskit.wasm)
// must load before the app renders.
LoadSkiaWeb().then(() => {
  renderRootComponent(App);
});
