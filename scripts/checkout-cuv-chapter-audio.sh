#!/usr/bin/env bash
# 从分支 cuv-chapter-audio 恢复 public/audio（约 1189 章 MP3，~900MB）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REF=""
if git rev-parse --verify cuv-chapter-audio >/dev/null 2>&1; then
  REF="cuv-chapter-audio"
elif git rev-parse --verify origin/cuv-chapter-audio >/dev/null 2>&1; then
  REF="origin/cuv-chapter-audio"
else
  echo "Fetching origin/cuv-chapter-audio …" >&2
  git fetch origin cuv-chapter-audio:cuv-chapter-audio 2>/dev/null || git fetch origin cuv-chapter-audio
  if git rev-parse --verify origin/cuv-chapter-audio >/dev/null 2>&1; then
    REF="origin/cuv-chapter-audio"
  elif git rev-parse --verify cuv-chapter-audio >/dev/null 2>&1; then
    REF="cuv-chapter-audio"
  else
    echo "Missing branch cuv-chapter-audio. Cannot restore MP3s." >&2
    exit 1
  fi
fi

git checkout "$REF" -- public/audio
count="$(find public/audio -maxdepth 1 -name '*.mp3' 2>/dev/null | wc -l | tr -d ' ')"
echo "Restored public/audio from ${REF} (${count} mp3 files)."
