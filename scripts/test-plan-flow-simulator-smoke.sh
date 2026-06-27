#!/usr/bin/env bash
# planFlow 模拟器冒烟：启动 API + Metro，iOS/Android 拉最新 bundle 并打开读经 planFlow 深链。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE="$ROOT/apps/askbible-mobile"
BUNDLE_ID="me.askbible"
IOS_SIM_NAME="${IOS_SIM_NAME:-AskBible iPhone 16}"
ANDROID_AVD="${ANDROID_AVD:-Expo_API_34}"
METRO_PORT=8081
WEB_LOG="${TMPDIR:-/tmp}/askbible-web-dev.log"
METRO_LOG="${TMPDIR:-/tmp}/askbible-metro-planflow.log"
PLAN_DEEPLINK="askbible://read/GEN/1?planFlow=1"
E2E_DEEPLINK="askbible://dev/plan-flow-e2e"

cd "$ROOT"

echo "→ [1/5] planFlow 逻辑校验 …"
node scripts/plan-flow-logic-check.mjs
npx vitest run apps/askbible-mobile/src/music/scripturePlaybackPriority.test.ts apps/askbible-mobile/src/music/scriptureChapterEnd.test.ts

echo "→ [2/5] 释放端口并启动网站 API …"
node scripts/free-port.mjs 3450
node scripts/free-port.mjs "$METRO_PORT"
if ! curl -sf -o /dev/null "http://127.0.0.1:3450/" 2>/dev/null; then
  npm run dev >"$WEB_LOG" 2>&1 &
  WEB_PID=$!
  for _ in $(seq 1 90); do
    curl -sf -o /dev/null "http://127.0.0.1:3450/" && break
    sleep 1
  done
  echo "    ✓ API 3450"
fi

echo "→ [3/5] 启动 Metro (--localhost) …"
if ! curl -sf -o /dev/null "http://127.0.0.1:${METRO_PORT}/status" 2>/dev/null; then
  (
    cd "$MOBILE"
    REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1 npx expo start --port "$METRO_PORT" --localhost --clear >>"$METRO_LOG" 2>&1
  ) &
  for _ in $(seq 1 90); do
    curl -sf -o /dev/null "http://127.0.0.1:${METRO_PORT}/status" && break
    sleep 1
  done
fi
echo "    ✓ Metro ${METRO_PORT}"

ios_sim_id() {
  xcrun simctl list devices available -j \
    | node -e "
const j=JSON.parse(require('fs').readFileSync(0,'utf8'));
for (const list of Object.values(j.devices)) {
  for (const d of list) {
    if (d.name==='${IOS_SIM_NAME}' && d.isAvailable) { process.stdout.write(d.udid); process.exit(0); }
  }
}
process.exit(1);
"
}

echo "→ [4/5] iOS 模拟器 …"
IOS_UDID="$(ios_sim_id)"
xcrun simctl boot "$IOS_UDID" 2>/dev/null || true
open -a Simulator --args -CurrentDeviceUDID "$IOS_UDID"
sleep 3
xcrun simctl terminate "$IOS_UDID" "$BUNDLE_ID" 2>/dev/null || true
xcrun simctl launch "$IOS_UDID" "$BUNDLE_ID" --url "me.askbible://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081" \
  2>/dev/null || xcrun simctl launch "$IOS_UDID" "$BUNDLE_ID" || {
  echo "✗ iOS：未安装 Debug 包。请先: cd apps/askbible-mobile && npx expo run:ios --device \"${IOS_SIM_NAME}\""
  exit 1
}
sleep 5
curl -sf "http://127.0.0.1:${METRO_PORT}/reload" >/dev/null || true
xcrun simctl openurl "$IOS_UDID" "$PLAN_DEEPLINK" || true
sleep 8
xcrun simctl openurl "$IOS_UDID" "$E2E_DEEPLINK" || true
sleep 12
if grep -q "E2E-PlanFlow.*PASS" "$METRO_LOG" 2>/dev/null; then
  echo "    ✓ iOS planFlow E2E PASS (Metro 日志)"
else
  echo "    ⚠ iOS planFlow E2E 未在 Metro 日志中看到 PASS"
  exit 1
fi
echo "    ✓ iOS 已启动并打开 planFlow 深链"

echo "→ [5/5] Android 模拟器 …"
if command -v emulator >/dev/null 2>&1; then
  if ! adb devices | grep -q "emulator"; then
    nohup emulator -avd "$ANDROID_AVD" -no-snapshot-load >>"${TMPDIR:-/tmp}/askbible-android-emu.log" 2>&1 &
    for _ in $(seq 1 120); do
      adb wait-for-device 2>/dev/null && adb shell getprop sys.boot_completed 2>/dev/null | grep -q 1 && break
      sleep 2
    done
  fi
  adb reverse tcp:"$METRO_PORT" tcp:"$METRO_PORT" 2>/dev/null || true
  adb reverse tcp:3450 tcp:3450 2>/dev/null || true
  adb shell am force-stop "$BUNDLE_ID" 2>/dev/null || true
  adb shell am start -a android.intent.action.VIEW -d "$PLAN_DEEPLINK" "$BUNDLE_ID" 2>/dev/null \
    || adb shell monkey -p "$BUNDLE_ID" -c android.intent.category.LAUNCHER 1 2>/dev/null || {
    echo "✗ Android：未安装 Debug 包。请先: cd apps/askbible-mobile && npx expo run:android"
    exit 1
  }
  sleep 8
  METRO_LINES_BEFORE=$(wc -l <"$METRO_LOG" 2>/dev/null || echo 0)
  adb shell am start -a android.intent.action.VIEW -d "$E2E_DEEPLINK" "$BUNDLE_ID" 2>/dev/null || true
  sleep 12
  if tail -n +"$((METRO_LINES_BEFORE + 1))" "$METRO_LOG" 2>/dev/null | grep -q "E2E-PlanFlow.*PASS"; then
    echo "    ✓ Android planFlow E2E PASS (Metro 日志)"
  else
    echo "    ⚠ Android planFlow E2E 未在 Metro 日志中看到 PASS"
    exit 1
  fi
  echo "    ✓ Android 已启动并打开 planFlow 深链"
else
  echo "    ⚠ 未找到 emulator 命令，跳过 Android"
fi

echo ""
echo "✓ planFlow 冒烟完成。请在两端确认："
echo "  · 章页打开且无红屏"
echo "  · 从首页/读经首页点读经可自动播放"
echo "  · 第一章播完后自动进入下一章"
echo "  Metro 日志: tail -f $METRO_LOG"
