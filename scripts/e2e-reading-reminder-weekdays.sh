#!/usr/bin/env bash
set -euo pipefail

PLATFORM="${1:-both}"
SIM_ID="${SIM_ID:-A0874AD1-23DA-4DC7-9B74-0DC6E3C29BD4}"
ANDROID_SERIAL="${ANDROID_SERIAL:-emulator-5554}"
RESULT_KEY="askbible-e2e-reading-alarm-result-v1"
DEV_URL="askbible://dev/reading-alarm?mode=weekdays"

ios_async_manifest() {
  echo "$(xcrun simctl get_app_container "$SIM_ID" me.askbible data)/Library/Application Support/me.askbible/RCTAsyncLocalStorage_V1/manifest.json"
}

read_ios_result() {
  python3 - "$(ios_async_manifest)" "$RESULT_KEY" <<'PY'
import json, sys
path, key = sys.argv[1], sys.argv[2]
with open(path, encoding="utf-8") as f:
    data = json.load(f)
raw = data.get(key)
if not raw:
    print("")
    sys.exit(0)
print(raw)
PY
}

read_android_result() {
  local raw manifest
  manifest="$(adb -s "$ANDROID_SERIAL" shell run-as me.askbible cat files/RCTAsyncLocalStorage_V1/manifest.json 2>/dev/null || true)"
  python3 - "$manifest" "$RESULT_KEY" <<'PY'
import json, sys
raw, key = sys.argv[1], sys.argv[2]
if not raw.strip():
    print("")
    sys.exit(0)
data = json.loads(raw)
value = data.get(key)
if not value:
    print("")
    sys.exit(0)
print(value)
PY
}

clear_ios_result() {
  python3 - "$(ios_async_manifest)" "$RESULT_KEY" <<'PY'
import json, sys
path, key = sys.argv[1], sys.argv[2]
with open(path, encoding="utf-8") as f:
    data = json.load(f)
data.pop(key, None)
with open(path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False)
PY
}

clear_android_result() {
  local manifest next
  manifest="$(adb -s "$ANDROID_SERIAL" shell run-as me.askbible cat files/RCTAsyncLocalStorage_V1/manifest.json 2>/dev/null || true)"
  next="$(python3 - "$manifest" "$RESULT_KEY" <<'PY'
import json, sys
raw, key = sys.argv[1], sys.argv[2]
data = json.loads(raw) if raw.strip() else {}
data.pop(key, None)
print(json.dumps(data, ensure_ascii=False))
PY
)"
  printf '%s' "$next" | adb -s "$ANDROID_SERIAL" shell run-as me.askbible sh -c "mkdir -p files/RCTAsyncLocalStorage_V1 && cat > files/RCTAsyncLocalStorage_V1/manifest.json"
}

wait_for_result() {
  local read_fn="$1"
  local expect_detail="$2"
  local timeout="${3:-90}"
  for _ in $(seq 1 "$timeout"); do
    local raw
    raw="$($read_fn)"
    if [ -n "$raw" ] && echo "$raw" | rg -q "\"status\":\"pass\"" && echo "$raw" | rg -qi "$expect_detail"; then
      echo "$raw"
      return 0
    fi
    if [ -n "$raw" ] && echo "$raw" | rg -q "\"status\":\"fail\""; then
      echo "$raw" >&2
      return 1
    fi
    sleep 1
  done
  echo "last=$($read_fn)" >&2
  return 1
}

run_ios_weekdays() {
  echo "== iOS weekday scheduling ($SIM_ID) =="
  test -f "$(ios_async_manifest)"
  xcrun simctl terminate "$SIM_ID" me.askbible 2>/dev/null || true
  sleep 1
  clear_ios_result
  xcrun simctl launch "$SIM_ID" me.askbible --url "me.askbible://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081" >/dev/null 2>&1 \
    || xcrun simctl launch "$SIM_ID" me.askbible >/dev/null
  sleep 12
  curl -s "http://127.0.0.1:8081/reload" >/dev/null || true
  sleep 2
  xcrun simctl openurl "$SIM_ID" "$DEV_URL"
  if wait_for_result read_ios_result "weekdays scheduling" 90; then
    echo "OK iOS weekdays"
  else
    echo "FAIL iOS weekdays"
    return 1
  fi
}

run_android_weekdays() {
  echo "== Android weekday scheduling ($ANDROID_SERIAL) =="
  adb -s "$ANDROID_SERIAL" shell am force-stop me.askbible 2>/dev/null || true
  sleep 1
  clear_android_result
  adb -s "$ANDROID_SERIAL" shell monkey -p me.askbible -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
  sleep 12
  curl -s "http://127.0.0.1:8081/reload" >/dev/null || true
  sleep 2
  adb -s "$ANDROID_SERIAL" shell am start -a android.intent.action.VIEW -d "$DEV_URL" me.askbible >/dev/null 2>&1
  if wait_for_result read_android_result "weekdays scheduling" 90; then
    echo "OK Android weekdays"
  else
    echo "FAIL Android weekdays"
    return 1
  fi

  echo "== Android native weekdays prefs =="
  adb -s "$ANDROID_SERIAL" shell run-as me.askbible cat shared_prefs/askbible_reading_alarm.xml 2>/dev/null | rg "weekdays" || true
}

case "$PLATFORM" in
  ios) run_ios_weekdays ;;
  android) run_android_weekdays ;;
  both)
    run_ios_weekdays
    run_android_weekdays
    ;;
  *)
    echo "Usage: $0 [ios|android|both]" >&2
    exit 2
    ;;
esac

echo "== ALL WEEKDAY TESTS PASSED =="
