# Inspo Canvas: project context for a new Claude session

This file is the memory of the build so far. Read it fully before changing anything. It was written on 2026-10-09 from the working session; the code and git history are the source of truth if they disagree with it.

## 1. What this is

**Inspo Canvas** is a cross-platform app (iOS, Android, web) where creative people (designers, content creators, magicians) save inspiration from anywhere and find it again at the right time.

Two problems it solves:
1. **Capture:** getting an inspiration in with almost no friction (Instagram saves, Pinterest, camera-roll screenshots, voice notes and random notes are scattered today).
2. **Retrieval:** finding it again later, fast. **This half is not built.** The owner's original brief was cut off after "Capture, 5. Voice notes (record in-app," so anything about retrieval, detail view and data model beyond what exists is unknown. Ask the owner for the missing part before designing search.

Signature interaction: a free-form spatial canvas of staggered tiles (about 30 visible); **hold a tile and a "balloon" swells out of the canvas** above the finger, magnifying what is under it.

## 2. The owner and how to work with them

- Owner: Santhosh (non-native English speaker; messages are informal and sometimes cut off or voice-transcribed. Confirm interpretation when ambiguous, e.g. "move towards that side" was read as edge auto-scroll).
- Wants short, plain answers, visible progress, and things actually run and screenshotted, not just claimed.
- **GitHub: use ONLY the `00santhosh` account. Never `santhooshh-design`** (the machine's saved global git login). Repo-local git config is set to `00santhosh <97837332+00santhosh@users.noreply.github.com>`, remote `https://00santhosh@github.com/00santhosh/Inspo.git`. Check `git log --format=%an` before pushing. The owner asked for any earlier santhooshh-design commits to be removed (history was rewritten before the first push).
- Only commit/push when asked. Pushing to `main` has been the owner's wish each time (no feature branches now). Commit messages end with the attribution line given in the session's system reminder.
- The owner has no Figma file; do not use the Figma connector.
- The owner is on Windows 11, VS Code. The project path contains parentheses: `C:\Users\SanthoshKumar\Downloads\New folder (4)\inspo-canvas`.

## 3. Stack (versions pinned together; use `npx expo install`)

- Expo SDK 57, React Native 0.86, React 19, TypeScript, Expo Router (routes in `src/app/`), React Native Web
- react-native-gesture-handler + react-native-reanimated 4 (+ worklets)
- **@shopify/react-native-skia 2.6.2**: draws the whole canvas (tiles, dot grid) and runs the balloon shader. react-native-svg for icons and the header gradient.
- expo-image, expo-video, expo-audio, expo-image-picker, expo-image-manipulator, expo-file-system, expo-crypto, expo-haptics, expo-glass-effect
- Supabase (Auth, Postgres, Storage, Edge Function) via `@supabase/supabase-js`
- GitHub + Vercel (web). AGENTS.md in the repo says: prefer docs over memory for Expo APIs (they change each SDK).

## 4. Where everything lives

| Path | What |
|---|---|
| `src/app/_layout.tsx` | Providers (Auth, Toast, Items) and route gating with `Stack.Protected` (signed-out → `sign-in`; demo or signed-in → app) |
| `src/app/index.tsx` | Canvas screen: sky header, filter tabs, canvas, capture dock, loading/empty/error states |
| `src/app/sign-in.tsx` | Sign in / sign up / forgot / recovery in one screen |
| `src/app/add/{note,link,voice}.tsx` | Add screens. Images and videos use the system picker directly. |
| `src/app/item/[id].tsx` | Detail view (+ delete) |
| `src/app/account.tsx` | Account / sign out |
| `src/features/canvas/` | `canvas.tsx` (gestures, balloon logic), `layout.ts` (masonry), `held-caption.tsx`, `use-wheel*.ts` |
| `src/features/skia/` | `skia-tile.tsx` (draws each item type), `shaders.ts` (dot grid + balloon SkSL), `resources.ts` (fonts, image cache) |
| `src/features/capture/` | `pipeline.ts` (upload + save logic), `use-capture.ts`, `blob*.ts`, `video-thumbnail*.ts` |
| `src/data/items.tsx` | Items store: Supabase or demo data, re-signs image URLs, add/remove |
| `src/data/demo.ts` | Demo content (picsum images, Blender open-movie clips) |
| `src/lib/` | `supabase.ts` (+`.web.ts`), `auth.tsx`, `types.ts`, `format.ts`, `confirm.ts` |
| `src/components/` | glass buttons/pills, form, toast, modal shell, icons, sky header/gradient, capture dock, filter tabs |
| `src/theme/tokens.ts` | Colours, radii, shadows, `bulge` and `canvas` constants |
| `supabase/` | `config.toml`, `migrations/20260929000000_items.sql`, `functions/link-preview/` |
| `design/` | `ui-style-reference.png` (colours, glass, shadows), `wireframe-canvas-layout.jpg`, `wireframe-hold-bulge.jpg` |
| `index.tsx`, `index.web.tsx` | Entry points. Web awaits `LoadSkiaWeb({ locateFile: f => '/' + f })` before rendering. |
| `public/canvaskit.wasm` | Skia web runtime (8 MB), copied by `postinstall`, git-ignored |

## 5. Design language

Dark glass, taken from `design/ui-style-reference.png`: deep navy canvas `#090F14`, sky-to-hills gradient header card with rounded bottom corners, frosted glass pills and buttons, saturated blue `#1D75FD` primary action with a glow, filters as text tabs (white active, grey inactive), floating dark-glass bottom dock with the blue "+" in the middle (grid = reset view, search = placeholder). Tile radius 14. The original brief said "clean and light, soft off-white"; the owner then supplied the dark reference and asked to switch.

## 6. The hold interaction: history and current behaviour

The owner iterated this several times. Final design (current):
- Hold a tile (1 s on mobile; on web 0.6 s hover or click-and-hold) → a **balloon**, 75% of the screen width (capped 440 pt), pushes the canvas up from behind, **just above the fingertip**. The finger magnifies at 2.6×, flat across the middle and easing to 1× at the rim, so neighbouring tiles curve and stretch around the rim (see `wireframe-hold-bulge.jpg`). Light on the dome, soft shadow ring.
- It **magnifies exactly what is under the finger** (not snapped to tile centres: the owner complained of a "jump/stick" effect) and glides while dragging.
- **Edge auto-scroll:** while holding, a finger within 72 pt of a canvas edge scrolls the canvas that way (up to 900 pt/s).
- Near the top it flips below the finger. Caption of the held item floats above. Lift to deflate.
- History: circular lens (first brief) → floating bubble above finger → in-place push-and-scale bulge → Skia shader balloon (owner approved moving to Skia; "draw canvas in Skia").
- Constants: `bulge` in `src/theme/tokens.ts`; the effect is `bulge()` in `src/features/skia/shaders.ts`.

**Native vs web (important):** native uses a live Skia `RuntimeShader` image filter over the canvas, so held videos keep playing. CanvasKit (web) has **no runtime-shader image filter**, so on web the tiles are recorded with `drawAsPicture` when the balloon starts and `bulgePictureEffect` draws from that picture, positioned each frame by the live pan offset (so auto-scroll works). Videos don't play inside the balloon on web. Re-recorded when images finish loading.

**Never tested on a real phone.** All interaction testing was in headless Edge with emulated touch (hold 1500 ms, drag, release). Feel (hold time, edge zone, scroll speed) is unverified.

## 7. Features and status

| Stage | Status |
|---|---|
| Canvas: masonry layout, pan, pinch-zoom, wheel/trackpad zoom, reset view, type filters | Built, tested in browser |
| Balloon hold interaction | Built, tested in browser only |
| Stage 1: account (email+password, confirm email, forgot/reset, sign out, "look around with demo content") | Built; UI tested in browser; **never run against real Supabase** |
| Stage 2: add images (≤10 at once, JPEG long edge 2400 + 480 px thumb), videos (≤5, 50 MB cap, thumbnail), links (Edge Function title/desc/picture), notes (≤20,000 chars), voice notes (in-app record, review, ≤10 min) | Built; note/link/voice screens and the "sign in to save" gate tested in browser; **saving never run against real Supabase** |
| Stage 3: browse own items (newest first, ≤500), loading/empty/error, delete from detail, signed URLs refreshed before expiry | Built; **not run against real data** |
| Retrieval: search, tags, date/source filters, similar | **Not built** (DB has a `tsvector` search column and `tags` array ready) |
| Organise: edit, tags, collections, undo delete | Not built |
| Share extension / saving from Instagram, Pinterest, camera roll | Not built; needs a development build, not Expo Go |
| Offline / sync conflicts | Not built |

A full list of use cases and edge cases per stage was written in chat; the highest-value open ones: first-run empty state (done), expiring image links (fixed), item-count scale (all tiles are drawn; needs virtualisation past a few hundred), accessibility of a free-form canvas (no list alternative), web first-load weight (8 MB wasm), duplicate saves.

## 8. Backend: Supabase

- Project URL: `https://owepgrfokixfakpnktpl.supabase.co`. The publishable key is in `.env.local` (git-ignored) and in Vercel as `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Production, Preview, Development). Never commit keys; never ask for or use the service-role/secret keys (the app doesn't need them; Vercel's Supabase integration also added `SUPABASE_*`/`POSTGRES_*` variables, marked sensitive and unreadable).
- **Update 2026-10-11: the `items` table, RLS policies and private `media` bucket were applied through the Supabase MCP (migration `items`).** The `link-preview` function is still not deployed; email confirmation is still unchecked. Advisor: only "leaked password protection disabled" (dashboard setting, Pro plan). Sign-in now opens on sign-up, has a "check your inbox" screen with resend, and the empty canvas has a CTA plus desktop drag-and-drop (`src/components/empty-state.tsx`, `src/features/capture/use-file-drop*.ts`); not yet run in a browser.
- **Older state (2026-10-09): the project was connected but EMPTY.** The `items` table returned 404, the `link-preview` function was not deployed, and email confirmation was still ON. The owner was told to: (1) run `supabase/migrations/20260929000000_items.sql` in the dashboard SQL Editor, (2) switch "Confirm email" off temporarily so a test account can sign up, (3) optionally deploy the function from their own terminal (`npx supabase login`, `link --project-ref owepgrfokixfakpnktpl`, `functions deploy link-preview`). Re-probe before assuming: `curl -s $URL/rest/v1/items?select=id -H "apikey: $KEY"` (404 = table missing).
- The Supabase CLI **cannot log in from Claude's non-TTY shell**, so Claude cannot deploy; the owner must run CLI steps in their terminal (or provide a revocable access token, which they have not).
- Schema: `items` (id, user_id default `auth.uid()`, kind enum image|video|link|note|voice, title, body, storage_path, thumb_path, width, height, duration_ms, url, link_title/description/image_url/site_name, tags[], timestamps, generated `search` tsvector), RLS so users only touch their own rows, private `media` bucket with per-user folders `<user_id>/<item_id>/<file>`; 200 MB bucket limit in SQL but the app caps uploads at 50 MB (Supabase free plan).
- `supabase/config.toml` (apply with `npx supabase config push`): email confirmation ON, 8-char passwords, `site_url` the Vercel URL, redirect URLs for Vercel, localhost:8081, `inspocanvas://**`, `exp://**`; `link-preview` has `verify_jwt = true`.
- `link-preview` Edge Function: fetches title/description/og:image for a URL, blocks private/internal addresses, copies the picture into the caller's storage folder (the canvas can't draw cross-origin images because of CORS), returns `{url,title,description,siteName,thumbPath}`. Optional: links save without it.
- Before real users: turn email confirmation back on, set up custom SMTP (built-in sender is a few emails/hour), add rate limits.

