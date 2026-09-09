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

DEVICE="${ANDROID_DEVICE:-HT74M0200477}"
OUT="${TMPDIR:-/tmp}/askbible-playback-verify"
APK=apps/askbible-mobile/android/app/build/outputs/apk/release/app-release.apk
PASS=0; FAIL=0

adb -s "$DEVICE" get-state >/dev/null 2>&1 || { echo "设备 $DEVICE 未连接"; exit 1; }

# 坐标按机型分组——同一套像素坐标换台机器就全落空，脚本会「全绿地什么都没点到」。
# 加新机型：装好后截一张首页图量一次，照抄一组进来。
SCREEN=$(adb -s "$DEVICE" shell wm size | tr -d '\r' | awk '{print $3}')
case "$SCREEN" in
  1440x2560)  # Pixel XL
    TAP_MUSIC="438 2160"; TAP_VERSE="720 2160"
    TAB_HOME="189 2397";  TAB_READ="981 2397"
    BOOK_GENESIS="300 765"; CHAPTER_1="300 735"
    READ_PLAY="720 2154"; READ_SCRUB_END="1150 1986"
    ICON_R=60; PROGRESS_BOX="234,1950,1230,2025"
    ;;
  720x1544)   # 三星 S23 Ultra（显示缩放下的逻辑分辨率）
    TAP_MUSIC="210 1332"; TAP_VERSE="359 1332"
    TAB_HOME="88 1460";   TAB_READ="497 1460"
    BOOK_GENESIS="155 421"; CHAPTER_1="135 421"
    READ_PLAY="368 1328"; READ_SCRUB_END="575 1246"
    ICON_R=34; PROGRESS_BOX="30,1225,690,1270"
    ;;
  *)
    echo "没有 $SCREEN 这个分辨率的坐标表；截一张首页图量一组加进脚本。"; exit 1
    ;;
esac
echo "机型 $SCREEN，用对应坐标表"

mkdir -p "$OUT"

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
  got=$(python3 scripts/icon-lit.py "$OUT/$1.png" "$3" "$4" "$ICON_R")
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

# 关屏时 JS 是睡着的。以前换章/接句都要靠把 JS 叫醒——叫不醒就断在那儿。
# 判据有两条：原生自己接上了，**并且**这段时间里没有任何 js userPlay。
screen_off() { adb -s "$DEVICE" shell input keyevent 26; }
# 亮屏之后必须把状态完全恢复：解锁 + 把 App 拉回前台。
# 少做这一步，后面每一条都会失败——不是应用坏了，是它们点在锁屏上。
screen_on() {
  adb -s "$DEVICE" shell input keyevent 26; sleep 1
  adb -s "$DEVICE" shell input keyevent 82; sleep 1
  adb -s "$DEVICE" shell input swipe 720 2000 720 900 200; sleep 1
  adb -s "$DEVICE" shell am start -n me.askbible/.MainActivity >/dev/null 2>&1 \
    || adb -s "$DEVICE" shell monkey -p me.askbible -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
  sleep 3
}

no_js_play() { # no_js_play <说明>
  if ledger | grep -q "js userPlay"; then
    printf "  ✗ %s：关屏期间 JS 仍在发播放命令\n" "$1"; FAIL=$((FAIL+1))
    ledger | grep "js userPlay" | tail -3 | sed 's/^/      /'
  else
    printf "  ✓ %s\n" "$1"; PASS=$((PASS+1))
  fi
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

# 冷启动后 App 会恢复上一次待过的标签页，不一定是首页——2026-09-08 有一轮
# 停在读经页，第一下「点音乐」实际点在了书卷列表的「以斯拉记」上，
# 然后前半场全线飘红，看着像应用坏了。先明确回首页。
say "0 回到首页"
tap "$TAB_HOME" 4
shot 0-home

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
# 原生接上句之后 JS 不许再点一次播：它会另抽一句、把原生刚起的这句掐掉
# （Josh：「每点一次音乐，金句就会重新来，甚至会断掉」）。
if ledger | grep -q "Play VERSE"; then
  printf "  ✗ 原生接句后 JS 又点了一次播（出现 Play VERSE）\n"; FAIL=$((FAIL+1))
else
  printf "  ✓ JS 没有抢着重开金句\n"; PASS=$((PASS+1))
fi
shot 4-verse-text   # 文字必须跟着音轨走

say "4b 金句在响时反复点音乐，金句不许断"
# 偶数次，跑完音乐仍是关的——下一步要靠「点一下就开」这个前提。
adb -s "$DEVICE" logcat -c
for _ in 1 2 3 4; do tap "$TAP_MUSIC" 5; done
if ledger | grep -q "Play VERSE"; then
  printf "  ✗ 点音乐把金句重开了（出现 Play VERSE）\n"; FAIL=$((FAIL+1))
else
  printf "  ✓ 金句没有被音乐打断\n"; PASS=$((PASS+1))
fi

say "4c 关屏后金句自己接句（这轮重构的核心承诺之一）"
adb -s "$DEVICE" logcat -c
screen_off; sleep 45
check "关屏后原生自己接句" "NativeAdvanced VERSE"
no_js_play "关屏接句没惊动 JS"
screen_on; sleep 3

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
python3 - "$OUT" "$PROGRESS_BOX" <<'PY2'
import sys
from PIL import Image, ImageChops
o = sys.argv[1]
box = tuple(int(x) for x in sys.argv[2].split(","))
a = Image.open(f"{o}/6b-progress-1.png").crop(box)
b = Image.open(f"{o}/6b-progress-2.png").crop(box)
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

say "6c 关屏后读经自己接章（同上，这条最关键：整章音频最长）"
# 9a 读经：拖到章末 → 立刻关屏 → 原生该自己接下一章
tap "$READ_SCRUB_END" 2
adb -s "$DEVICE" logcat -c
screen_off; sleep 30
check "关屏后原生自己接章" "NativeAdvanced SCRIPTURE"
no_js_play "关屏接章没惊动 JS"
screen_on; sleep 3
shot 9a-after-wake   # 醒来后页面该已经在下一章


say "8 没有崩溃"
if ledger | grep -q "AndroidRuntime"; then printf "  ✗ 出现崩溃\n"; FAIL=$((FAIL+1)); else printf "  ✓ 无崩溃\n"; PASS=$((PASS+1)); fi

say "结果：$PASS 通过 / $FAIL 失败"
echo "截图（屏幕内容需与音轨对上，看这几张）：$OUT"
ls "$OUT"/*.png 2>/dev/null | sed 's/^/  /'
[ "$FAIL" -eq 0 ]
