#!/usr/bin/env bash
# 仅提交 data 下「可版本化」的产品配置（不含圣经大 JSON），并 push。
# 调完曲库 / 自然 / relax / 品牌 / 播放视觉 后在本机执行即可，无需通过 AI。
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
  "data/music-visual-console.json"
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
echo "Done."
