#!/usr/bin/env bash
# 本机构建并直发 Cloudflare Workers（askbible-web）。禁止远程/Git 自动构建。
# bash scripts/deploy-direct.sh [已推送分支，默认 main]
# 本地公开构建配置：.env.web-build.local（gitignored）。服务端密钥由 Cloudflare Worker Secrets 注入。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [ "${1:-}" = --remote ]; then echo '禁止云端构建，请使用本机构建并直发 Cloudflare Workers。' >&2; exit 1; fi
REF="${1:-main}"
git fetch -q origin "$REF"
SHA="$(git rev-parse "origin/$REF")"
if [ ! -d node_modules ] || ! git show "$SHA:package-lock.json" | cmp -s - package-lock.json; then
  echo '本地依赖与发布提交不一致；请先补齐依赖。不会回退云端构建。' >&2; exit 1
fi
TMP="$(mktemp -d "${TMPDIR:-/tmp}/askbible-cf-deploy.XXXXXX")"
cleanup() {
  local status=$?
  if [ "$status" -eq 0 ]; then rm -rf "$TMP"; else echo "发布未完成，保留本地产物供重试：$TMP" >&2; fi
}
trap cleanup EXIT
git archive "$SHA" -- . ':!apps' | tar -x -C "$TMP"
find "$TMP" -type l -delete
if [ -f "$ROOT/.env.web-build.local" ]; then
  cp "$ROOT/.env.web-build.local" "$TMP/.env.production.local"
fi
cd "$TMP"
if [ "$(uname -s)" = Darwin ]; then
  cp -cR "$ROOT/node_modules" node_modules
else
  cp -a "$ROOT/node_modules" node_modules
fi
export NEXT_PUBLIC_APP_BUILD_ID="$SHA"
export NODE_ENV=production
export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-652050e08d4a384c7cbe975ea02fb52c}"
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ] && [ -f "$HOME/.config/cloudflare/token" ]; then
  CLOUDFLARE_API_TOKEN="$(tr -d '[:space:]' < "$HOME/.config/cloudflare/token")"
  export CLOUDFLARE_API_TOKEN
fi
echo "本机构建 Cloudflare Worker (askbible-web) $REF @ $SHA …"
npm run prebuild
npx cf build
BASE_NODE_OPTS="${NODE_OPTIONS:-}"
DEPLOYED=0
for pass in 1 2 3; do
  if [ "$pass" = "2" ]; then
    NET_FLAG="--dns-result-order=ipv4first"
  else
    NET_FLAG="--network-family-autoselection"
  fi
  if NODE_OPTIONS="$NET_FLAG $BASE_NODE_OPTS" WRANGLER_SEND_METRICS=false npx cf deploy --prebuilt; then
    DEPLOYED=1
    break
  fi
  if [ "$pass" -lt 3 ]; then
    echo "⚠️ 第 ${pass} 轮部署网络波动，切换双栈策略续传重试（$((pass + 1))/3）…"
    sleep $((pass * 2))
  fi
done
[ "$DEPLOYED" = "1" ] || exit 1
echo "发布完成，预期 /api/app-build id=${SHA}；继续核对正式站（https://askbible.me）实际页面。"
