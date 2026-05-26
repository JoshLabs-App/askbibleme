#!/usr/bin/env bash
# 供 launchers / run-mobile-android 共用：若无 adb device，则启动默认 AVD 并等待开机完成。
# 用法: source "$(dirname "$0")/ensure-android-device.sh" && ensure_android_device_ready

_ensure_android_launchers_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
_ensure_android_repo_root="$(cd "$_ensure_android_launchers_dir/../.." && pwd)"

ensure_android_sdk_env() {
  if [[ -z "${ANDROID_HOME:-}" ]]; then
    if [[ ! -f "$_ensure_android_repo_root/apps/askbible-mobile/scripts/android-sdk-env.sh" ]]; then
      echo "✗ 找不到 android-sdk-env.sh" >&2
      return 1
    fi
    # shellcheck source=/dev/null
    source "$_ensure_android_repo_root/apps/askbible-mobile/scripts/android-sdk-env.sh"
  fi
}

has_android_device() {
  adb devices 2>/dev/null | awk 'NR>1 && $2=="device" { found=1 } END { exit found ? 0 : 1 }'
}

has_android_emulator_device() {
  adb devices 2>/dev/null | awk 'NR>1 && $2=="device" && $1 ~ /^emulator-/ { found=1 } END { exit found ? 0 : 1 }'
}

# macOS：把 Android 模拟器窗口提到最前（便于双击 .command 后立刻看到）
raise_android_emulator_window() {
  [[ "$(uname -s)" == "Darwin" ]] || return 0

  open -a "Android Emulator" 2>/dev/null || open -a "Emulator" 2>/dev/null || true

  local attempt focused=""
  for attempt in $(seq 1 12); do
    focused="$(osascript 2>/dev/null <<'APPLESCRIPT' || true
tell application "System Events"
  repeat with procName in {"qemu-system-aarch64", "qemu-system-x86_64", "Android Emulator", "Emulator"}
    if exists process procName then
      tell process procName
        if (count of windows) > 0 then
          perform action "AXRaise" of window 1
        end if
        set frontmost to true
      end tell
      return "ok"
    end if
  end repeat
end tell
return ""
APPLESCRIPT
)"
    if [[ "$focused" == "ok" ]]; then
      return 0
    fi
    sleep 1
  done
  return 0
}

start_android_emulator_avd() {
  local avd_name emu log flags
  avd_name="${ANDROID_AVD_NAME:-Expo_API_34}"
  emu="$ANDROID_HOME/emulator/emulator"
  log="${TMPDIR:-/tmp}/askbible-android-emulator.log"
  flags="${ANDROID_EMULATOR_FLAGS:--no-boot-anim -no-metrics}"
  if [[ "$(uname -s)" == "Darwin" ]] && [[ " $flags " != *" -gpu "* ]]; then
    flags="$flags -gpu host"
  fi

  if [[ ! -x "$emu" ]]; then
    echo "✗ 找不到模拟器程序: $emu" >&2
    echo "  请安装 Android Studio 并配置 SDK。" >&2
    return 1
  fi

  if ! "$emu" -list-avds 2>/dev/null | grep -Fxq "$avd_name"; then
    echo "✗ 未找到 AVD「$avd_name」。当前列表：" >&2
    "$emu" -list-avds 2>/dev/null | sed 's/^/    /' >&2 || true
    echo "  可在 Android Studio 创建同名 AVD，或: export ANDROID_AVD_NAME=你的AVD名" >&2
    return 1
  fi

  echo "→ 正在启动模拟器窗口: $avd_name"
  echo "  首次约需 1–3 分钟，请留意弹出的 Android 模拟器（不要只盯着本终端）。"
  echo "  详细日志: $log"
  # shellcheck disable=SC2086
  "$emu" -avd "$avd_name" $flags >>"$log" 2>&1 &
  disown 2>/dev/null || true

  sleep 2
  raise_android_emulator_window

  echo "→ 等待 adb 连接…"
  if ! adb wait-for-device 2>/dev/null; then
    echo "✗ adb 等待设备超时" >&2
    return 1
  fi

  echo "→ 等待 Android 完成启动（模拟器桌面出现）…"
  local i booted=""
  for i in $(seq 1 90); do
    booted="$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')"
    if [[ "$booted" == "1" ]]; then
      raise_android_emulator_window
      echo "✓ 模拟器已就绪，窗口应已显示"
      return 0
    fi
    if (( i % 5 == 0 )); then
      raise_android_emulator_window
    fi
    sleep 2
  done

  echo "✗ 模拟器启动超时（可查看 $log）" >&2
  return 1
}

# 启动模拟器并等待 adb + sys.boot_completed
# ASKBIBLE_ENSURE_EMULATOR=1 时：若无 emulator-* 在线也会拉起 AVD（便于「重启 App」双击脚本）
ensure_android_device_ready() {
  ensure_android_sdk_env || return 1
  adb start-server >/dev/null 2>&1 || true

  if has_android_emulator_device; then
    raise_android_emulator_window
    return 0
  fi

  if has_android_device && [[ "${ASKBIBLE_ENSURE_EMULATOR:-}" != "1" ]]; then
    return 0
  fi

  if has_android_device && [[ "${ASKBIBLE_ENSURE_EMULATOR:-}" == "1" ]]; then
    echo "→ 当前仅有真机在线；按「重启 App」设置仍为你启动模拟器…"
  fi

  start_android_emulator_avd
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  ensure_android_device_ready
fi
