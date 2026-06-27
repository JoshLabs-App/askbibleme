#!/usr/bin/env bash
# 本机 Xcode 打出 App Store 用 Release IPA（不经 EAS 构建 / Expo 远程凭证）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/mobile-load-google-oauth-env.sh
source "$ROOT/scripts/mobile-load-google-oauth-env.sh"
load_mobile_google_oauth_env "$ROOT"

MOBILE="$ROOT/apps/askbible-mobile"
IOS="$MOBILE/ios"

if [[ -d "$IOS/AskBible.me.xcworkspace" ]]; then
  WORKSPACE="$IOS/AskBible.me.xcworkspace"
  SCHEME="AskBible.me"
  APP_PLIST="$IOS/AskBible.me/Info.plist"
  ARCHIVE="$IOS/build/AskBible.me.xcarchive"
elif [[ -d "$IOS/AskBibleme.xcworkspace" ]]; then
  WORKSPACE="$IOS/AskBibleme.xcworkspace"
  SCHEME="AskBibleme"
  APP_PLIST="$IOS/AskBibleme/Info.plist"
  ARCHIVE="$IOS/build/AskBibleme.xcarchive"
else
  echo "缺少 Xcode workspace（AskBible.me 或 AskBibleme）。请先 cd apps/askbible-mobile/ios && pod install" >&2
  exit 1
fi

EXPORT_DIR="$IOS/build/export"
EXPORT_PLIST="$ROOT/scripts/ios/ExportOptions-appstore.plist"

export EXPO_PUBLIC_MOBILE_OFFLINE_FIRST="${EXPO_PUBLIC_MOBILE_OFFLINE_FIRST:-1}"
export EXPO_PUBLIC_MOBILE_BUNDLED_ONLY="${EXPO_PUBLIC_MOBILE_BUNDLED_ONLY:-0}"
export EXPO_PUBLIC_MEMBER_REGISTER_ENABLED="${EXPO_PUBLIC_MEMBER_REGISTER_ENABLED:-1}"
export EXPO_PUBLIC_ASKBIBLE_BASE_URL="${EXPO_PUBLIC_ASKBIBLE_BASE_URL:-https://askbible.me}"
export EXPO_PUBLIC_MEMBER_SYNC_DEBUG="${EXPO_PUBLIC_MEMBER_SYNC_DEBUG:-1}"
export MOBILE_BUNDLE_OFFLINE_MEDIA="${MOBILE_BUNDLE_OFFLINE_MEDIA:-1}"
export MOBILE_BUNDLE_MUSIC_LIMIT="${MOBILE_BUNDLE_MUSIC_LIMIT:-1}"
export MOBILE_STARTER_MUSIC_TRACK_ID="${MOBILE_STARTER_MUSIC_TRACK_ID:-track-mpg4a8h3jhwl}"

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "未检测到 Xcode。请先安装完整 Xcode。" >&2
  exit 1
fi

if [[ ! -d "$WORKSPACE" ]]; then
  echo "缺少 Xcode workspace：$WORKSPACE" >&2
  exit 1
fi

if [[ -z "${ASC_API_KEY_PATH:-}" ]]; then
  DEFAULT_ASC_KEY="$ROOT/AA/AuthKey_9HDA27WY8C.p8"
  if [[ -f "$DEFAULT_ASC_KEY" ]]; then
    export ASC_API_KEY_PATH="$DEFAULT_ASC_KEY"
  fi
fi

ASC_API_KEY_ID="${EXPO_ASC_KEY_ID:-${ASC_API_KEY_ID:-9HDA27WY8C}}"
ASC_API_KEY_ISSUER_ID="${EXPO_ASC_ISSUER_ID:-${ASC_API_KEY_ISSUER_ID:-a56f0624-e4a4-438d-be5d-92403dd9969b}}"

