#!/bin/bash
# 双击：拉起 Android 模拟器（若无）并重启 AskBible.me
# 首次若被 macOS 拦截：右键 → 打开
# 终端等价：npm run mobile:android:restart

HERE="$(cd "$(dirname "$0")" && pwd)"
STATUS=0
bash "$HERE/restart-android-app.sh" || STATUS=$?

echo ""
if [[ "$STATUS" -ne 0 ]]; then
  echo "✗ 未成功（退出码 $STATUS）。请把上方完整输出保留以便排查。"
  echo ""
fi
read -r -p "按回车关闭此窗口…" _
exit "$STATUS"
