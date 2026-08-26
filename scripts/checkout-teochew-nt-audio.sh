#!/usr/bin/env bash
# 从分支 teochew-nt-audio 恢复 public/audio/teochew-nt（约 260 章 MP3，~692MB）
set -euo pipefail
# DEPRECATED: AskBible 不再托管潮语音频。仅当 FORCE_TEOCHEW_LOCAL_MIRROR=1 时继续。
if [[ "${FORCE_TEOCHEW_LOCAL_MIRROR:-}" != "1" ]]; then
  echo "Refusing: teochew-nt is external-only (TSTSCC). Set FORCE_TEOCHEW_LOCAL_MIRROR=1 to override." >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BRANCH="${TEOCHEW_AUDIO_GIT_REF:-teochew-nt-audio}"
DEFAULT_REMOTE="https://github.com/askbibleme/askbibleme.git"
REMOTE="${SELAH_GIT_REMOTE:-$DEFAULT_REMOTE}"
DEST="public/audio/teochew-nt"

count_mp3() {
  find "$DEST" -maxdepth 1 -name '*.mp3' 2>/dev/null | wc -l | tr -d ' '
}

ensure_git_origin() {
  if git remote get-url origin >/dev/null 2>&1; then
    return 0
  fi
  echo "Adding git remote origin (Render deploy often has no remotes) …" >&2
  git remote add origin "$REMOTE"
}

git_checkout_ref() {
  local ref="$1"
  mkdir -p "$DEST"
  git checkout "$ref" -- "$DEST"
}

restore_via_git() {
  local ref=""

  if git rev-parse --verify "${BRANCH}" >/dev/null 2>&1; then
    ref="${BRANCH}"
  elif git rev-parse --verify "origin/${BRANCH}" >/dev/null 2>&1; then
    ref="origin/${BRANCH}"
  else
    ensure_git_origin
    echo "Fetching ${BRANCH} (shallow) …" >&2
    if [ -n "${GITHUB_TOKEN:-}" ]; then
      local slug="${REMOTE#https://github.com/}"
      slug="${slug%.git}"
      GIT_TERMINAL_PROMPT=0 git fetch --depth=1 \
        "https://x-access-token:${GITHUB_TOKEN}@github.com/${slug}.git" \
        "${BRANCH}:${BRANCH}"
    else
      GIT_TERMINAL_PROMPT=0 git fetch --depth=1 origin "${BRANCH}" || \
        GIT_TERMINAL_PROMPT=0 git fetch --depth=1 origin "${BRANCH}:${BRANCH}"
    fi
    if git rev-parse --verify "origin/${BRANCH}" >/dev/null 2>&1; then
      ref="origin/${BRANCH}"
    elif git rev-parse --verify "${BRANCH}" >/dev/null 2>&1; then
      ref="${BRANCH}"
    fi
  fi

  if [ -z "$ref" ]; then
    return 1
  fi
  git_checkout_ref "$ref"
  echo "Restored ${DEST} from git ${ref} ($(count_mp3) mp3 files)."
}

restore_via_github_archive() {
  local slug="${SELAH_GITHUB_REPO:-askbibleme/askbibleme}"
  local url="https://github.com/${slug}/archive/refs/heads/${BRANCH}.tar.gz"
  local tmp
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT

  echo "Downloading ${url} (~692MB, one-time) …" >&2
  if [ -n "${GITHUB_TOKEN:-}" ]; then
    curl -fsSL -H "Authorization: Bearer ${GITHUB_TOKEN}" -L "$url" -o "${tmp}/archive.tar.gz"
  else
    curl -fsSL -L "$url" -o "${tmp}/archive.tar.gz"
  fi

  tar -xzf "${tmp}/archive.tar.gz" -C "${tmp}"
  local extracted
  extracted="$(find "${tmp}" -maxdepth 1 -mindepth 1 -type d | head -1)"
  if [ -z "$extracted" ] || [ ! -d "${extracted}/${DEST}" ]; then
    echo "Archive missing ${DEST}." >&2
    return 1
  fi

  mkdir -p "$DEST"
  cp -a "${extracted}/${DEST}/." "$DEST/"
  echo "Restored ${DEST} from GitHub archive ($(count_mp3) mp3 files)."
}

if [ "$(count_mp3)" -gt 200 ]; then
  echo "${DEST} already has $(count_mp3) mp3 files; skip restore."
  exit 0
fi

if restore_via_git; then
  exit 0
fi

echo "Git fetch failed; trying GitHub archive …" >&2
if restore_via_github_archive; then
  exit 0
fi

echo "Could not restore Teochew MP3s." >&2
echo "  • Push branch teochew-nt-audio first, or run: DATA_ROOT=/var/data npm run audio:teochew-pull-all-batches" >&2
exit 1
