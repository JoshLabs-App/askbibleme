#!/usr/bin/env bash
# Keep expo-video from rewriting AVAudioSession while AskBible native music owns it.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FILE="$ROOT/node_modules/expo-video/ios/VideoManager.swift"
MARKER='askbible.nativeMusicWantPlaying'
if [[ ! -f "$FILE" ]]; then
  echo "skip: expo-video VideoManager.swift missing"
  exit 0
fi
if grep -q "$MARKER" "$FILE"; then
  echo "ok: expo-video music session lock already present"
  exit 0
fi
python3 - <<'PY'
from pathlib import Path
path = Path("/Users/joshua/Desktop/APP/01AskBible/apps/askbible-mobile/node_modules/expo-video/ios/VideoManager.swift")
text = path.read_text()
needle = "  private func setAudioSession() {\n    let audioSession = AVAudioSession.sharedInstance()"
insert = """  private func setAudioSession() {
    // AskBible.me：原生音乐独占时勿改写 AVAudioSession（否则 moviePlayback+mixWithOthers
    // 会让系统不按 audio 后台模式保活，约 60s 挂起）。
    if UserDefaults.standard.bool(forKey: \"askbible.nativeMusicWantPlaying\") {
      return
    }
    let audioSession = AVAudioSession.sharedInstance()"""
if needle not in text:
    raise SystemExit("patch failed: setAudioSession anchor not found")
path.write_text(text.replace(needle, insert, 1))
print("patched expo-video VideoManager.swift")
PY
