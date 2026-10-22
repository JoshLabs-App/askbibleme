#!/usr/bin/env bash
# 把「更多 App」共用清单和图标传到 R2（DECISIONS D-42）：askbible-media/sibling-apps/
# 改完 data/sibling-apps/ 后跑：bash scripts/upload-sibling-apps.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ACCOUNT=652050e08d4a384c7cbe975ea02fb52c
BUCKET=askbible-media
CF="$(cat ~/.config/cloudflare/token)"
python3 -m json.tool "$ROOT/data/sibling-apps/apps.json" >/dev/null
put() { # <本地文件> <对象名> <类型>
  curl -sf -X PUT "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT/r2/buckets/$BUCKET/objects/$2" \
    -H "Authorization: Bearer $CF" -H "Content-Type: $3" --data-binary "@$1" >/dev/null && echo "ok  $2"
}
put "$ROOT/data/sibling-apps/apps.json" sibling-apps/apps.json "application/json; charset=utf-8"
for f in "$ROOT"/data/sibling-apps/icons/*.png; do
  put "$f" "sibling-apps/$(basename "$f")" image/png
done
