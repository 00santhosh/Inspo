# Inspo Canvas

Save inspirations from anywhere and find them again on a spatial canvas. One Expo codebase for iOS, Android and web.

## Stack

- Expo SDK 57 (React Native 0.86), TypeScript, Expo Router, React Native Web
- react-native-gesture-handler + react-native-reanimated 4 for the canvas and the lens
- @shopify/react-native-skia draws the canvas (tiles, dot grid) and the balloon shader; react-native-svg for icons and the header gradient
- expo-image, expo-video, expo-audio
- Supabase: Auth, Postgres (`supabase/migrations`), Storage (private `media` bucket), and the `link-preview` Edge Function
- Vercel for the web build (`vercel.json`)

Install native packages with `npx expo install <pkg>` so versions match the SDK.

## Run

```bash
npm install             # also copies Skia's web runtime to public/canvaskit.wasm
npx expo start          # press w for web, or open in a development build
```

With no Supabase keys the app shows a demo canvas (placeholder images and sample videos).

Expo Go works for now. A development build (`npx expo run:ios|android` or `eas build --profile development`) becomes necessary once the native share extension for capturing from other apps is added.

## Supabase

1. Create a project, then copy `.env.example` to `.env.local` and fill in the URL and publishable key.
2. Apply the schema: `npx supabase link --project-ref <ref>` then `npx supabase db push`.
3. Deploy link previews: `npx supabase functions deploy link-preview`.

## Deploy the web build

Import the repo in Vercel. `vercel.json` sets the build (`expo export -p web`) and output (`dist`). Add the two `EXPO_PUBLIC_…` variables in the Vercel project settings.

## Where things are

| Path | What |
|---|---|
| `src/app/index.tsx` | Canvas screen: sky header, filter tabs, canvas, capture dock |
| `src/app/item/[id].tsx` | Detail view |
| `src/features/canvas/layout.ts` | Staggered masonry layout and hit-testing |
| `src/features/canvas/canvas.tsx` | Pan, pinch, wheel, tap, and hold / hover to bulge a tile |
| `src/features/skia/` | Skia canvas drawing: tiles, fonts and image loading, dot-grid and balloon shaders |
| `src/data/` | Items store (Supabase or demo data) |
| `src/components/` | Glass buttons and pills, sky gradient, icons, filter tabs, capture dock |
| `src/theme/tokens.ts` | Colours, radii, shadows, lens and canvas constants |
| `design/` | References: `ui-style-reference.png` (colours, glass, shadows), `wireframe-*.jpg` (canvas layout and the hold bulge) |

## Hold to bulge

Hold a tile for 1s on mobile, or rest the pointer for 600ms (or click and hold) on web. A balloon pushes the canvas up from behind, just above the fingertip: the held image swells at its centre and the neighbouring images curve and stretch around its rim, with light on the dome and a soft shadow around it (see `design/wireframe-hold-bulge.jpg`). Drag and the balloon follows, swelling whichever image is under the finger; near the top it sits below the finger instead. On lift it deflates. Tuning lives in `bulge` in `src/theme/tokens.ts`; the effect itself is `bulgeEffect` in `src/features/skia/shaders.ts`.

On iOS and Android the balloon is a live filter, so a held video keeps playing inside it. Skia's web build has no runtime-shader image filter, so on web the canvas is captured when the balloon starts and the same shader runs over that picture; videos don't play inside the balloon there.
