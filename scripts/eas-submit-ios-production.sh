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

if [[ -z "${ASC_API_KEY_PATH:-}" ]]; then
  echo ""
  echo "缺少 ASC_API_KEY_PATH。请先设置 App Store Connect API Key 文件路径，例如："
  echo "  export ASC_API_KEY_PATH=/absolute/path/AuthKey_xxx.p8"
  echo ""
  exit 1
fi

if [[ ! -f "${ASC_API_KEY_PATH}" ]]; then
  echo ""
  echo "ASC_API_KEY_PATH 指向的文件不存在：${ASC_API_KEY_PATH}"
  echo ""
  exit 1
fi

cd apps/askbible-mobile

echo "→ 提交最新 iOS production 构建到 App Store Connect…"
npx eas submit --profile production --platform ios --latest --non-interactive "$@"
