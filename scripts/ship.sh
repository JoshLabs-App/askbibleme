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
echo "Done."
