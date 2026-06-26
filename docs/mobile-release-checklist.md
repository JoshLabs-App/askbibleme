# AskBible.me Mobile Release Checklist

This checklist is the single source for mobile release operations.
Default release order follows repository rules: iOS first, Android second.

## 0) 构建方式（强制）

**禁止 EAS 云端构建**（`eas build` 不带 `--local`）。原因：月度额度有限、归档体积大、排队不可控。

| 平台 | 唯一默认路径 | 命令 |
|------|----------------|------|
| **iOS** | 本机 **Xcode**（不经 EAS / Expo 远程凭证） | `npm run mobile:build:ios:production` |
| **Android** | 本机 Gradle | `npm run mobile:build:android:production` |

允许保留、但**不要**在常规发版中使用：

- `npm run mobile:build:ios:production:eas` — iOS EAS 云端（已弃用）
- `npm run mobile:build:ios:production:eas-local` — 本机 EAS + Expo 远程凭证（已弃用，易卡在旧 Provisioning Profile）
- `npm run mobile:build:android:production:eas` — Android EAS 云端（已弃用）
- `npm run mobile:build:apk` — 预览 APK 云端（已弃用）

**提交商店**与构建分离：

- iOS：`xcrun altool` + ASC API Key 直传，再跑 TestFlight 分发脚本（**不经** `eas submit`）
- Android：**fastlane supply** 直传 Play（不经 Expo Submit）

真源：`docs/mobile-release-checklist.md`；Agent 规则：`.cursor/rules/mobile-local-build-only.mdc`。

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
  - `ASC_API_KEY_PATH` (iOS 签名 + 上传)
  - `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` (Android submit)

## 2) iOS (TestFlight first)

### 本机 Xcode 打包（默认）

- 前置：完整 Xcode；`ASC_API_KEY_PATH` 指向 `.p8`（用于自动签名与上传；默认会尝试 `AA/AuthKey_9HDA27WY8C.p8`）
- 构建 App Store IPA：
  - `npm run mobile:build:ios:production`
  - 输出：`dist/mobile/askbible-ios-latest.ipa`（带时间戳副本同目录）
- 上传 + 挂 TestFlight 组：
  - `npm run mobile:submit:ios:production`
  - 或指定 IPA：`IOS_IPA_PATH=/path/to/app.ipa npm run mobile:submit:ios:production`
  - 一步构建+上传：`npm run mobile:release:ios:testflight`
  - 仅重新分发已有 build：`npm run mobile:distribute:ios:testflight`（可选 build number，如 `35`）
- 签名说明：
  - 使用本机 **Distribution 证书 + App Store Profile**（脚本 `scripts/ios/ensure-ios-distribution-signing.mjs` 自动创建/安装）
  - 产物缓存在 `apps/askbible-mobile/ios/.local-signing/`（已 gitignore）
  - 首次或证书过期时可单独运行：`npm run mobile:setup:ios:signing`
  - **不依赖** Expo 远程 Provisioning Profile / `eas credentials`
- Bump build number in **native** iOS project before each store upload:
  - 推荐：`npm run mobile:bump:store-version -- 1.0.7 63`（一次同步 `app.json`、Gradle、`Info.plist`、`project.pbxproj`）
  - 手动时须保持一致：
  - `apps/askbible-mobile/ios/AskBibleme/Info.plist` → `CFBundleVersion` / `CFBundleShortVersionString`
  - `apps/askbible-mobile/ios/AskBibleme.xcodeproj/project.pbxproj` → `CURRENT_PROJECT_VERSION` / `MARKETING_VERSION`
  - `app.json` → `expo.version`、`expo.ios.buildNumber`、`expo.android.versionCode`（**iOS 与 Android 使用同一 build 整数**）
- App Store Connect checks:
  - Build processing complete
  - Internal testers can install and open app
  - Core tabs work: Home / Explore / Read / Music

### 已弃用路径（排障时勿默认）

- `npm run mobile:build:ios:production:eas-local` — 本机 EAS，仍走 Expo 凭证
- `npm run mobile:submit:ios:production:eas` — `eas submit`

## 3) Android (Internal Testing)

- One-time upload keystore (historically fetched from EAS credentials → local Gradle):
  - `npm run mobile:setup:android:keystore`
  - Copy `android/keystore.properties.example` → `android/keystore.properties`
- Build production AAB locally (Gradle):
  - `npm run mobile:build:android:production`
- Audit bundled assets (included in build script):
  - `npm run mobile:audit:bundle-size`
- Submit local AAB directly to Google Play (fastlane supply):
  - `npm run mobile:submit:android:internal`
  - Or build + submit in one step: `npm run mobile:release:android:internal`
  - Release script uploads to **internal**, then promotes the same `versionCode` to **alpha** (closed testing) so `/install` → `play.google.com/apps/testing/me.askbible` serves the latest build.
  - Manual promote only: `npm run mobile:promote:android:closed -- 34 alpha`
- Bump store version (iOS buildNumber = Android versionCode):
  - `npm run mobile:bump:store-version -- 1.0.7 63`
  - 或仅递增 build：`npm run mobile:bump:store-version -- --next-build`
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
