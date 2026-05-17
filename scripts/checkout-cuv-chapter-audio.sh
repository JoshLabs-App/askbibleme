#!/usr/bin/env bash
# 从本地分支 cuv-chapter-audio 恢复 public/audio（约 1189 章 MP3，~900MB）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! git rev-parse --verify cuv-chapter-audio >/dev/null 2>&1; then
  echo "Missing branch cuv-chapter-audio. Cannot restore MP3s." >&2
  exit 1
fi

git checkout cuv-chapter-audio -- public/audio
count="$(find public/audio -maxdepth 1 -name '*.mp3' 2>/dev/null | wc -l | tr -d ' ')"
echo "Restored public/audio (${count} mp3 files)."
