# AskBible.me Mobile Release Checklist

This checklist is the single source for mobile release operations.
Default release order follows repository rules: iOS first, Android second.

## 1) Preflight (must pass before build)

- Sync bundled content:
  - `npm run mobile:sync-icons`
  - `npm run mobile:sync-content`
  - `npm run mobile:sync-offline-media`
- Run release preflight:
  - Local static check: `npm run mobile:release:preflight`
  - Render live check: `npm run mobile:release:preflight -- --strict --base-url=https://askbible.me`
- Required production env:
  - `DATA_ROOT` (Render persistent disk mount path)
  - `ASC_API_KEY_PATH` (iOS submit)
  - `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` (Android submit)

## 2) iOS (TestFlight first)

- Build production IPA on EAS:
  - `npm run mobile:build:ios:production`
- Submit latest iOS build:
  - `npm run mobile:submit:ios:production`
- App Store Connect checks:
  - Build processing complete
  - Internal testers can install and open app
  - Core tabs work: Home / Explore / Read / Music

## 3) Android (Internal Testing)

- Build production AAB on EAS:
  - `npm run mobile:build:android:production`
- Submit latest Android build to Play internal track:
  - `npm run mobile:submit:android:production`
- Play Console checks:
  - Internal track rollout created
  - Testers can install and open app
  - Data safety and permissions match manifest behavior

## 4) Store metadata and privacy alignment

- App naming and brand:
  - Display name stays `AskBible.me`
  - Bundle/package stays `me.askbible`
- Required assets:
  - App icon (1024), splash assets, iPhone and Android screenshots
- Privacy/compliance:
  - Telemetry, feedback, and member registration toggles must match store declarations
  - Export compliance predeclared (`ITSAppUsesNonExemptEncryption=false`)

## 5) Final release gate

- `npm run mobile:release:preflight -- --strict --base-url=https://askbible.me`
- iOS TestFlight smoke test completed
- Android Internal smoke test completed
- Release notes prepared for both stores

## 6) Rollback plan

- OTA rollback:
  - Publish previous known-good update to the same channel
- Binary rollback:
  - iOS: stop release in App Store Connect, keep previous live version
  - Android: halt production rollout and revert to previous release
- Backend rollback:
  - Restore previous `DATA_ROOT` data snapshot if a disk data issue is detected
