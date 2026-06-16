#!/usr/bin/env bash
# 本机 Xcode 打 IPA + 直传 App Store Connect / TestFlight（不经 EAS 构建 / Expo Submit）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

bash "$ROOT/scripts/build-ios-ipa-xcode-local.sh" "$@"

bash "$ROOT/scripts/submit-ios-ipa-appstore.sh" \
  --path "$ROOT/dist/mobile/askbible-ios-latest.ipa"
