#!/usr/bin/env bash
# 真机开发：网站 API (3450) + Metro (LAN) + 安装 Debug 到 USB 连接的 Android 手机
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  AskBible.me · Android 真机（一键）"
echo "  项目: $ROOT"
echo ""
echo "  ① 同步经文/文案"
echo "  ② 网站 API   http://<Mac局域网IP>:3450"
echo "  ③ Metro      http://<Mac局域网IP>:8081"
echo "  ④ 编译安装到已连接的 Android 手机（USB 调试）"
echo ""
echo "  请：开启 USB 调试、用数据线连 Mac、手机上点「允许调试」"
echo "  若 .env.local 仍是 localhost，请参考 apps/askbible-mobile/env.device.example"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# shellcheck source=/dev/null
source "$ROOT/apps/askbible-mobile/scripts/android-sdk-env.sh"
adb start-server >/dev/null 2>&1 || true

pick_physical_serial() {
  adb devices 2>/dev/null | awk 'NR>1 && $2=="device" && $1 !~ /^emulator-/ { print $1; exit }'
}

SERIAL="$(pick_physical_serial || true)"
if [[ -z "$SERIAL" ]]; then
  echo "✗ 未检测到 Android 真机（仅模拟器或未授权）。" >&2
  echo "  请连接手机并执行: adb devices" >&2
  exit 1
fi
echo "→ 已识别真机: $SERIAL"

echo "→ adb reverse（USB 真机 API/Metro 走 127.0.0.1）"
adb -s "$SERIAL" reverse --remove-all 2>/dev/null || true
adb -s "$SERIAL" reverse tcp:8081 tcp:8081
adb -s "$SERIAL" reverse tcp:3450 tcp:3450

node scripts/free-port.mjs 3450
node scripts/free-port.mjs 8081
sleep 1

echo "→ npm run mobile:sync-content"
npm run mobile:sync-content

WEB_LOG="${TMPDIR:-/tmp}/askbible-web-dev.log"
echo ""
echo "→ [1/3] 后台启动网站 API: npm run dev"
echo "    日志: tail -f $WEB_LOG"
npm run dev >"$WEB_LOG" 2>&1 &
WEB_PID=$!

METRO_LOG="${TMPDIR:-/tmp}/askbible-metro-android-device.log"
echo "→ [2/3] 后台启动 Metro（--lan）…  日志: tail -f $METRO_LOG"

cd "$ROOT/apps/askbible-mobile"
npx expo start --localhost --clear >"$METRO_LOG" 2>&1 &
METRO_PID=$!

cleanup() {
  echo ""
  echo "→ 正在停止 Metro ($METRO_PID) 与网站 API ($WEB_PID) …"
  kill "$METRO_PID" 2>/dev/null || true
  kill "$WEB_PID" 2>/dev/null || true
  wait "$METRO_PID" 2>/dev/null || true
  wait "$WEB_PID" 2>/dev/null || true
}
trap cleanup INT TERM

for _ in $(seq 1 120); do
  if curl -sf -o /dev/null "http://127.0.0.1:3450/"; then
    echo "    ✓ 3450 已就绪"
    break
  fi
  if ! kill -0 "$WEB_PID" 2>/dev/null; then
    echo "✗ 网站 API 已退出。最近日志："
    tail -n 40 "$WEB_LOG" 2>/dev/null || true
    exit 1
  fi
  sleep 1
done

READY_METRO=0
for _ in $(seq 1 90); do
  if curl -sf -o /dev/null "http://127.0.0.1:8081/status" 2>/dev/null; then
    READY_METRO=1
    break
  fi
  if ! kill -0 "$METRO_PID" 2>/dev/null; then
    echo "✗ Metro 已退出。最近日志："
    tail -n 40 "$METRO_LOG" 2>/dev/null || true
    exit 1
  fi
  sleep 1
done

if [ "$READY_METRO" -eq 1 ]; then
  echo "    ✓ Metro 已就绪"
else
  echo "    ⚠ Metro 未在 90s 内就绪，仍将尝试安装"
fi

LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
# USB + adb reverse：Dev Client 必须连 127.0.0.1:8081（不是 Mac 局域网 IP，否则断 Wi‑Fi 即白屏）
export REACT_NATIVE_PACKAGER_HOSTNAME="127.0.0.1"
if [ -n "$LAN_IP" ]; then
  echo "    USB Metro（adb reverse）: http://127.0.0.1:8081"
  echo "    同网 Wi‑Fi 备用: http://${LAN_IP}:8081"
fi

echo ""
echo "→ [3/3] expo run:android --device -s $SERIAL"
echo "    安装后请保持本窗口运行（Metro + API）"
echo ""

export ANDROID_SERIAL="$SERIAL"
npx expo run:android --no-bundler

BUNDLE_URL="http://127.0.0.1:8081/node_modules/expo-router/entry.bundle?platform=android&dev=true&minify=false"
ENCODED_URL="$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$BUNDLE_URL")"
echo "→ 用 USB 隧道 URL 启动 App（避免 Wi‑Fi/LAN 白屏）"
adb -s "$SERIAL" shell am force-stop me.askbible >/dev/null 2>&1 || true
sleep 0.5
adb -s "$SERIAL" shell am start -a android.intent.action.VIEW \
  -d "askbible://expo-development-client/?url=${ENCODED_URL}" me.askbible >/dev/null 2>&1 || true

echo ""
echo "✓ 使用完毕请在本窗口 Control+C 停止服务"
echo "  不连电脑单独用: 双击「8-安装Release到Android手机」或 npm run mobile:install:apk:device"
if ! wait "$METRO_PID"; then
  echo ""
  echo "⚠ Metro 进程已退出（安装可能已完成）。若 App 可打开可忽略；若需热更新请重启本脚本。"
fi
