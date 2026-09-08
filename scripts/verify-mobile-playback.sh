#!/bin/bash
# 播放回归验收（Android 真机）。改完播放相关代码后由 Claude 自己跑，不要丢给 Josh 手测。
#
#   ./scripts/verify-mobile-playback.sh            # 用已装的包
#   ./scripts/verify-mobile-playback.sh --build    # 先重打包再装
#
# 为什么要有它：2026-09-08 重构播放层时，有两次「日志完全正常、界面却是错的」——
# 读经换章后页面没翻页、金句换句后文字冻在第一句。音频账本看不出来，只有截图能发现。
# 所以每个场景都要同时检查**账本**与**屏幕**。
set -uo pipefail

DEVICE="${ANDROID_DEVICE:-R5CW11DNS2K}"
OUT="${TMPDIR:-/tmp}/askbible-playback-verify"
APK=apps/askbible-mobile/android/app/build/outputs/apk/release/app-release.apk
PASS=0; FAIL=0

# 三星 S23 Ultra（720x1544）上的坐标；换机型要重新量。
TAP_MUSIC="210 1332"      # 首页底部快捷栏：音符
TAP_VERSE="359 1332"      # 首页底部快捷栏：喇叭（金句）
TAB_HOME="88 1460"
TAB_READ="497 1460"
BOOK_GENESIS="155 421"
CHAPTER_1="135 421"
READ_PLAY="368 1328"
READ_SCRUB_END="575 1246"  # 进度条接近末尾

mkdir -p "$OUT"
adb -s "$DEVICE" get-state >/dev/null 2>&1 || { echo "设备 $DEVICE 未连接"; exit 1; }

say() { printf "\n\033[1m%s\033[0m\n" "$*"; }
tap() { adb -s "$DEVICE" shell input tap $1; sleep "${2:-3}"; }
ledger() { adb -s "$DEVICE" logcat -d -v time AskBiblePlayback:V AskBibleMusic:V AskBibleScripture:V AskBibleVerse:V AndroidRuntime:E '*:S' 2>/dev/null | grep -v "^\s*at "; }
shot() { adb -s "$DEVICE" exec-out screencap -p > "$OUT/$1.png"; }

check() { # check <说明> <期望正则>
  if ledger | grep -qE "$2"; then printf "  ✓ %s\n" "$1"; PASS=$((PASS+1));
  else printf "  ✗ %s\n     期望匹配: %s\n" "$1" "$2"; FAIL=$((FAIL+1)); fi
}

# 图标黄没黄。日志说不了这件事——「黄着却没声」正是 Josh 报过的 bug，
# 只有数屏幕上的黄色像素才能发现。
icon_lit() { # icon_lit <截图名> <说明> <x> <y> <期望 lit|dark>
  adb -s "$DEVICE" exec-out screencap -p > "$OUT/$1.png"
  local got
  got=$(python3 scripts/icon-lit.py "$OUT/$1.png" "$3" "$4")
  if [ "$got" = "$5" ]; then printf "  ✓ %s（图标 %s）\n" "$2" "$got"; PASS=$((PASS+1));
  else printf "  ✗ %s：图标应为 %s，实为 %s\n" "$2" "$5" "$got"; FAIL=$((FAIL+1)); fi
}

check_screen() { # check_screen <说明> <裁剪区域 l,t,r,b> <期望文字>
  python3 - "$OUT/$1.png" "$2" "$3" "$1" <<'PY'
import subprocess, sys
png, box, want, name = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
# 没有 OCR 依赖时只保存裁剪图供人眼复核；有 tesseract 就自动断言。
l,t,r,b = [int(x) for x in box.split(",")]
from PIL import Image
Image.open(png).crop((l,t,r,b)).save(png.replace(".png", "-crop.png"))
try:
    txt = subprocess.run(["tesseract", png.replace(".png","-crop.png"), "stdout", "-l", "chi_sim"],
                         capture_output=True, text=True, timeout=60).stdout
except Exception:
    print(f"  · {name}：已存裁剪图（无 tesseract，需人眼复核）"); sys.exit(0)
print(("  ✓ " if want in txt.replace(" ", "") else "  ✗ ") + f"{name}：期望屏幕含「{want}」")
PY
}

if [ "${1:-}" = "--build" ]; then
  say "重新打包"
  (cd apps/askbible-mobile/android && ./gradlew :app:assembleRelease -q) || exit 1
  adb -s "$DEVICE" install -r "$APK" >/dev/null || exit 1
fi

