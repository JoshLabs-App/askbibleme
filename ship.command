#!/bin/bash
# 在访达中双击本文件：会在终端里执行推送脚本（等同 npm run ship）。
cd "$(dirname "$0")" || exit 1
bash scripts/ship.sh
echo
read -r -p "按回车关闭窗口…" _
