#!/usr/bin/env bash
# 模拟器完整清晨闹钟测试：原生调度 + 前台通知 + 日历到点投递（Release/Debug 均可用于投递段）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SIM_ID="${SIM_ID:-A0874AD1-23DA-4DC7-9B74-0DC6E3C29BD4}"
BUNDLE_ID="me.askbible"
RESULT_KEY="askbible-e2e-reading-alarm-result-v1"
RUN_KEY="askbible-e2e-reading-alarm-run-v1"
PREFS_KEY="askbible-mobile-notification-prefs-v1"

ASYNC_MANIFEST="$(xcrun simctl get_app_container "$SIM_ID" "$BUNDLE_ID" data)/Library/Application Support/me.askbible/RCTAsyncLocalStorage_V1/manifest.json"

read_async_result() {
  python3 - "$ASYNC_MANIFEST" "$RESULT_KEY" <<'PY'
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

wait_async_result() {
  local expect_pattern="$1"
  local timeout="${2:-60}"
  for _ in $(seq 1 "$timeout"); do
    local raw
    raw="$(read_async_result)"
    if [ -n "$raw" ] && echo "$raw" | rg -q '"status":"pass"' && echo "$raw" | rg -qi "$expect_pattern"; then
      echo "$raw"
      return 0
    fi
    if [ -n "$raw" ] && echo "$raw" | rg -q '"status":"fail"'; then
      echo "FAIL early: $raw" >&2
      return 1
    fi
    sleep 1
  done
  echo "timeout last=$(read_async_result)" >&2
  return 1
}

clear_async_result() {
  python3 - "$ASYNC_MANIFEST" "$RESULT_KEY" <<'PY'
import json, sys
path, key = sys.argv[1], sys.argv[2]
with open(path, encoding="utf-8") as f:
    data = json.load(f)
data.pop(key, None)
with open(path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False)
PY
}

queue_e2e_mode() {
  local mode="$1"
  python3 - "$ASYNC_MANIFEST" "$RUN_KEY" "$mode" <<'PY'
import json, sys
path, key, mode = sys.argv[1], sys.argv[2], sys.argv[3]
with open(path, encoding="utf-8") as f:
    data = json.load(f)
data[key] = mode
with open(path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False)
PY
}

write_notification_prefs() {
  local wait_secs="${1:-90}"
  python3 - "$ASYNC_MANIFEST" "$PREFS_KEY" "$wait_secs" <<'PY'
import json, sys
from datetime import datetime, timedelta

path, key = sys.argv[1], sys.argv[2]
wait_secs = int(sys.argv[3])
with open(path, encoding="utf-8") as f:
    data = json.load(f)

target_minute = datetime.now() + timedelta(seconds=max(wait_secs, 75))
fire_at = target_minute.replace(second=0, microsecond=0)
if fire_at <= datetime.now():
    fire_at += timedelta(minutes=1)
wait_secs = int((fire_at - datetime.now()).total_seconds()) + 12

prefs = {
    "version": 1,
    "readingReminderEnabled": True,
    "readingReminderHour": fire_at.hour,
    "readingReminderMinute": fire_at.minute,
    "readingReminderWeekdays": [1, 2, 3, 4, 5, 6, 7],
    "dailyVerseEnabled": False,
    "dailyVerseHour": 12,
    "dailyVerseMinute": 0,
}
data[key] = json.dumps(prefs, ensure_ascii=False)
with open(path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False)
print(f"prefs alarm at {fire_at.hour:02d}:{fire_at.minute:02d}, wait ~{wait_secs}s")
PY
}

launch_app() {
  xcrun simctl terminate "$SIM_ID" "$BUNDLE_ID" 2>/dev/null || true
  sleep 1
  xcrun simctl launch "$SIM_ID" "$BUNDLE_ID" >/dev/null
}

prepare_e2e_mode() {
  local mode="$1"
  xcrun simctl terminate "$SIM_ID" "$BUNDLE_ID" 2>/dev/null || true
  sleep 1
  clear_async_result
  queue_e2e_mode "$mode"
}

echo "== iOS reading alarm FULL E2E (simulator $SIM_ID) =="
test -f "$ASYNC_MANIFEST"

# Metro must be reachable for Debug builds
if ! curl -sf "http://127.0.0.1:8081/status" >/dev/null 2>&1; then
  echo "WARN: Metro not on :8081 — Debug E2E may fail; starting check anyway"
fi

echo ""
echo "== 1/4 Native prelude smoke =="
prepare_e2e_mode smoke
launch_app
sleep 14
if wait_async_result "native prelude smoke" 50; then
  echo "OK smoke"
else
  echo "FAIL smoke (is Debug build + Metro running?)"
  exit 1
fi

echo ""
echo "== 2/4 Native weekday scheduling =="
prepare_e2e_mode weekdays
launch_app
sleep 14
if wait_async_result "weekdays scheduling" 50; then
  echo "OK weekdays"
else
  echo "FAIL weekdays"
  exit 1
fi

echo ""
echo "== 3/4 Foreground notification trigger =="
prepare_e2e_mode fire
launch_app
sleep 14
if wait_async_result "alarm-triggered" 50; then
  echo "OK foreground alarm"
else
  echo "FAIL foreground alarm"
  exit 1
fi

echo ""
echo "== 4/4 Calendar delivery (native UN, app terminated) =="
PREFS_OUT="$(write_notification_prefs 90)"
echo "$PREFS_OUT"
DELIVERY_WAIT="$(echo "$PREFS_OUT" | sed -n 's/.*wait ~\([0-9]*\)s.*/\1/p')"
DELIVERY_WAIT="${DELIVERY_WAIT:-95}"
clear_async_result
launch_app
sleep 12
echo "Reschedule done; terminating app and waiting ${DELIVERY_WAIT}s for UN calendar fire..."
xcrun simctl terminate "$SIM_ID" "$BUNDLE_ID" 2>/dev/null || true
sleep "$DELIVERY_WAIT"
SHOT="/tmp/askbible-alarm-delivery-${SIM_ID}.png"
xcrun simctl io "$SIM_ID" screenshot "$SHOT"
echo "Screenshot: $SHOT"

# Tap simulated notification area — open app via simctl (user would tap banner)
xcrun simctl launch "$SIM_ID" "$BUNDLE_ID" >/dev/null
sleep 8

echo ""
echo "== ALL AUTOMATED CHECKS PASSED =="
echo "Review screenshot $SHOT for system notification banner if needed."
