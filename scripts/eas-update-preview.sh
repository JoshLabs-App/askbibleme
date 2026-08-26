#!/usr/bin/env bash
# 发布 JS 热更新到 preview channel（真机需已装 Preview OTA 壳）
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
        const start = raw.indexOf("{");
        const cfg = JSON.parse(start >= 0 ? raw.slice(start) : raw);
        const id = cfg?.extra?.eas?.projectId ?? "";
        process.stdout.write(String(id));
      } catch {
        process.stdout.write("");
      }
    });
  '
)"

RUNTIME_VERSION="$(
  npx expo config --type public --json | node -e '
    let raw = "";
    process.stdin.on("data", (d) => (raw += d));
    process.stdin.on("end", () => {
      try {
        const start = raw.indexOf("{");
        const cfg = JSON.parse(start >= 0 ? raw.slice(start) : raw);
        process.stdout.write(String(cfg?.runtimeVersion ?? cfg?.version ?? ""));
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

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  AskBible.me · 发布 Preview OTA"
echo "  channel: preview"
echo "  runtimeVersion: ${RUNTIME_VERSION:-unknown}"
echo "  真机需已装："
echo "    npm run mobile:build:preview:ios"
echo "    npm run mobile:build:preview:android"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Ensure channel exists (idempotent)
(
  cd apps/askbible-mobile
  npx eas channel:view preview >/dev/null 2>&1 \
    || npx eas channel:create preview
) || true

echo "→ 同步移动端内容（JSON/SQLite/音频清单）…"
npm run mobile:sync-content
echo "→ 同步离线媒体（视频/海报/音乐）…"
MOBILE_BUNDLE_OFFLINE_MEDIA=1 npm run mobile:sync-offline-media

# 发布到 preview 时强制使用线上地址，避免读取本机 .env.local 的 localhost 配置。
export EXPO_PUBLIC_ASKBIBLE_BASE_URL="https://askbible.me"
export EXPO_PUBLIC_MOBILE_BUNDLED_ONLY="1"
export MOBILE_BUNDLE_OFFLINE_MEDIA="1"

MESSAGE="${*:-preview update $(date '+%Y-%m-%d %H:%M:%S')}"

cd apps/askbible-mobile
echo "→ 发布 OTA 到 preview channel（iOS）…"
npx eas update --channel preview --platform ios --message "$MESSAGE (ios)" --clear-cache

echo "→ 发布 OTA 到 preview channel（Android）…"
npx eas update --channel preview --platform android --message "$MESSAGE (android)" --clear-cache

echo ""
echo "✓ 已发布。真机完全退出 App 再打开 1～2 次即可拉到更新（电脑可关机）。"
echo ""
