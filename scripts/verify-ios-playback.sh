#!/bin/bash
# 播放回归验收（iOS 模拟器）。安卓那套的对照实现，改完播放相关代码两边都要跑。
#
#   ./scripts/verify-ios-playback.sh            # 用已装的 App
#   ./scripts/verify-ios-playback.sh --build    # 先重新编译再装
#
# 为什么不点屏幕：iOS 模拟器没有 idb，simctl 也不能注入点击。而且 2026-09-08 有两个多小时
# 浪费在「量错的坐标伪造出 bug」上——手动测试时那一下「拖到章末」点在了下一章键上。
# 深链没有坐标，点不歪。
#
# 账本用 `log show --last`，不用 `log stream`：脚本里后台起的 stream 会被 SIGHUP/SIGTERM
# 打掉，账本只剩一行，断言全绿地什么都没验。
set -uo pipefail

DEVICE="${IOS_SIM:-iPhone 14 Pro Max}"
UDID=$(xcrun simctl list devices | grep -F "$DEVICE (" | head -1 | sed -E 's/.*\(([0-9A-F-]{36})\).*/\1/')
APP_DIR=apps/askbible-mobile/ios
# Release 包：JS bundle 打进去了，不依赖 Metro。
# Debug 包要连 localhost:8081，而那个端口随时可能被另一个项目的 Metro 占着——
# 2026-09-08 就发生过：App 加载了隔壁项目的 bundle，报 `Cannot find native module ExponentAV`。
APP="$APP_DIR/build/DD/Build/Products/Release-iphonesimulator/AskBibleme.app"
OUT="${TMPDIR:-/tmp}/askbible-ios-verify"
PASS=0; FAIL=0

[ -n "$UDID" ] || { echo "找不到模拟器「$DEVICE」"; exit 1; }
mkdir -p "$OUT"

say() { printf "\n\033[1m%s\033[0m\n" "$*"; }
shot() { xcrun simctl io "$UDID" screenshot "$OUT/$1.png" >/dev/null 2>&1; }
# 账本用 `log stream` 写文件。模拟器上 `log show` 读不到我们这个 subsystem
# （Logger.info 不落盘），断言会全部落空——2026-09-08 在这上面卡过一轮。
# 后台起 stream 必须 nohup，否则收到 SIGHUP 当场就死，账本只剩一行。
LOG="$OUT/ledger.log"
MARK=0
mark() { MARK=$(wc -l < "$LOG" 2>/dev/null || echo 0); }
ledger() { tail -n "+$((MARK + 1))" "$LOG" 2>/dev/null; }

check() { # check <说明> <期望正则>
  if ledger | grep -qE "$2"; then printf "  ✓ %s\n" "$1"; PASS=$((PASS+1));
  else printf "  ✗ %s\n     期望匹配: %s\n" "$1" "$2"; FAIL=$((FAIL+1)); fi
}
refute() { # refute <说明> <不该出现的正则>
  if ledger | grep -qE "$2"; then
    printf "  ✗ %s\n" "$1"; ledger | grep -E "$2" | tail -3 | sed 's/^/      /'; FAIL=$((FAIL+1))
  else printf "  ✓ %s\n" "$1"; PASS=$((PASS+1)); fi
}

if [ "${1:-}" = "--build" ]; then
  say "重新编译"
  (cd "$APP_DIR" && xcodebuild -workspace AskBibleme.xcworkspace -scheme AskBibleme \
     -configuration Release -sdk iphonesimulator -destination "id=$UDID" \
     -derivedDataPath build/DD CODE_SIGNING_ALLOWED=NO build 2>&1 \
     | grep -E "error:|BUILD (SUCCEEDED|FAILED)") || exit 1
  [ -d "$APP" ] || { echo "没有编译产物"; exit 1; }
  xcrun simctl install "$UDID" "$APP" >/dev/null || exit 1
fi

say "冷启动"
xcrun simctl bootstatus "$UDID" -b >/dev/null 2>&1
xcrun simctl terminate "$UDID" me.askbible >/dev/null 2>&1
: > "$LOG"
nohup xcrun simctl spawn "$UDID" log stream --style compact --level info \
  --predicate 'subsystem == "me.askbible"' > "$LOG" 2>&1 &
STREAM=$!
trap 'kill $STREAM 2>/dev/null' EXIT
sleep 4
xcrun simctl launch "$UDID" me.askbible >/dev/null 2>&1
# 等到它真的说话了再往下走，否则深链会打在一个还没起来的 App 上
#（问的是账本，不是猜一个 sleep 数字）。
for _ in $(seq 1 30); do
  grep -q "me.askbible:" "$LOG" 2>/dev/null && break
  sleep 2
done
sleep 4
if grep -q "me.askbible:" "$LOG" 2>/dev/null; then printf "  ✓ App 起来了\n"; PASS=$((PASS+1));
else printf "  ✗ App 没起来\n"; FAIL=$((FAIL+1)); fi

# 诗篇 117 只有两节，音轨二十来秒——后台接章因此能在一分钟内验完，
# 不用干等三四分钟一章。
say "1 深链起播读经（诗篇 117，全书最短一章）"
xcrun simctl openurl "$UDID" "askbible://read/PSA/117?autoplay=1" >/dev/null 2>&1
# 只等到「起播 + 队列到位」就走：诗篇 117 只有十三秒，等久了它会在前台就接完章，
# 后台那一段就没东西可验了。
sleep 7
check "读经在响" "play scripture .* -> audible=scripture"
check "命令带了来源标签" "js userPlay scripture origin="
check "原生手里有队列（后台接章的前提）" "setQueue scripture q=[1-9]"
shot 1-psa117

say "2 切到后台，声音要继续"
# 从这里开始记账。后面两段断言的都是「进了后台之后」发生的事——
# 不划这条线的话，第 1 步那次起播会被算进来，「后台 JS 没动手」永远判失败。
mark
xcrun simctl launch "$UDID" com.apple.mobilesafari >/dev/null 2>&1
sleep 6
refute "后台没有被暂停" "pause scripture"

say "3 后台自己接下一章（这轮重构的核心承诺）"
# 判据两条：原生自己接上了，**并且**整个后台期间 JS 没有发过任何播放命令。
# 沿用第 2 步划的那条线，不重新划——窗口就是「后台这一整段」。
sleep 22
check "原生自己接章" "nativeAdvanced scripture"
refute "接章没惊动 JS" "js userPlay scripture"

say "4 回到前台，界面跟上音轨"
xcrun simctl launch "$UDID" me.askbible >/dev/null 2>&1
sleep 8
shot 4-after-foreground

say "5 没有崩溃"
if xcrun simctl spawn "$UDID" log show --last 5m --predicate 'process == "AskBibleme"' 2>/dev/null \
   | grep -qE "Fatal error|SIGABRT"; then
  printf "  ✗ 出现崩溃\n"; FAIL=$((FAIL+1))
else printf "  ✓ 无崩溃\n"; PASS=$((PASS+1)); fi

say "结果：$PASS 通过 / $FAIL 失败"
echo "账本：$LOG"
echo "截图（屏幕内容需与音轨对上，看这几张）：$OUT"
ls "$OUT"/*.png 2>/dev/null | sed 's/^/  /'
[ "$FAIL" -eq 0 ]
