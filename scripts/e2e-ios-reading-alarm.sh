#!/usr/bin/env bash
set -euo pipefail

SIM_ID="${SIM_ID:-A0874AD1-23DA-4DC7-9B74-0DC6E3C29BD4}"
ASYNC_MANIFEST="$(xcrun simctl get_app_container "$SIM_ID" me.askbible data)/Library/Application Support/me.askbible/RCTAsyncLocalStorage_V1/manifest.json"
RESULT_KEY="askbible-e2e-reading-alarm-result-v1"

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
  local expect_detail="$1"
  local timeout="${2:-45}"
  for _ in $(seq 1 "$timeout"); do
    local raw
    raw="$(read_async_result)"
    if [ -n "$raw" ] && echo "$raw" | rg -q "\"status\":\"pass\"" && echo "$raw" | rg -qi "$expect_detail"; then
      echo "$raw"
      return 0
    fi
    sleep 1
  done
  echo "last=$(read_async_result)" >&2
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

RUN_KEY="askbible-e2e-reading-alarm-run-v1"

launch_app() {
  xcrun simctl terminate "$SIM_ID" me.askbible 2>/dev/null || true
  sleep 1
  xcrun simctl launch "$SIM_ID" me.askbible >/dev/null
  sleep 12
}

prepare_e2e_mode() {
  local mode="$1"
  xcrun simctl terminate "$SIM_ID" me.askbible 2>/dev/null || true
  sleep 1
  clear_async_result
  queue_e2e_mode "$mode"
}

deep_link() {
  xcrun simctl openurl "$SIM_ID" "$1"
}

echo "== iOS reading alarm E2E (simulator $SIM_ID) =="
test -f "$ASYNC_MANIFEST"

echo "== 1/2 Native prelude smoke =="
prepare_e2e_mode smoke
launch_app
curl -s "http://127.0.0.1:8081/.expo/.virtual-metro-entry.bundle?platform=ios&dev=true&minify=false" >/dev/null
if wait_async_result "native prelude smoke" 45; then
  echo "OK smoke"
else
  echo "FAIL smoke"
  exit 1
fi

echo "== 2/2 Foreground notification + alarm trigger =="
prepare_e2e_mode fire
launch_app
if wait_async_result "alarm-triggered" 45; then
  echo "OK full foreground flow"
else
  echo "FAIL alarm trigger (last=$(read_async_result))"
  exit 1
fi

echo "== ALL PASSED =="
