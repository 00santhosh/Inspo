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

## Using the app

- **Sign in:** email and password (Supabase Auth). New accounts confirm their email first; "Forgot password?" sends a reset link. Without Supabase keys, or via "Look around with demo content", the app shows sample items and nothing is saved.
- **Add:** the blue + opens the five formats. Images (up to 10 at once; stored as JPEG, long edge 2400px, plus a thumbnail), videos (up to 5 at once, max `MAX_UPLOAD_MB` in `src/features/capture/pipeline.ts`, 50 MB by default to match Supabase's free plan), links (title, description and picture fetched by the `link-preview` Edge Function), text notes (up to 20,000 characters) and voice notes (recorded in the app, up to 10 minutes).
- **Browse:** your items load newest-first (up to 500) onto the canvas. Image links are signed and refreshed automatically before they expire. Delete an item from its detail screen.

## Supabase

1. Create a project, then copy `.env.example` to `.env.local` and fill in the project URL and publishable key (Project Settings > API). Set the same two variables in Vercel for the web build.
2. Link and apply everything in this repo:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db push                          # items table, row-level security, private media bucket
   npx supabase config push                      # sign-in settings and redirect URLs from supabase/config.toml
   npx supabase functions deploy link-preview    # link previews
   ```
3. `supabase/config.toml` turns on email confirmation, requires 8-character passwords, and allows email links to return to the Vercel site, localhost:8081 and the app's `inspocanvas://` scheme. Add your own domain there if it differs.
4. Email links on a phone need a development build (or the `exp://` scheme in Expo Go); on web they work as-is.

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

Hold a tile for 1s on mobile, or rest the pointer for 600ms (or click and hold) on web. A balloon, 75% of the screen width, pushes the canvas up from behind just above the fingertip: whatever is under the finger swells at its centre and the neighbouring images curve and stretch around its rim, with light on the dome and a soft shadow around it (see `design/wireframe-hold-bulge.jpg`). Drag and the balloon glides with the finger, magnifying exactly what is under it; drag towards an edge and the canvas scrolls that way. Near the top it sits below the finger instead. On lift it deflates. Tuning lives in `bulge` in `src/theme/tokens.ts`; the effect itself is in `src/features/skia/shaders.ts`.

On iOS and Android the balloon is a live image filter, so a held video keeps playing inside it. Skia's web build has no runtime-shader image filter, so on web the canvas is recorded as a picture when the balloon starts and the balloon shader draws from that picture, positioned by the live scroll offset; videos don't play inside the balloon there.
