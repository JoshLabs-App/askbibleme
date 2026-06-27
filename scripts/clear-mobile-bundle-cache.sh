#!/usr/bin/env bash
# Release 打包前清除 Metro / Expo 缓存，避免旧 JS 打进 IPA/APK。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE="$ROOT/apps/askbible-mobile"

echo "→ 清除 Metro / Expo 打包缓存…"
rm -rf \
  "$MOBILE/node_modules/.cache" \
  "$MOBILE/.expo" \
  2>/dev/null || true
