#!/usr/bin/env bash
# 仅提交 data 下「可版本化」的产品配置（不含圣经大 JSON），并 push。
# 调完曲库 / 自然 / relax / 品牌 后在本机执行即可，无需通过 AI。
#   npm run ship:data
#   npm run ship:data -- "chore: 调自然默认场景"
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PATHS=(
  "data/music-companion.json"
  "data/nature-settings.json"
  "data/relax-settings.json"
  "data/branding.json"
  "data/admin/generation-roles.json"
  "data/admin/mobile-content-flags.json"
  "data/bible/info-edition-v1-published.json"
  # 下面几个同样是 R2 配置镜像的数据源（见 scripts/build-mobile-config-r2.ts）
  "data/explore-modules/bundle.json"
  "data/explore-featured-articles/bundle.json"
  "data/legacy-figures-mobile.json"
)

for p in "${PATHS[@]}"; do
  if [[ -f "$p" ]]; then
    git add "$p"
  fi
done

DEFAULT_MSG="chore: ship data config $(date -u +"%Y-%m-%d %H:%MZ")"
MSG="${1:-$DEFAULT_MSG}"

if ! git diff --cached --quiet; then
  git commit -m "$MSG"
  echo "Committed: $MSG"
else
  echo "No staged changes in data config paths (nothing to commit)."
fi

BRANCH="$(git branch --show-current)"
echo "Pushing origin/$BRANCH …"
git push origin "$BRANCH"

# App 的 8 个配置接口在生产已 307 到 Cloudflare R2（见 next.config.mjs），
# 内容不再随部署更新——只 git push 的话，App 与网页会继续拿 R2 上的旧数据，
# 而且不报错、很难发现。所以这里必须同步推一次。
echo
echo "Syncing App config to R2 …"
npm run --silent mobile:config:push-r2

echo "Done."
