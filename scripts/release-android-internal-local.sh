#!/usr/bin/env bash
# 本机打 AAB + 直传 Google Play 内部测试（不经 EAS 构建 / Expo Submit）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

bash "$ROOT/scripts/build-android-aab-local.sh" "$@"

VERSION_CODE="$(node -e "
  const fs = require('fs');
  const gradle = fs.readFileSync('$ROOT/apps/askbible-mobile/android/app/build.gradle','utf8');
  const m = gradle.match(/versionCode\\s+(\\d+)/);
  if (!m) process.exit(1);
  process.stdout.write(m[1]);
")"

bash "$ROOT/scripts/submit-android-aab-play.sh" \
  --path "$ROOT/dist/mobile/askbible-android-latest.aab" \
  --track internal \
  --release-status completed

echo "→ Promote versionCode ${VERSION_CODE} to closed testing (alpha) for /apps/testing link…"
node "$ROOT/scripts/promote-android-play-track.mjs" "$VERSION_CODE" alpha