XCODE_AUTH_ARGS=()
if [[ -n "${ASC_API_KEY_PATH:-}" && -f "${ASC_API_KEY_PATH}" ]]; then
  ASC_API_KEY_PATH="$(cd "$(dirname "${ASC_API_KEY_PATH}")" && pwd)/$(basename "${ASC_API_KEY_PATH}")"
  export ASC_API_KEY_PATH
  XCODE_AUTH_ARGS=(
    -allowProvisioningUpdates
    -authenticationKeyPath "${ASC_API_KEY_PATH}"
    -authenticationKeyID "${ASC_API_KEY_ID}"
    -authenticationKeyIssuerID "${ASC_API_KEY_ISSUER_ID}"
  )
else
  echo ""
  echo "提示：未设置 ASC_API_KEY_PATH。将依赖 Xcode「Accounts」里已登录的 Apple ID 自动签名。"
  echo "建议导出：export ASC_API_KEY_PATH=/absolute/path/AuthKey_xxx.p8"
  echo ""
  XCODE_AUTH_ARGS=(-allowProvisioningUpdates)
fi

echo "→ 同步图标与离线内容…"
bash "$ROOT/scripts/clear-mobile-bundle-cache.sh"
npm run mobile:sync-icons
npm run mobile:sync-content
node scripts/sync-explore-featured-articles-localized.mjs
MOBILE_BUNDLE_OFFLINE_MEDIA=1 \
MOBILE_BUNDLE_MUSIC_LIMIT=1 \
MOBILE_STARTER_MUSIC_TRACK_ID=track-mpg4a8h3jhwl \
npm run mobile:sync-offline-media

echo "→ 离线资源体积审计…"
npm run mobile:audit:bundle-size

ENV_LOCAL="$MOBILE/.env.local"
ENV_LOCAL_BAK="$MOBILE/.env.local.release-build.bak"
if [[ -f "$ENV_LOCAL" ]]; then
  echo "→ 暂存 .env.local（避免 LAN 开发地址打进 release）"
  mv "$ENV_LOCAL" "$ENV_LOCAL_BAK"
  trap '[[ -f "$MOBILE/.env.local.release-build.bak" ]] && mv -f "$MOBILE/.env.local.release-build.bak" "$MOBILE/.env.local"' EXIT
fi

XCODE_ENV_LOCAL="$IOS/.xcode.env.local"
XCODE_ENV_LOCAL_BAK="$IOS/.xcode.env.local.release-build.bak"
if [[ -f "$XCODE_ENV_LOCAL" ]]; then
  echo "→ 暂存 ios/.xcode.env.local（避免 Metro LAN 地址影响 release bundle）"
  mv "$XCODE_ENV_LOCAL" "$XCODE_ENV_LOCAL_BAK"
  trap '[[ -f "$IOS/.xcode.env.local.release-build.bak" ]] && mv -f "$IOS/.xcode.env.local.release-build.bak" "$IOS/.xcode.env.local"' EXIT
fi

rm -rf "$ARCHIVE" "$EXPORT_DIR"
mkdir -p "$IOS/build"

echo ""
echo "→ 准备 App Groups 能力与签名…"
node "$ROOT/scripts/ios/enable-ios-app-group-capabilities.mjs"
EXPORT_PLIST="$IOS/build/ExportOptions-appstore-export.plist"
HAS_WIDGET=0
if grep -q "Embed Foundation Extensions" "$IOS/AskBibleme.xcodeproj/project.pbxproj" 2>/dev/null; then
  HAS_WIDGET=1
fi

if [[ "$HAS_WIDGET" == "1" ]]; then
  echo "→ 检测到 Widget Extension，使用 manual signing + App Store profiles…"
  FORCE_IOS_SIGNING_REFRESH="${FORCE_IOS_SIGNING_REFRESH:-1}" node "$ROOT/scripts/ios/ensure-ios-distribution-signing.mjs"
  node "$ROOT/scripts/ios/patch-ios-manual-signing.mjs"
  SIGNING_MANIFEST="$IOS/.local-signing/manifest.json"
  PROFILE_NAME="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$SIGNING_MANIFEST','utf8')).profileName)")"
  WIDGET_PROFILE_NAME="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$SIGNING_MANIFEST','utf8')).widgetProfileName || '')")"
  cat > "$EXPORT_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>method</key>
	<string>app-store-connect</string>
	<key>teamID</key>
	<string>AJ2998VZH6</string>
	<key>signingStyle</key>
	<string>manual</string>
	<key>uploadSymbols</key>
	<true/>
	<key>provisioningProfiles</key>
	<dict>
		<key>me.askbible</key>
		<string>${PROFILE_NAME}</string>
		<key>me.askbible.widget</key>
		<string>${WIDGET_PROFILE_NAME}</string>
	</dict>
