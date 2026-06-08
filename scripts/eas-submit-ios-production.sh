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

LATEST_IPA="$(ls -t build-*.ipa 2>/dev/null | head -1 || true)"
if [[ -n "${IOS_IPA_PATH:-}" && -f "${IOS_IPA_PATH}" ]]; then
  SUBMIT_PATH="$IOS_IPA_PATH"
elif [[ -n "$LATEST_IPA" && -f "$LATEST_IPA" ]]; then
  SUBMIT_PATH="$LATEST_IPA"
fi

if [[ -n "${SUBMIT_PATH:-}" ]]; then
  echo "→ 提交本机 IPA 到 App Store Connect…"
  echo "   $SUBMIT_PATH"
  npx eas submit --profile production --platform ios --path "$SUBMIT_PATH" --non-interactive "$@" || true
else
  echo "→ 提交最新 EAS 云端 iOS production 构建到 App Store Connect…"
  npx eas submit --profile production --platform ios --latest --non-interactive "$@" || true
fi

echo ""
echo "→ 挂到已有 TestFlight 外部测试组（无需重新添加测试员）…"
node "$ROOT/scripts/ios-testflight-distribute-latest.mjs"
