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

echo "→ 同步图标与离线内容…"
npm run mobile:sync-icons
npm run mobile:sync-content
# Bundle music/nature offline media into release assets.
MOBILE_BUNDLE_OFFLINE_MEDIA=1 \
MOBILE_BUNDLE_MUSIC_LIMIT=1 \
MOBILE_STARTER_MUSIC_TRACK_ID=track-mpg4a7xcip5q \
npm run mobile:sync-offline-media

echo "→ 离线媒体体积审计…"
du -sh apps/askbible-mobile/assets/nature/videos apps/askbible-mobile/assets/music/tracks apps/askbible-mobile/assets/audio 2>/dev/null || true
node - <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(process.cwd(), "apps/askbible-mobile/assets");
function dirBytes(p) {
  if (!fs.existsSync(p)) return 0;
  let n = 0;
  for (const f of fs.readdirSync(p)) {
    const fp = path.join(p, f);
    const st = fs.statSync(fp);
    n += st.isDirectory() ? dirBytes(fp) : st.size;
  }
  return n;
}
const musicTracks = dirBytes(path.join(root, "music/tracks"));
const mb = (n) => (n / (1024 * 1024)).toFixed(1);
console.log(`bundled music tracks: ${mb(musicTracks)} MB (${fs.existsSync(path.join(root,"music/tracks")) ? fs.readdirSync(path.join(root,"music/tracks")).length : 0} file(s))`);
if (musicTracks > 80 * 1024 * 1024) {
  console.error("ERROR: bundled music exceeds 80MB — check MOBILE_BUNDLE_MUSIC_LIMIT before building.");
  process.exit(1);
}
NODE

cd apps/askbible-mobile

echo "→ 提交 EAS Android production 构建（AAB）…"
EXPO_PUBLIC_MOBILE_OFFLINE_FIRST=0 \
EXPO_PUBLIC_MOBILE_BUNDLED_ONLY=0 \
EXPO_PUBLIC_MEMBER_REGISTER_ENABLED=1 \
EXPO_PUBLIC_ASKBIBLE_BASE_URL="https://askbible.me" \
MOBILE_BUNDLE_OFFLINE_MEDIA=1 \
npx eas build --profile production --platform android --non-interactive "$@"
