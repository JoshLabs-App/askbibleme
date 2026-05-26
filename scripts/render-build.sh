#!/usr/bin/env bash
# Render Build Command: bash scripts/render-build.sh  （或 Dashboard 用 npm install && npm run build）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[render-build] node=$(node -v) npm=$(npm -v) NODE_ENV=${NODE_ENV:-} PWD=$ROOT"

if [[ ! -d node_modules/typescript || ! -d node_modules/tailwindcss ]]; then
  echo "[render-build] installing devDependencies …"
  npm install --include=dev --no-audit --no-fund
fi

npm run build
