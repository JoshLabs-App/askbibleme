#!/usr/bin/env bash
# 本机 AAB 直传 Google Play（fastlane supply，不经 EAS / Expo Submit）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

PLAY_PACKAGE_NAME="${PLAY_PACKAGE_NAME:-me.askbible}"
PLAY_TRACK="${PLAY_TRACK:-internal}"
PLAY_RELEASE_STATUS="${PLAY_RELEASE_STATUS:-completed}"
PLAY_TIMEOUT_SECONDS="${PLAY_TIMEOUT_SECONDS:-1800}"

resolve_google_key() {
  local candidate
  for candidate in \
    "${GOOGLE_SERVICE_ACCOUNT_KEY_PATH:-}" \
    "$ROOT/AA/askbibleme-6e637caa2ceb.json" \
    "$ROOT/Aa/askbibleme-6e637caa2ceb.json"
  do
    if [[ -n "$candidate" && -f "$candidate" ]]; then
      printf '%s' "$candidate"
      return 0
    fi
  done
  return 1
}

if [[ -z "${GOOGLE_SERVICE_ACCOUNT_KEY_PATH:-}" ]]; then
  if DEFAULT_GOOGLE_KEY="$(resolve_google_key)"; then
    export GOOGLE_SERVICE_ACCOUNT_KEY_PATH="$DEFAULT_GOOGLE_KEY"
  fi
fi

if [[ -z "${GOOGLE_SERVICE_ACCOUNT_KEY_PATH:-}" || ! -f "${GOOGLE_SERVICE_ACCOUNT_KEY_PATH}" ]]; then
  echo "缺少 Google Play 服务账号密钥：GOOGLE_SERVICE_ACCOUNT_KEY_PATH" >&2
  echo "默认路径：$ROOT/AA/askbibleme-6e637caa2ceb.json" >&2
  exit 1
fi

if ! command -v fastlane >/dev/null 2>&1; then
  echo "未检测到 fastlane。请安装：brew install fastlane" >&2
  exit 1
fi

AAB_PATH="${ANDROID_AAB_PATH:-}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --path)
      AAB_PATH="${2:-}"
      shift 2
      ;;
    --track)
      PLAY_TRACK="${2:-}"
      shift 2
      ;;
    --release-status)
      PLAY_RELEASE_STATUS="${2:-}"
      shift 2
      ;;
    *)
      echo "未知参数：$1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$AAB_PATH" ]]; then
  LATEST_AAB="$ROOT/dist/mobile/askbible-android-latest.aab"
  if [[ -f "$LATEST_AAB" ]]; then
    AAB_PATH="$LATEST_AAB"
  fi
fi

if [[ -z "$AAB_PATH" || ! -f "$AAB_PATH" ]]; then
  echo "AAB 不存在。请先运行 npm run mobile:build:android:production" >&2
  exit 1
fi

echo "→ 直传 Google Play（不经 Expo）"
echo "   包名：$PLAY_PACKAGE_NAME"
echo "   轨道：$PLAY_TRACK"
echo "   状态：$PLAY_RELEASE_STATUS"
echo "   超时：$PLAY_TIMEOUT_SECONDS 秒"
echo "   AAB：$AAB_PATH"
echo "   账号：$GOOGLE_SERVICE_ACCOUNT_KEY_PATH"
echo ""

fastlane supply run \
  --package_name "$PLAY_PACKAGE_NAME" \
  --aab "$AAB_PATH" \
  --track "$PLAY_TRACK" \
  --release_status "$PLAY_RELEASE_STATUS" \
  --timeout "$PLAY_TIMEOUT_SECONDS" \
  --json_key "$GOOGLE_SERVICE_ACCOUNT_KEY_PATH" \
  --skip_upload_apk true \
  --skip_upload_metadata true \
  --skip_upload_changelogs true \
  --skip_upload_images true \
  --skip_upload_screenshots true

echo ""
echo "已提交到 Google Play (${PLAY_TRACK})。"
echo "https://play.google.com/console"
