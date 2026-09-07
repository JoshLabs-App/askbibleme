#!/usr/bin/env bash
# AskBible.me — Render Build Command（在 Dashboard 填：bash scripts/render-build.sh）
# Render 会先跑默认 npm install；production 环境可能缺 devDependencies，此脚本补齐后再 build。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[render-build] node=$(node -v) npm=$(npm -v) NODE_ENV=${NODE_ENV:-} PWD=$ROOT"

if [[ ! -d node_modules/typescript || ! -d node_modules/tailwindcss ]]; then
  echo "[render-build] dev toolchain missing; running npm install --include=dev …"
  npm install --include=dev --no-audit --no-fund
fi

# 堆上限在脚本内兜底，不依赖 Dashboard 的 NODE_OPTIONS：render.yaml 对已有服务不会自动
# 生效，若那边仍是 4096，探索页预取全语言经文会在 next build 阶段耗尽堆
# （Ineffective mark-compacts near heap limit）。取两者较大值，Dashboard 设得更高时不覆盖它。
current_heap="$(printf '%s' "${NODE_OPTIONS:-}" | sed -n 's/.*--max-old-space-size=\([0-9]*\).*/\1/p')"
want_heap=8192
if [[ -z "$current_heap" || "$current_heap" -lt "$want_heap" ]]; then
  export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=${want_heap}"
  echo "[render-build] heap raised: NODE_OPTIONS=$NODE_OPTIONS"
fi

npm run build
