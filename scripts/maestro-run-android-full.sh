#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_UDID="${ANDROID_UDID:-192.168.1.5:5555}"
LOG="${TMPDIR:-/tmp}/askbible-maestro-android-full.log"

adb connect "$ANDROID_UDID" 2>/dev/null || true
adb -s "$ANDROID_UDID" reverse tcp:8081 tcp:8081
adb -s "$ANDROID_UDID" reverse tcp:3450 tcp:3450

FLOWS=(
  ".maestro/smoke-shell.yaml"
  "scripts/maestro/ios-smoke-routes.yaml"
  "scripts/maestro/ios-smoke-deep-routes.yaml"
  "scripts/maestro/ios-sync-data-smoke.yaml"
  "scripts/maestro/ios-music-repeat.yaml"
  "scripts/maestro/ios-bookmark-double-tap-sync.yaml"
  "scripts/maestro/ios-read-mat13-play-audio.yaml"
)

: > "$LOG"
PASS=0
FAIL=0

cd "$ROOT"
for f in "${FLOWS[@]}"; do
  echo "===== RUN $f =====" | tee -a "$LOG"
  adb connect "$ANDROID_UDID" 2>/dev/null || true
  if maestro test -p android --udid "$ANDROID_UDID" "$f" 2>&1 | tee -a "$LOG"; then
    echo "===== PASS $f =====" | tee -a "$LOG"
    PASS=$((PASS + 1))
  else
    echo "===== FAIL $f =====" | tee -a "$LOG"
    FAIL=$((FAIL + 1))
  fi
  sleep 2
done

echo "SUMMARY pass=$PASS fail=$FAIL" | tee -a "$LOG"
[[ "$FAIL" -eq 0 ]]
