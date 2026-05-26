#!/usr/bin/env bash
# 从仓库根执行：加载 Android SDK / JDK，若无设备则启动 AVD Expo_API_34，再 expo run:android
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f "apps/askbible-mobile/scripts/android-sdk-env.sh" ]]; then
  echo "Missing apps/askbible-mobile/scripts/android-sdk-env.sh" >&2
  exit 1
fi
# shellcheck source=/dev/null
source "apps/askbible-mobile/scripts/android-sdk-env.sh"
# shellcheck source=/dev/null
source "scripts/launchers/ensure-android-device.sh"

# 勿默认 -no-audio，否则模拟器内读经/音乐/自然声均无声
export ANDROID_EMULATOR_FLAGS="${ANDROID_EMULATOR_FLAGS:--no-boot-anim -no-metrics}"
if ! ensure_android_device_ready; then
  exit 1
fi

echo "Building & installing native debug app …"
cd "$ROOT/apps/askbible-mobile"
exec npx expo run:android "$@"
