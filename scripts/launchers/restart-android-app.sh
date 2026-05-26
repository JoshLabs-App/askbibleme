#!/usr/bin/env bash
# 强制重启已安装的 AskBible.me Android App（模拟器或真机，优先模拟器）
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PKG="me.askbible"
ACTIVITY="${PKG}/.MainActivity"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  AskBible.me · Android 重启 App"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [[ ! -f "$ROOT/apps/askbible-mobile/scripts/android-sdk-env.sh" ]]; then
  echo "✗ 找不到 android-sdk-env.sh" >&2
  exit 1
fi
# shellcheck source=/dev/null
source "$ROOT/apps/askbible-mobile/scripts/android-sdk-env.sh"
# shellcheck source=/dev/null
source "$ROOT/scripts/launchers/ensure-android-device.sh"

# 双击「重启」：无模拟器时自动拉起 AVD，并把窗口提到最前
export ASKBIBLE_ENSURE_EMULATOR=1
export ANDROID_EMULATOR_FLAGS="${ANDROID_EMULATOR_FLAGS:--gpu host -no-metrics}"

if ! ensure_android_device_ready; then
  exit 1
fi

pick_device_serial() {
  local serial
  serial="$(adb devices 2>/dev/null | awk 'NR>1 && $2=="device" && $1 ~ /^emulator-/ { print $1; exit }')"
  if [[ -n "$serial" ]]; then
    echo "$serial"
    return 0
  fi
  adb devices 2>/dev/null | awk 'NR>1 && $2=="device" { print $1; exit }'
}

SERIAL="$(pick_device_serial || true)"
if [[ -z "$SERIAL" ]]; then
  echo "✗ 仍无可用设备（adb 未列出 device 状态）。" >&2
  echo "  检查: adb devices" >&2
  exit 1
fi

ADB=(adb -s "$SERIAL")
echo "→ 设备: $SERIAL"
echo "→ 停止: $PKG"
"${ADB[@]}" shell am force-stop "$PKG" >/dev/null
sleep 0.4
echo "→ 启动: $ACTIVITY"
if ! "${ADB[@]}" shell am start -n "$ACTIVITY" -a android.intent.action.MAIN -c android.intent.category.LAUNCHER >/dev/null; then
  echo "✗ 启动失败。若尚未安装，请先运行「4-手机开发-iOS」旁的 Android 开发脚本或: npm run mobile:android" >&2
  exit 1
fi

if curl -sf -m 1 "http://127.0.0.1:8081/status" >/dev/null 2>&1; then
  echo "→ Metro 在运行；App 启动后会自动拉取最新 JS"
else
  echo "→ 提示: Metro 未在 8081 运行；仅重启原生壳。要热更新请先开「5-手机开发-仅Metro」"
fi

if [[ "$SERIAL" == emulator-* ]]; then
  raise_android_emulator_window
  echo "→ 模拟器窗口已置前；若被其它窗口挡住，请用 Mission Control 查看"
fi

echo ""
echo "✓ 已重启"
