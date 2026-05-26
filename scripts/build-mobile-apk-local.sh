#!/usr/bin/env bash
# 本机打出 Android Release APK（侧载分发，无需 EAS 账号）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export EXPO_PUBLIC_MOBILE_BUNDLED_ONLY="${EXPO_PUBLIC_MOBILE_BUNDLED_ONLY:-1}"
export EXPO_PUBLIC_TELEMETRY_DISABLED="${EXPO_PUBLIC_TELEMETRY_DISABLED:-1}"
export MOBILE_BUNDLE_OFFLINE_MEDIA="${MOBILE_BUNDLE_OFFLINE_MEDIA:-1}"
unset EXPO_PUBLIC_ASKBIBLE_BASE_URL

echo "→ Sync mobile bundled content (scripture, locales, icons, offline media, …)"
npm run mobile:sync-content
npm run mobile:sync-icons
npm run mobile:sync-android-icons
npm run mobile:sync-offline-media

if [[ ! -f "apps/askbible-mobile/scripts/android-sdk-env.sh" ]]; then
  echo "Missing apps/askbible-mobile/scripts/android-sdk-env.sh" >&2
  exit 1
fi
# shellcheck source=/dev/null
source "apps/askbible-mobile/scripts/android-sdk-env.sh"

MOBILE="$ROOT/apps/askbible-mobile"
ENV_LOCAL="$MOBILE/.env.local"
ENV_LOCAL_BAK="$MOBILE/.env.local.release-build.bak"
if [[ -f "$ENV_LOCAL" ]]; then
  echo "→ Stashing .env.local (keep LAN dev URL out of release APK)"
  mv "$ENV_LOCAL" "$ENV_LOCAL_BAK"
  trap '[[ -f "$MOBILE/.env.local.release-build.bak" ]] && mv -f "$MOBILE/.env.local.release-build.bak" "$MOBILE/.env.local"' EXIT
fi

cd "$MOBILE/android"

echo "→ Gradle assembleRelease (bundled-only=$EXPO_PUBLIC_MOBILE_BUNDLED_ONLY, no remote content)"
./gradlew assembleRelease

APK="$MOBILE/android/app/build/outputs/apk/release/app-release.apk"
if [[ ! -f "$APK" ]]; then
  echo "APK not found at expected path: $APK" >&2
  exit 1
fi

OUT="$ROOT/dist/mobile"
mkdir -p "$OUT"
STAMP="$(date +%Y%m%d-%H%M)"
DEST="$OUT/askbible-android-${STAMP}.apk"
cp "$APK" "$DEST"

echo ""
echo "Built: $DEST"
echo "Install: adb install -r \"$DEST\""
echo "Or copy the file to the phone and open it (allow unknown sources)."
