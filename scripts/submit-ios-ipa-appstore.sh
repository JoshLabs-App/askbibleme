#!/usr/bin/env bash
# 本机 IPA 直传 App Store Connect（xcrun altool + ASC API Key，不经 EAS / Expo Submit）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

ASC_API_KEY_ID="${EXPO_ASC_KEY_ID:-${ASC_API_KEY_ID:-9HDA27WY8C}}"
ASC_API_KEY_ISSUER_ID="${EXPO_ASC_ISSUER_ID:-${ASC_API_KEY_ISSUER_ID:-a56f0624-e4a4-438d-be5d-92403dd9969b}}"

if [[ -z "${ASC_API_KEY_PATH:-}" ]]; then
  DEFAULT_ASC_KEY="$ROOT/AA/AuthKey_9HDA27WY8C.p8"
  if [[ -f "$DEFAULT_ASC_KEY" ]]; then
    export ASC_API_KEY_PATH="$DEFAULT_ASC_KEY"
  fi
fi

if [[ -z "${ASC_API_KEY_PATH:-}" || ! -f "${ASC_API_KEY_PATH}" ]]; then
  echo "缺少 App Store Connect API Key：ASC_API_KEY_PATH" >&2
  echo "示例：export ASC_API_KEY_PATH=/absolute/path/AuthKey_xxx.p8" >&2
  exit 1
fi

IPA_PATH="${IOS_IPA_PATH:-}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --path)
      IPA_PATH="${2:-}"
      shift 2
      ;;
    *)
      echo "未知参数：$1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$IPA_PATH" ]]; then
  LATEST_IPA="$ROOT/dist/mobile/askbible-ios-latest.ipa"
  if [[ -f "$LATEST_IPA" ]]; then
    IPA_PATH="$LATEST_IPA"
  fi
fi

if [[ -z "$IPA_PATH" || ! -f "$IPA_PATH" ]]; then
  echo "IPA 不存在。请先运行 npm run mobile:build:ios:production" >&2
  exit 1
fi

KEY_DIR="$HOME/.appstoreconnect/private_keys"
mkdir -p "$KEY_DIR"
KEY_DEST="$KEY_DIR/AuthKey_${ASC_API_KEY_ID}.p8"
if [[ ! -f "$KEY_DEST" ]]; then
  cp "$ASC_API_KEY_PATH" "$KEY_DEST"
  chmod 600 "$KEY_DEST"
fi

echo "→ 直传 App Store Connect（不经 Expo）"
echo "   IPA：$IPA_PATH"
echo "   API Key：$ASC_API_KEY_ID"
echo ""

xcrun altool --upload-app \
  --type ios \
  --file "$IPA_PATH" \
  --apiKey "$ASC_API_KEY_ID" \
  --apiIssuer "$ASC_API_KEY_ISSUER_ID"

echo ""
echo "→ 挂到已有 TestFlight 外部测试组…"
node "$ROOT/scripts/ios-testflight-distribute-latest.mjs"

echo ""
echo "上传完成。请在 App Store Connect 等待处理完成后做 TestFlight 冒烟测试。"
