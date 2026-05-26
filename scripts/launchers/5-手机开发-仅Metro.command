#!/bin/bash
# 双击：网站 API + Expo Metro（不自动开模拟器；在终端按 i / a）
# 首次若被 macOS 拦截：右键 → 打开

set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
exec bash "$HERE/run-mobile-dev.sh" metro
