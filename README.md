# Inspo Canvas

Save inspirations from anywhere and find them again on a spatial canvas. One Expo codebase for iOS, Android and web.

## Stack

- Expo SDK 57 (React Native 0.86), TypeScript, Expo Router, React Native Web
- react-native-gesture-handler + react-native-reanimated 4 for the canvas and the lens
- react-native-svg for the dot grid, lens rim and icons (no Skia)
- expo-image, expo-video, expo-audio
- Supabase: Auth, Postgres (`supabase/migrations`), Storage (private `media` bucket), and the `link-preview` Edge Function
- Vercel for the web build (`vercel.json`)

Install native packages with `npx expo install <pkg>` so versions match the SDK.

## Run

```bash
npm install
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
| `src/features/canvas/canvas.tsx` | Pan, pinch, wheel, tap, and hold / hover to inflate a tile |
| `src/features/inflate/` | The magnified bubble shown above the finger |
| `src/data/` | Items store (Supabase or demo data) |
| `src/components/` | Glass buttons and pills, sky gradient, icons, filter tabs, capture dock |
| `src/theme/tokens.ts` | Colours, radii, shadows, lens and canvas constants |
| `design/` | Visual references (`ui-style-reference.png` sets the colours, glass buttons and shadows) |

## Hold to inflate

Hold a tile for 1s on mobile, or rest the pointer for 600ms (or click and hold) on web. The tile inflates into a magnified bubble that rises from the fingertip and floats above it, so the finger never covers what you are looking at. The bubble frames the whole held item with a little of its surroundings, and a caption says what it is. Drag and the bubble follows, gliding to each tile under the finger; near the top of the screen it flips below the finger. Videos autoplay muted inside it. Tiles are re-rendered at the magnified size, so images and text stay sharp.
