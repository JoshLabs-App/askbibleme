#!/usr/bin/env bash
# 从仓库根执行：加载 Android SDK / JDK，若无设备则启动 AVD Expo_API_34，再 expo run:android
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f "apps/selah-mobile/scripts/android-sdk-env.sh" ]]; then
  echo "Missing apps/selah-mobile/scripts/android-sdk-env.sh" >&2
  exit 1
fi
# shellcheck source=/dev/null
source "apps/selah-mobile/scripts/android-sdk-env.sh"

adb start-server >/dev/null 2>&1 || true

has_device() {
  adb devices 2>/dev/null | awk 'NR>1 && $2=="device" { found=1 } END { exit found ? 0 : 1 }'
}

if ! has_device; then
  AVD_NAME="${ANDROID_AVD_NAME:-Expo_API_34}"
  EMU="$ANDROID_HOME/emulator/emulator"
  if [[ ! -x "$EMU" ]]; then
    echo "No Android device/emulator and emulator binary missing at $EMU" >&2
    exit 1
  fi
  echo "Starting AVD: $AVD_NAME …"
  "$EMU" -avd "$AVD_NAME" -no-audio -no-boot-anim -no-metrics >/tmp/selah-android-emulator.log 2>&1 &
  adb wait-for-device
  echo "Waiting for Android boot …"
  for _ in $(seq 1 90); do
    if adb shell getprop sys.boot_completed 2>/dev/null | grep -q 1; then
      break
    fi
    sleep 2
  done
fi

if ! has_device; then
  echo "No Android device connected." >&2
  exit 1
fi

echo "Building & installing native debug app …"
cd "$ROOT/apps/selah-mobile"
exec npx expo run:android "$@"
