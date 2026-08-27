#!/usr/bin/env bash
# Tier A Maestro overnight suite — credential-free, iOS sim + Android device.
# Flows align with docs/overnight-optimization-2026-08-27.md §6.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLATFORM="${MAESTRO_PLATFORM:-auto}"
ANDROID_UDID="${ANDROID_UDID:-192.168.1.5:5555}"
LOG="${TMPDIR:-/tmp}/askbible-maestro-overnight.log"

FLOWS=(
  ".maestro/smoke-shell.yaml"
  "scripts/maestro/ios-smoke-routes.yaml"
  "scripts/maestro/ios-tab-bar-home-read.yaml"
  "scripts/maestro/ios-bookmark-double-tap-sync.yaml"
  "scripts/maestro/ios-music-repeat.yaml"
  "scripts/maestro/ios-home-settings-panel-parchment.yaml"
)

detect_platform() {
  if [[ "$PLATFORM" != "auto" ]]; then
    echo "$PLATFORM"
    return
  fi
  if command -v xcrun >/dev/null 2>&1 && xcrun simctl list devices booted 2>/dev/null | grep -q Booted; then
    echo ios
    return
  fi
  if command -v adb >/dev/null 2>&1 && adb devices 2>/dev/null | grep -q $'\tdevice$'; then
    echo android
    return
  fi
  echo "✗ No booted iOS Simulator or Android device." >&2
  exit 1
}

prep_android() {
  adb connect "$ANDROID_UDID" 2>/dev/null || true
  adb -s "$ANDROID_UDID" reverse tcp:8081 tcp:8081 2>/dev/null || true
  adb -s "$ANDROID_UDID" reverse tcp:3450 tcp:3450 2>/dev/null || true
}

run_flow() {
  local platform="$1"
  local flow="$2"
  echo "===== RUN ($platform) $flow =====" | tee -a "$LOG"
  if [[ "$platform" == "ios" ]]; then
    bash "$ROOT/scripts/maestro-smoke.sh" "$ROOT/$flow" 2>&1 | tee -a "$LOG"
  else
    prep_android
    maestro test -p android --udid "$ANDROID_UDID" "$ROOT/$flow" 2>&1 | tee -a "$LOG"
  fi
}

run_suite() {
  local platform="$1"
  local pass=0
  local fail=0
  echo "→ Maestro overnight Tier A ($platform)" | tee "$LOG"
  cd "$ROOT"
  if [[ "$platform" == "android" ]]; then
    prep_android
  fi
  for f in "${FLOWS[@]}"; do
    if run_flow "$platform" "$f"; then
      echo "===== PASS $f =====" | tee -a "$LOG"
      pass=$((pass + 1))
    else
      echo "===== FAIL $f =====" | tee -a "$LOG"
      fail=$((fail + 1))
    fi
    sleep 2
  done
  echo "SUMMARY ($platform) pass=$pass fail=$fail" | tee -a "$LOG"
  [[ "$fail" -eq 0 ]]
}

PLATFORM="$(detect_platform)"

if [[ "$PLATFORM" == "both" ]]; then
  run_suite ios
  run_suite android
else
  run_suite "$PLATFORM"
fi

echo "✓ Maestro overnight Tier A passed ($PLATFORM)"
