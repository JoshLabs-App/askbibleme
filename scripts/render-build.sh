#!/usr/bin/env bash
# AskBible.me — Render Build Command（在 Dashboard 填：bash scripts/render-build.sh）
# Render 会先跑默认 npm install；production 环境可能缺 devDependencies，此脚本补齐后再 build。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -d node_modules/typescript || ! -d node_modules/tailwindcss ]]; then
  echo "[render-build] dev toolchain missing; running npm install --include=dev …"
  npm install --include=dev --no-audit --no-fund
fi

npm run build
