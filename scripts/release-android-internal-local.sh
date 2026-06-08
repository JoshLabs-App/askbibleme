#!/usr/bin/env bash
# 本机打 AAB + 直传 Google Play 内部测试（不经 EAS 构建 / Expo Submit）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

bash "$ROOT/scripts/build-android-aab-local.sh" "$@"
bash "$ROOT/scripts/submit-android-aab-play.sh" \
  --path "$ROOT/dist/mobile/askbible-android-latest.aab" \
  --track internal \
  --release-status completed
