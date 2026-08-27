#!/usr/bin/env bash
# Local Maestro smoke against a running Debug install (iOS sim or Android emu).
# Starts Metro if needed, opens dev client, then runs flows.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE="$ROOT/apps/askbible-mobile"
FLOW="${1:-"$ROOT/.maestro/smoke-shell.yaml"}"
APP_ID="me.askbible"
METRO_PORT="${METRO_PORT:-8081}"
METRO_LOG="${TMPDIR:-/tmp}/askbible-metro-maestro.log"
DEV_CLIENT_URL="me.askbible://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A${METRO_PORT}"

if ! command -v maestro >/dev/null 2>&1; then
  echo "✗ maestro CLI missing. Install: curl -Ls \"https://get.maestro.mobile.dev\" | bash"
  exit 1
fi

PLATFORM="${MAESTRO_PLATFORM:-}"
if [[ -z "$PLATFORM" ]]; then
  if command -v xcrun >/dev/null 2>&1 && xcrun simctl list devices booted 2>/dev/null | grep -q Booted; then
    PLATFORM=ios
  elif command -v adb >/dev/null 2>&1 && adb devices 2>/dev/null | grep -q $'\tdevice$'; then
    PLATFORM=android
  else
    echo "✗ No booted iOS Simulator or Android device. Boot one, install Debug app, retry."
    exit 1
  fi
fi

ensure_metro() {
  if curl -sf -o /dev/null "http://127.0.0.1:${METRO_PORT}/status" 2>/dev/null; then
    echo "    ✓ Metro ${METRO_PORT}"
    return
  fi
  echo "→ Starting Metro (--localhost) …"
  node "$ROOT/scripts/free-port.mjs" "$METRO_PORT" 2>/dev/null || true
  (
    cd "$MOBILE"
    REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1 npx expo start --port "$METRO_PORT" --localhost >>"$METRO_LOG" 2>&1
  ) &
  for _ in $(seq 1 120); do
    if curl -sf -o /dev/null "http://127.0.0.1:${METRO_PORT}/status" 2>/dev/null; then
      echo "    ✓ Metro ${METRO_PORT}"
      return
    fi
    sleep 1
  done
  echo "✗ Metro did not start. tail: $METRO_LOG"
  tail -n 30 "$METRO_LOG" 2>/dev/null || true
  exit 1
}

prep_ios_dev_client() {
  local udid="$1"
  xcrun simctl terminate "$udid" "$APP_ID" 2>/dev/null || true
  sleep 1
  xcrun simctl launch "$udid" "$APP_ID" --url "$DEV_CLIENT_URL" 2>/dev/null \
    || xcrun simctl launch "$udid" "$APP_ID"
  echo "    waiting for JS bundle …"
  sleep 15
  curl -sf "http://127.0.0.1:${METRO_PORT}/reload" >/dev/null 2>&1 || true
  sleep 3
}

echo "→ Maestro smoke ($PLATFORM) · $FLOW"
ensure_metro

MAESTRO_ARGS=()
if [[ "${MAESTRO_REINSTALL_DRIVER:-}" == "1" ]]; then
  MAESTRO_ARGS+=(--reinstall-driver)
fi
if [[ "$PLATFORM" == "ios" ]]; then
  IOS_UDID="$(xcrun simctl list devices booted -j | node -e "
    const j=JSON.parse(require('fs').readFileSync(0,'utf8'));
    for (const list of Object.values(j.devices)) {
      for (const d of list) {
        if (d.state==='Booted') { process.stdout.write(d.udid); process.exit(0); }
      }
    }
    process.exit(1);
  ")"
  if [[ -z "$IOS_UDID" ]]; then
    echo "✗ No booted iOS Simulator"
    exit 1
  fi
  echo "    iOS sim $IOS_UDID"
  xcrun simctl get_app_container "$IOS_UDID" "$APP_ID" data >/dev/null 2>&1 \
    || echo "⚠ App $APP_ID not on sim — install: npm run mobile:ios"
  prep_ios_dev_client "$IOS_UDID"
  MAESTRO_ARGS+=(-p ios --udid "$IOS_UDID")
elif [[ "$PLATFORM" == "android" ]]; then
  ANDROID_SERIAL="$(adb devices 2>/dev/null | awk 'NR>1 && $2=="device" {print $1; exit}')"
  if [[ -z "$ANDROID_SERIAL" ]]; then
    echo "✗ No Android device/emulator"
    exit 1
  fi
  echo "    Android $ANDROID_SERIAL"
  MAESTRO_ARGS+=(-p android --udid "$ANDROID_SERIAL")
fi

cd "$ROOT"
maestro test "${MAESTRO_ARGS[@]}" "$FLOW"
echo "✓ Maestro smoke passed"
