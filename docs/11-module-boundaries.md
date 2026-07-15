# Module Boundaries（模块边界草图）

This note is a working map for keeping AskBible.me modular without turning it into a maze.
The goal is not "many apps", but a modular monolith with clear seams.

## 1. What We Want

- A change in one feature area should usually stay inside that area.
- Cross-feature access should happen through a small public API, not deep imports.
- Shared code should stay boring: pure helpers, theme tokens, routing primitives, storage, i18n, telemetry.
- Side effects should be rare and obvious.

## 2. Current Top-Level Areas

### Directory-Level Map

This is the first pass when placing a folder:

- `apps/askbible-mobile/src/auth` -> Auth
- `apps/askbible-mobile/src/read` -> Read
- `apps/askbible-mobile/src/music` -> Music
- `apps/askbible-mobile/src/explore` -> Explore
- `apps/askbible-mobile/src/onboarding` -> Onboarding / First Open
- `apps/askbible-mobile/src/notifications` -> Notifications
- `apps/askbible-mobile/src/telemetry` -> Telemetry
- `apps/askbible-mobile/src/shell` -> App Shell
- `apps/askbible-mobile/src/i18n` -> Shared Core
- `apps/askbible-mobile/src/config` -> Shared Core
- `apps/askbible-mobile/src/network` -> Shared Core
- `apps/askbible-mobile/src/ui` -> Shared Core
- `apps/askbible-mobile/src/api` -> Shared Core or feature-specific API wrapper
- `components/app-shell` -> App Shell
- `components/auth` -> Auth
- `components/scripture` -> Read
- `components/verse` -> Read
- `components/music` -> Music
- `components/media` -> Music / shell coordination
- `components/explore` -> Explore
- `components/legacy` -> Explore
- `components/onboarding` -> Onboarding / First Open
- `components/telemetry` -> Telemetry
- `components/pwa` -> PWA / Web Shell
- `components/content-correction` -> Cross-cutting feedback
- `components/feedback` -> Cross-cutting feedback
- `components/theme` -> Shared Core
- `components/i18n` -> Shared Core
- `lib/auth` -> Auth
- `lib/scripture` -> Read
- `lib/home-prayer-pools` -> Read / Explore shared content pools
- `lib/music-companion` -> Music
- `lib/media` -> Music / shell coordination
- `lib/explore` -> Explore
- `lib/figures` -> Explore
- `lib/legacy-figure-*` -> Explore
- `lib/onboarding` -> Onboarding / First Open
- `lib/notifications` -> Notifications
- `lib/pwa` -> PWA / Web Shell
- `lib/telemetry` -> Telemetry
- `lib/studio*` -> Studio / product brain support

### App Shell

Owns navigation composition, global providers, and the outer frame of the app.

- `apps/askbible-mobile/app/_layout.tsx`
- `apps/askbible-mobile/app/(tabs)/_layout.tsx`
- `components/app-shell/*`
- `components/theme/*`
- `components/i18n/*`
- `components/telemetry/*`

### Auth

Owns sign-in, sign-up, session, OAuth, and account state.

- `apps/askbible-mobile/src/auth/*`
- `apps/askbible-mobile/app/login.tsx`
- `apps/askbible-mobile/app/register.tsx`
- `lib/askbible-supabase-auth.ts`
- `lib/mobile-oauth-id-token-sign-in.ts`
- `lib/mobile-auth-session.ts`
- `lib/google-oauth-config.ts`
- `lib/oauth-brand-icon-paths.ts`

#### Auth Internal Layers

The auth area is already split enough to be treated as a mini-domain:

- UI surfaces: `MemberLoginScreen`, `MemberRegisterScreen`, `AuthParchmentScreen`, social sign-in buttons, OAuth brand icons.
- Orchestration: `useMemberAuthProvider`, `MemberAuthProvider`, `useMemberAuthBootstrap`, `memberAuthActions`.
- Session state: `memberSession`, `memberAuthSessionCommit`, `syncMemberProfileFromServer`.
- OAuth transport: `googleOAuthBrowser`, `googleOAuthSession`, `googleOAuthExchange`, `googleOAuthPending`, `googleOAuthLinking`, `googleOAuthDeepLink`, `googleOAuthCallback`.
- Native fallbacks: `googleSignIn`, `googleSignInNativeImpl`, `appleSignIn`, `appleSignInExchange`, `googleNativeAuthReady`.
- Error shaping and config: `resolveMemberOAuthError`, `googleAuthAvailability`, `member-register-enabled`.

