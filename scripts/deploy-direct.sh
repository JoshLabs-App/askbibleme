#!/usr/bin/env bash
# 本机构建，直接上传产物。禁止远程构建或自动回退。
# bash scripts/deploy-direct.sh [已推送分支，默认 main]
# 本地公开构建配置：.env.web-build.local（gitignored）。服务端密钥由 Vercel 运行时注入。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [ "${1:-}" = --remote ]; then echo '禁止 Vercel 云端构建，请使用本机构建。' >&2; exit 1; fi
REF="${1:-main}"
git fetch -q origin "$REF"
SHA="$(git rev-parse "origin/$REF")"
if [ ! -d node_modules ] || ! git show "$SHA:package-lock.json" | cmp -s - package-lock.json; then
  echo '本地依赖与发布提交不一致；请先补齐依赖。不会回退云端构建。' >&2; exit 1
fi
TMP="$(mktemp -d "${TMPDIR:-/tmp}/askbible-deploy.XXXXXX")"
cleanup() {
  local status=$?
  if [ "$status" -eq 0 ]; then rm -rf "$TMP"; else echo "发布未完成，保留本地产物供重试：$TMP" >&2; fi
}
trap cleanup EXIT
git archive "$SHA" -- . ':!apps' | tar -x -C "$TMP"
find "$TMP" -type l -delete
mkdir -p "$TMP/.vercel"
cat > "$TMP/.vercel/project.json" <<'JSON'
{"projectId":"prj_oHQl74oMZUYpV9tocxDQDiDHc69G","orgId":"team_RKjYE5vcgJ8fEozF3W9N6PLE"}
JSON
cd "$TMP"
vercel pull --yes --environment=production >/dev/null
node "$ROOT/scripts/prepare-web-build-env.cjs" "$ROOT" "$TMP" "$SHA"
ln -s "$ROOT/node_modules" node_modules
export VERCEL_GIT_COMMIT_SHA="$SHA"
echo "本机构建 $REF @ $SHA …"
vercel build --prod --yes
if grep -R -l '\[SENSITIVE\]' .vercel/output/static/_next >/dev/null 2>&1; then
  echo '产物含配置占位符，停止发布。' >&2; exit 1
fi
# 本地构建完成后移除仅用于复用依赖的软链，不能把本机绝对路径传到部署端。
if [ -L node_modules ]; then unlink node_modules; fi
mkdir -p node_modules
vercel deploy --prebuilt --prod --archive=tgz --yes
echo "发布完成，预期 /app-build.json id=$SHA；继续核对正式站实际页面。"