</dict>
</plist>
PLIST
else
  FORCE_IOS_SIGNING_REFRESH=1 node "$ROOT/scripts/ios/ensure-ios-distribution-signing.mjs"
  node "$ROOT/scripts/ios/patch-ios-manual-signing.mjs"
  SIGNING_MANIFEST="$IOS/.local-signing/manifest.json"
  if [[ ! -f "$SIGNING_MANIFEST" ]]; then
    echo "缺少签名 manifest：$SIGNING_MANIFEST" >&2
    exit 1
  fi
  PROFILE_NAME="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$SIGNING_MANIFEST','utf8')).profileName)")"
  echo "→ 导出 IPA 使用 manual signing（主 App Profile）…"
  cat > "$EXPORT_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>method</key>
	<string>app-store-connect</string>
	<key>teamID</key>
	<string>AJ2998VZH6</string>
	<key>signingStyle</key>
	<string>manual</string>
	<key>uploadSymbols</key>
	<true/>
	<key>provisioningProfiles</key>
	<dict>
		<key>me.askbible</key>
		<string>${PROFILE_NAME}</string>
	</dict>
</dict>
</plist>
PLIST
fi

echo ""
echo "→ Xcode archive（scheme=${SCHEME}，team=AJ2998VZH6）…"
if [[ "$HAS_WIDGET" == "1" ]]; then
  xcodebuild \
    -workspace "$WORKSPACE" \
    -scheme "$SCHEME" \
    -configuration Release \
    -destination "generic/platform=iOS" \
    -archivePath "$ARCHIVE" \
    archive \
    CODE_SIGN_STYLE=Manual \
    DEVELOPMENT_TEAM=AJ2998VZH6 \
    CODE_SIGN_IDENTITY="Apple Distribution" \
    "${XCODE_AUTH_ARGS[@]}" \
    "$@"
else
  xcodebuild \
    -workspace "$WORKSPACE" \
    -scheme "$SCHEME" \
    -configuration Release \
    -destination "generic/platform=iOS" \
    -archivePath "$ARCHIVE" \
    archive \
    CODE_SIGN_STYLE=Manual \
    DEVELOPMENT_TEAM=AJ2998VZH6 \
    CODE_SIGN_IDENTITY="Apple Distribution" \
    "${XCODE_AUTH_ARGS[@]}" \
    "$@"
fi

echo ""
echo "→ 导出 App Store IPA（manual signing）…"
xcodebuild \
  -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportPath "$EXPORT_DIR" \
  -exportOptionsPlist "$EXPORT_PLIST"

IPA_SRC="$(find "$EXPORT_DIR" -maxdepth 1 -name '*.ipa' | head -1)"
if [[ -z "$IPA_SRC" || ! -f "$IPA_SRC" ]]; then
  echo "未找到导出的 IPA：$EXPORT_DIR" >&2
  exit 1
fi

BUILD_NUMBER="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$APP_PLIST" 2>/dev/null || echo unknown)"
OUT="$ROOT/dist/mobile"
mkdir -p "$OUT"
STAMP="$(date +%Y%m%d-%H%M)"
DEST="$OUT/askbible-ios-v${BUILD_NUMBER}-${STAMP}.ipa"
LATEST="$OUT/askbible-ios-latest.ipa"
cp "$IPA_SRC" "$DEST"
cp "$IPA_SRC" "$LATEST"

echo ""
echo "Built IPA: $DEST"
echo "Latest copy: $LATEST"
echo ""
echo "直传 App Store Connect / TestFlight（不经 Expo）："
echo "  npm run mobile:submit:ios:production"
echo "或一步构建+上传："
echo "  npm run mobile:release:ios:testflight"
