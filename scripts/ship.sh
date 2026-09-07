#!/usr/bin/env bash
# 一键：暂存全部改动 → 提交 → 推送到 origin（当前分支）。
# 用法：
#   ./scripts/ship.sh
#   ./scripts/ship.sh "feat: 说明这次改了什么"
#   npm run ship
#   npm run ship -- "fix: 修正某问题"
#
# macOS：可在终端执行；若要在访达里双击，需先 chmod +x，且系统可能仍用编辑器打开——更稳妥是在项目里用终端或 npm run ship。

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DEFAULT_MSG="chore: ship $(date -u +"%Y-%m-%d %H:%MZ")"
MSG="${1:-$DEFAULT_MSG}"

git add -A

if ! git diff --cached --quiet; then
  git commit -m "$MSG"
  echo "Committed: $MSG"
else
  echo "No file changes to commit (tree matches last commit)."
fi

BRANCH="$(git branch --show-current)"
echo "Pushing origin/$BRANCH …"
git push origin "$BRANCH"

# App 的 8 个配置接口在生产已 307 到 Cloudflare R2（见 next.config.mjs），内容不再随
# 部署更新。这次若动了它们的数据源，只 git push 等于没更新——App 与网页会继续拿 R2 上
# 的旧数据，且不报错。故检测到就顺手推一次。
CONFIG_SOURCES=(
  "data/music-companion.json"
  "data/nature-settings.json"
  "data/admin/mobile-content-flags.json"
  "data/explore-modules/bundle.json"
  "data/explore-featured-articles/bundle.json"
  "data/legacy-figures-mobile.json"
  "data/bible-reading-plans"
)
if git diff --name-only HEAD~1..HEAD 2>/dev/null | grep -qF -f <(printf '%s\n' "${CONFIG_SOURCES[@]}"); then
  echo
  echo "本次改动涉及 App 配置数据源，同步到 R2 …"
  npm run --silent mobile:config:push-r2
fi

echo "Done."
