#!/usr/bin/env bash
# Enable GitHub squash auto-merge on the current PR (or given number).
# Requires: label `auto-merge` on the PR + CI green (branch protection / --auto wait).
# NEVER pushes to main directly.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v gh >/dev/null 2>&1; then
  echo "✗ gh CLI required"
  exit 1
fi

PR="${1:-}"
if [[ -z "$PR" ]]; then
  PR="$(gh pr view --json number -q .number 2>/dev/null || true)"
fi
if [[ -z "$PR" ]]; then
  echo "✗ No PR number. Usage: $0 <pr-number>"
  exit 1
fi

LABEL="${AUTO_MERGE_LABEL:-auto-merge}"
echo "→ Ensure label '$LABEL' on PR #$PR"
gh pr edit "$PR" --add-label "$LABEL" 2>/dev/null \
  || gh label create "$LABEL" --description "CI green → squash auto-merge (never blind main)" --color "0E8A16" 2>/dev/null \
  || true
gh pr edit "$PR" --add-label "$LABEL"

echo "→ Enable squash --auto (waits for required checks)"
gh pr merge "$PR" --squash --auto --delete-branch=false

echo "✓ Auto-merge armed for PR #$PR (merges only when checks pass)"
echo "  Maestro is local/agent gate — not a GitHub required check unless you add a macOS runner."
