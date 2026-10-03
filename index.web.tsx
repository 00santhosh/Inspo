import '@expo/metro-runtime';

import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { App } from 'expo-router/build/qualified-entry';
import { renderRootComponent } from 'expo-router/build/renderRootComponent';

// The canvas is drawn with Skia, so its WebAssembly runtime (public/canvaskit.wasm)
// must load before the app renders. Point at the site root explicitly: by default it is
// looked up next to the JS bundle, which in production lives under /_expo/static/js/.
LoadSkiaWeb({ locateFile: (file) => `/${file}` }).then(() => {
  renderRootComponent(App);
});