## 9. Deployment

- GitHub: `00santhosh/Inspo`, branch `main`. Work has been pushed straight to `main`.
- Vercel: project `inspo-canvas` under account `santhoosh470-5831` (team `santhosh-7625`), **auto-deploys on push to `main`**. Live site: https://inspo-canvas.vercel.app. `vercel.json` builds `expo export -p web` → `dist`. `.vercel/` and `.env*` are git-ignored.
- **Unpushed local work (as of this file):** the commit "Add sign-in, adding items, and browsing real saved items" (stages 1-3) is committed locally but **not pushed**, on purpose, until it has been tested against the real database. The live site is currently the older build (demo content, no sign-in). Pushing it before the DB exists would show a "database isn't set up" error to visitors.

## 10. Testing approach (nothing lives in the repo)

No test framework exists. Verification so far: `npx tsc --noEmit` and `npx expo lint` must pass (both did at last commit), plus **headless Edge driven over the DevTools protocol** (Node scripts in Claude's scratchpad, not in the repo): emulate a 390×844 phone, dispatch touch/mouse events, screenshot, read console errors. If you need this again, rebuild it: launch `msedge.exe --headless=new --remote-debugging-port=… --user-data-dir=<fresh dir>`, connect with `WebSocket`, `Emulation.setDeviceMetricsOverride`, `Input.dispatchTouchEvent`, `Page.captureScreenshot`. Use a fresh profile dir per run and kill the process tree afterwards. Dev screenshots must wait for the first bundle (restart Metro with `--clear` and warm the bundle with `curl` before testing, or the page is blank). A prepared end-to-end script (sign-up, add all five types, reload, delete, sign out/in) existed but depends on the real Supabase tables and a temporarily disabled email confirmation.

## 11. Gotchas learned the hard way

- **Metro crashes when files are deleted** while running (`ENOENT … .tsx`). After deleting/renaming source files, stop the server and `npx expo start --web --port 8081 --clear`, then warm the bundle.
- **`eslint-plugin-import` cannot resolve the `@/` alias** because the project path contains `(4)` (glob characters). `import/no-unresolved` is turned off for TS in `eslint.config.js`; `tsc` already catches unresolved imports.
- **`supabase/functions/` is excluded from tsc/eslint** (Deno code).
- Skia on web: shaders and `Skia.Path/Matrix` must be created lazily (after `LoadSkiaWeb`), font `require()`s become URL strings so wrap as `{ uri }`, `ImageShader` needs `tx`/`ty`, snapshots must be CPU copies (`makeNonTextureImage()`), large picture tiles get downsampled so rasterise only the visible rect.
- Reanimated/worklets: keep handler state in shared values, not refs (React Compiler lint `react-hooks/refs`); a `useAnimatedReaction` on a shared value didn't fire on web, so React state is updated explicitly via `scheduleOnRN`. Gesture-handler on web: the Hover gesture also fires for touch, so it is filtered to `PointerType.MOUSE`.
- `expo-video`: on web `player.play()` only affects mounted `<video>` elements, so call it in an effect after `VideoView` mounts (not in `useVideoPlayer`'s setup callback). Video thumbnails: `generateThumbnailsAsync` is native-only; web uses a canvas frame (`video-thumbnail.web.ts`).
- React Native 0.86 removed `StyleSheet.absoluteFillObject` (use `absoluteFill`); `pointerEvents` as a prop is deprecated on web (use style).
- Signed storage URLs expire. They're signed for 12 h and re-signed after 6 h or on app focus; the canvas keys cached images and the layout by stable values so a refresh doesn't move the view.
- **Shell:** the Bash tool is Git Bash on Windows. Long inline `node -e`/heredoc scripts with quotes or backslashes break; write scripts with the Write tool and run them. Files can have CRLF endings (core.autocrlf=true); normalise before string-replacing in scripts.
- **Network:** npm installs failed repeatedly while a VPN was on (ECONNRESET); it worked once the VPN was off. Use `--prefer-offline --maxsockets=3` plus long timeouts if it recurs. `npm install` was extremely slow the first time.
- Port 8081: stopping a background job doesn't always stop Expo; find the listener with `Get-NetTCPConnection -LocalPort 8081` and stop it.
- `.env.local` currently also holds a Vercel OIDC token added by `vercel link`; it is git-ignored.
- Windows scratchpad path for temp files is given in the session's environment block; don't put scratch files in the repo.

## 12. Suggested next steps (in order)

1. Confirm with the owner that the Supabase SQL ran and email confirmation is off; re-probe the project; run the real end-to-end flow; fix whatever breaks; then push to `main` (Vercel redeploys). Turn confirmation back on and `config push` afterwards.
2. Owner tests on a real phone (Expo Go or a development build) and reports how hold, drag and edge scroll feel; tune `bulge` constants.
3. Get the missing part of the original brief, then build **retrieval** (search, tags, date/source, similar), the first-class second half of the product.
4. Scale and polish: draw only on-screen tiles, higher-resolution image for the held tile (the balloon is soft at 2.6×), accessibility list view, edit/organise, share extension via a development build.
