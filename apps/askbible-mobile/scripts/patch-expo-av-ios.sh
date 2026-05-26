#!/usr/bin/env bash
# expo-av: `isPlayable` KVO can SIGSEGV on iOS 16+ device Release builds.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="$ROOT/node_modules/expo-av/ios/EXAV/EXAVPlayerData.m"
if [[ ! -f "$TARGET" ]]; then
  exit 0
fi
if grep -q 'removed `isPlayable` as a KVO key' "$TARGET"; then
  exit 0
fi
python3 - "$TARGET" <<'PY'
import sys
path = sys.argv[1]
text = open(path, encoding="utf-8").read()
old = """  [avAsset loadValuesAsynchronouslyForKeys:@[ @\\"isPlayable\\", @\\"duration\\" ] completionHandler:^{
    EX_ENSURE_STRONGIFY(self);
    NSError *error = nil;
    AVKeyValueStatus status = [avAsset statusOfValueForKey:@\\"isPlayable\\" error:&error];

    if (status == AVKeyValueStatusLoaded && !avAsset.isPlayable) {"""
new = """  // iOS 16+ removed `isPlayable` as a KVO key; loading it can SIGSEGV on device Release builds.
  [avAsset loadValuesAsynchronouslyForKeys:@[ @\\"duration\\" ] completionHandler:^{
    EX_ENSURE_STRONGIFY(self);

    if (!avAsset.isPlayable) {"""
if old not in text:
    sys.exit(0)
open(path, "w", encoding="utf-8").write(text.replace(old, new, 1))
PY