#### Auth Files That Should Stay Small

These files should remain narrow and boring, because they influence many other parts of the app:

- `apps/askbible-mobile/src/auth/useMemberAuthProvider.ts`
- `apps/askbible-mobile/src/auth/googleOAuthSession.ts`
- `apps/askbible-mobile/src/auth/googleOAuthBrowser.ts`
- `apps/askbible-mobile/src/auth/googleOAuthCallback.ts`
- `apps/askbible-mobile/src/auth/webCryptoPolyfill.ts`
- `apps/askbible-mobile/src/auth/memberSession.ts`
- `apps/askbible-mobile/src/auth/memberAuthSessionCommit.ts`
- `apps/askbible-mobile/src/auth/useMemberAuthGoogleDeepLink.ts`
- `apps/askbible-mobile/src/auth/googleOAuthExchange.ts`
- `apps/askbible-mobile/src/auth/appleSignIn.ts`
- `apps/askbible-mobile/src/auth/appleSignInExchange.ts`
- `apps/askbible-mobile/src/auth/memberAuthActions.ts`

### Read

Owns Scripture reading, chapter navigation, plans, bookmarks, audio reading, and reading UI.

- `apps/askbible-mobile/src/read/*`
- `apps/askbible-mobile/app/(tabs)/read/*`
- `components/scripture/*`
- `components/verse/*`
- `lib/scripture/*`
- `lib/daily-verse/*`
- `lib/home-prayer-pools/*`

#### Read Internal Layers

- Display model: `useReadChapterScreenDisplay`, `readChapterDisplayText`, `readUiLocale`, `readChapterScreenSegmentMeta`.
- Navigation model: `useReadChapterScreenNav`, `readChapterNavModel`, `read-chapter-nav`, `read-plan-flow-nav`.
- Screen orchestration: `ReadChapterScreen`, `ReadChapterScreenBody`, `ReadChapterScreenScrollContent`.
- Audio and progress: `useReadChapterAudio`, `useReadChapterScreenProgress`, `readChapterProgressModel`, `useReadChapterSearchFocus`, `readChapterSearchFocusModel`.
- Load model and data fetching: `useReadChapterScreenLoad`, `useReadChapterScreenLoadEffects`, `readChapterLoadLifecycleModel`, `readChapterLoadModel`, `loadReadChapterScreenChapter`, `useReadChapterScreenDeferredLoads`, `readChapterDeferredLoadModel`.
- Content and state helpers: `canonCatalog`, `readChapterScreenConstants`, `useScriptureVerseBookmarks`, `useTodayReadingPlan`.

### Music

Owns playback, queues, tracks, companion metadata, and shell playback coordination.

- `apps/askbible-mobile/src/music/*`
- `components/music/*`
- `components/media/*`
- `lib/music-companion/*`
- `lib/media/*`

#### Music Internal Layers

- Playback orchestration: `useMusicPlaybackProvider`, `useMusicPlaybackProviderEffects`, `useMusicPlaybackShellWiring`.
- Playback state model: `musicPlaybackContextValueBuild`, `musicPlaybackContextTypes`, `musicPlaybackAvailability`, `musicPlaybackControlSnapshot`.
- Playback flows: `scriptureTogglePlayback`, `musicTrackPlayback`, `musicTrackPlayPrepare`, `scripturePlanFlowHandoff`.
- Resource and queue helpers: `musicTrackSoundLoad`, `musicTrackSoundCreate`, `musicPlaybackContextValueBuild`, `scripturePlaybackTypes`.

### Explore

Owns article-style discovery, historical figures, creeds, and year/day content.

- `apps/askbible-mobile/src/explore/*`
- `apps/askbible-mobile/app/(tabs)/explore/*`
- `components/explore/*`
- `components/legacy/*`
- `lib/explore/*`
- `lib/figures/*`
- `lib/legacy-figure-*`
- `lib/read-legacy-figures-timeline.ts`

### Onboarding / First Open

Owns first-run prompts and gentle intro flows.

- `apps/askbible-mobile/src/onboarding/*`
- `components/onboarding/*`
- `lib/onboarding/*`

