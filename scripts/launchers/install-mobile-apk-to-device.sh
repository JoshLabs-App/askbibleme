#!/usr/bin/env bash
# 本机打 Release APK 并 adb 安装到 USB 连接的 Android 真机（无需 Metro）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

# shellcheck source=/dev/null
source "$ROOT/apps/askbible-mobile/scripts/android-sdk-env.sh"
adb start-server >/dev/null 2>&1 || true

SERIAL="$(adb devices 2>/dev/null | awk 'NR>1 && $2=="device" && $1 !~ /^emulator-/ { print $1; exit }')"
if [[ -z "$SERIAL" ]]; then
  echo "✗ 未检测到 Android 真机。请 USB 连接并开启调试。" >&2
  exit 1
fi

echo "→ 打包 Release APK（资源打入安装包，无需 Metro / 本机 API）…"
npm run mobile:build:apk:local

APK="$(ls -t "$ROOT/dist/mobile"/askbible-android-*.apk 2>/dev/null | head -1)"
if [[ -z "$APK" || ! -f "$APK" ]]; then
  echo "✗ 未找到 dist/mobile/*.apk" >&2
  exit 1
fi

echo "→ 安装到 $SERIAL …"
adb -s "$SERIAL" install -r "$APK"

echo ""
echo "✓ 已安装: $APK"
echo "  可拔掉数据线离线使用（经文 / 场景 / 音乐 / 已同步的整章朗读均在 APK 内）"
