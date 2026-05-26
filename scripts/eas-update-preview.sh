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

cd apps/askbible-mobile

PROJECT_ID="$(
  npx expo config --type public --json | node -e '
    let raw = "";
    process.stdin.on("data", (d) => (raw += d));
    process.stdin.on("end", () => {
      try {
        const cfg = JSON.parse(raw);
        const id = cfg?.extra?.eas?.projectId ?? "";
        process.stdout.write(String(id));
      } catch {
        process.stdout.write("");
      }
    });
  '
)"

if [[ -z "${PROJECT_ID}" ]]; then
  echo ""
  echo "当前项目还未绑定 EAS projectId。请先执行："
  echo "  npx eas init"
  echo ""
  exit 1
fi

cd "$ROOT"

echo "→ 同步移动端内容（JSON/SQLite/音频清单）…"
npm run mobile:sync-content
echo "→ 同步离线媒体（视频/海报/音乐）…"
MOBILE_BUNDLE_OFFLINE_MEDIA=1 npm run mobile:sync-offline-media

# 发布到 preview 时强制使用线上地址，避免读取本机 .env.local 的 localhost 配置。
export EXPO_PUBLIC_ASKBIBLE_BASE_URL="https://askbible.me"
export EXPO_PUBLIC_MOBILE_BUNDLED_ONLY="0"
export MOBILE_BUNDLE_OFFLINE_MEDIA="1"

MESSAGE="${*:-preview update $(date '+%Y-%m-%d %H:%M:%S')}"

cd apps/askbible-mobile
echo "→ 发布 OTA 到 preview channel（iOS）…"
npx eas update --channel preview --platform ios --message "$MESSAGE (ios)" --clear-cache

echo "→ 发布 OTA 到 preview channel（Android）…"
npx eas update --channel preview --platform android --message "$MESSAGE (android)" --clear-cache
