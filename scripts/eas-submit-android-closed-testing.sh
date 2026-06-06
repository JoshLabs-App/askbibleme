#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! npx eas whoami >/dev/null 2>&1; then
  echo ""
  echo "尚未登录 Expo。请先执行："
  echo "  cd apps/askbible-mobile && npx eas login"
  echo ""
  exit 1
fi

if [[ -z "${GOOGLE_SERVICE_ACCOUNT_KEY_PATH:-}" ]]; then
  echo ""
  echo "缺少 GOOGLE_SERVICE_ACCOUNT_KEY_PATH。请先设置 Google Play Service Account Key 路径，例如："
  echo "  export GOOGLE_SERVICE_ACCOUNT_KEY_PATH=/absolute/path/google-play-service-account.json"
  echo ""
  exit 1
fi

if [[ ! -f "${GOOGLE_SERVICE_ACCOUNT_KEY_PATH}" ]]; then
  echo ""
  echo "GOOGLE_SERVICE_ACCOUNT_KEY_PATH 指向的文件不存在：${GOOGLE_SERVICE_ACCOUNT_KEY_PATH}"
  echo ""
  exit 1
fi

cd apps/askbible-mobile

echo "→ 提交最新 Android production 构建到 Google Play 封闭测试（alpha）…"
npx eas submit --profile closed_testing --platform android --latest --non-interactive "$@"
