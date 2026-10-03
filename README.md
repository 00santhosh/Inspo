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
| `src/features/canvas/canvas.tsx` | Pan, pinch, wheel, tap, and hold / hover to bulge a tile |
| `src/features/bulge/` | Hold-to-bulge: layout maths, pushed neighbour tiles, the enlarged held tile |
| `src/data/` | Items store (Supabase or demo data) |
| `src/components/` | Glass buttons and pills, sky gradient, icons, filter tabs, capture dock |
| `src/theme/tokens.ts` | Colours, radii, shadows, lens and canvas constants |
| `design/` | References: `ui-style-reference.png` (colours, glass, shadows), `wireframe-*.jpg` (canvas layout and the hold bulge) |

## Hold to bulge

Hold a tile for 1s on mobile, or rest the pointer for 600ms (or click and hold) on web. The tile grows in place to about twice its size, rising so its bottom edge sits just above the fingertip, and its neighbours slide outward and shrink to make room, hugging the bulge (see `design/wireframe-hold-bulge.jpg`). Drag and the bulge follows the finger, handing over to each tile it reaches; near the top of the screen the tile grows below the finger instead. A caption says what the item is, videos autoplay muted, and on lift everything settles back. The enlarged tile is drawn at full size, so images and text stay sharp. Tuning lives in `bulge` in `src/theme/tokens.ts`.
