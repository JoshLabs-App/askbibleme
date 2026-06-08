#!/usr/bin/env bash
# Google Play 内部测试：直传商店（不经 EAS / Expo Submit）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/submit-android-aab-play.sh" --track internal --release-status completed "$@"