say "冷启动"
adb -s "$DEVICE" shell am force-stop me.askbible
adb -s "$DEVICE" logcat -c
adb -s "$DEVICE" shell monkey -p me.askbible -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
sleep 12

say "1 音乐起播"
adb -s "$DEVICE" logcat -c; tap "$TAP_MUSIC" 8
check "音乐在响" "Play MUSIC .*audible=\[MUSIC\]"

say "2 金句叠在音乐上（两路同响）"
tap "$TAP_VERSE" 9
check "音乐与金句同响" "audible=\[MUSIC, VERSE\]"
shot 2-both-icons
icon_lit 2-icons "两个图标都黄" ${TAP_MUSIC% *} ${TAP_MUSIC#* } lit

say "3 关音乐，金句要继续"
tap "$TAP_MUSIC" 8
check "只剩金句" "Pause MUSIC -> audible=\[VERSE\]"
# 关掉音乐后音符必须暗下来：原生的 wantPlaying 暂停后仍为 true，
# 界面若直接拿它点灯就会「黄着却没声」（2026-09-08 复现）。
icon_lit 3-music-off "音符已暗" ${TAP_MUSIC% *} ${TAP_MUSIC#* } dark
icon_lit 3-verse-on "喇叭仍黄" ${TAP_VERSE% *} ${TAP_VERSE#* } lit

say "4 金句自动接句（40 秒，含 5 秒间隔）"
adb -s "$DEVICE" logcat -c; sleep 40
check "原生自己接句" "NativeAdvanced VERSE"
shot 4-verse-text   # 文字必须跟着音轨走

say "5 播着音乐进读经页点播放"
tap "$TAB_HOME" 4; tap "$TAP_MUSIC" 6
adb -s "$DEVICE" logcat -c
tap "$TAB_READ" 5; tap "$BOOK_GENESIS" 4; tap "$CHAPTER_1" 6; tap "$READ_PLAY" 9
check "读经接管，音乐让位" "Play SCRIPTURE .*audible=\[SCRIPTURE\]"
# 开读经后音乐不该被 JS 补发的 resume 挤回来；grep 没有负向前瞻，改成显式反查。
if ledger | grep -q "Resume MUSIC"; then
  printf "  ✗ 音乐被挤回来了（出现 Resume MUSIC）\n"; FAIL=$((FAIL+1))
else
  printf "  ✓ 音乐没有挤回来\n"; PASS=$((PASS+1))
fi

say "6 读经自动接章（拖到章末）+ 页面跟着翻"
adb -s "$DEVICE" logcat -c; tap "$READ_SCRUB_END" 22
check "原生自己接章" "NativeAdvanced SCRIPTURE"
shot 6-chapter-title  # 标题必须变成第 2 章

say "6b 进度轴在走（读经）"
adb -s "$DEVICE" exec-out screencap -p > "$OUT/6b-progress-1.png"; sleep 6
adb -s "$DEVICE" exec-out screencap -p > "$OUT/6b-progress-2.png"
# 进度是从原生状态直连界面的；不走就说明这条链断了。两张图裁进度条区域供人眼比对。
python3 - "$OUT" <<'PY2'
import sys
from PIL import Image, ImageChops
o = sys.argv[1]
a = Image.open(f"{o}/6b-progress-1.png").crop((30,1225,690,1270))
b = Image.open(f"{o}/6b-progress-2.png").crop((30,1225,690,1270))
a.save(f"{o}/6b-progress-1-crop.png"); b.save(f"{o}/6b-progress-2-crop.png")
same = ImageChops.difference(a.convert("RGB"), b.convert("RGB")).getbbox() is None
print(("  ✗ 进度轴 6 秒内没有变化" if same else "  ✓ 进度轴在走"))
PY2

say "7 锁屏控制"
adb -s "$DEVICE" logcat -c
adb -s "$DEVICE" shell input keyevent 127; sleep 4
check "暂停键全停" "PauseAll  -> audible=\[\]"
adb -s "$DEVICE" shell input keyevent 126; sleep 5
check "播放键原样恢复" "ResumeTransport"

say "8 没有崩溃"
if ledger | grep -q "AndroidRuntime"; then printf "  ✗ 出现崩溃\n"; FAIL=$((FAIL+1)); else printf "  ✓ 无崩溃\n"; PASS=$((PASS+1)); fi

say "结果：$PASS 通过 / $FAIL 失败"
echo "截图（屏幕内容需与音轨对上，看这几张）：$OUT"
ls "$OUT"/*.png 2>/dev/null | sed 's/^/  /'
[ "$FAIL" -eq 0 ]