### Notifications

Owns reminders, alarm flows, and notification scheduling.

- `apps/askbible-mobile/src/notifications/*`
- `lib/notifications/*`

### PWA / Web Shell

Owns web install experience, offline caching, and browser-specific behavior.

- `components/pwa/*`
- `lib/pwa/*`
- `components/app-shell/Pwa*`

### Telemetry

Owns event names, ingestion, rollups, rate limiting, and client glue.

- `components/telemetry/*`
- `lib/telemetry/*`

### Content Correction / Feedback

Owns user feedback entry points that attach to multiple feature areas.

- `components/content-correction/*`
- `apps/askbible-mobile/src/content-correction/*`
- `components/feedback/*`
- `apps/askbible-mobile/app/feedback.tsx`

## 3. Shared Core

These should stay generic and stable. If a file starts talking too much about one feature, it probably belongs in that feature area instead.

- `lib/i18n/*`
- `apps/askbible-mobile/src/i18n/*`
- `lib/site-branding-colors.ts`
- `lib/app-user-skin.ts`
- `lib/app-install-urls.ts`
- `lib/dom/*`
- `lib/disk-auth-headers.ts`
- `lib/telemetry/*`
- `apps/askbible-mobile/src/config/*`
- `apps/askbible-mobile/src/network/*`
- `apps/askbible-mobile/src/ui/*`
- `components/theme/*`
- `components/i18n/*`
- `lib/studio-*`

## 4. Candidate Shared Boundaries

These folders are not features by themselves, but they often become shared seams.

- `apps/askbible-mobile/src/api/*`
- `apps/askbible-mobile/src/fonts/*`
- `apps/askbible-mobile/src/types/*`
- `components/ui/*`
- `lib/http/*`
- `lib/member-reading-sync/*`
- `lib/widget/*`
- `lib/supabase/*`
- `lib/bible/*`

Rule: if a folder keeps collecting exceptions from many areas, promote its stable helpers into shared core and move area-specific behavior back out.

## 5. High-Risk Shared Chokepoints

These files can affect multiple areas at once, so they deserve extra caution.

- `apps/askbible-mobile/app/_layout.tsx`
- `apps/askbible-mobile/app/(tabs)/_layout.tsx`
- `apps/askbible-mobile/src/auth/webCryptoPolyfill.ts`
- `apps/askbible-mobile/src/auth/useMemberAuthProvider.ts`
- `components/app-shell/AppShellTopBar.tsx`
- `components/app-shell/AppShellFixedChrome.tsx`
- `components/media/MediaPlaybackCoordinatorProvider.tsx`
- `lib/telemetry/client.ts`

## 6. Dependency Rules

1. Feature areas may import from `shared`.
2. Feature areas should not import each other’s internals.
3. Shared code should not know feature-specific implementation details.
4. Side effects should live in providers, bootstrap modules, or explicit setup functions.
5. Deep imports across areas should be a red flag.

## 7. Practical Refactor Order

If we want to make the app more isolated over time, the safest order is:

1. Tighten `auth`.
2. Make `read`, `music`, and `explore` more self-contained.
3. Move reusable primitives into `shared`.
4. Add a small smoke test for each high-risk boundary.

## 8. Useful Rule of Thumb

If a module answers the question "what should the app do?" for more than one feature area, it is probably too central.
If it answers "how do we show / store / format / measure this?", it is a better shared candidate.

## 9. Good Next Split

If we want the next concrete step, the best candidates are:

1. `auth`: split public API, session state, and transport/browser/native pieces.
2. `read`: split chapter screen, plan flow, audio, search, and catalog concerns.
3. `music`: split playback engine, UI, queue/store, and resource-pack sync.
4. `explore`: split article rendering, figure profiles, and curated content feeds.

## 10. Auth Boundary Proposal

If we were to tighten auth first, I would aim for these internal seams:

- `auth/ui`: screens and buttons only.
- `auth/core`: provider, session commit, bootstrap, state read/write.
- `auth/oauth`: browser flow, callback parsing, deep-link capture, pending waits.
- `auth/native`: Apple and native Google entry points.
- `auth/shared`: error mapping and capability detection.

That would let a change in OAuth transport stay out of UI, and a UI tweak stay out of callback/session code.
