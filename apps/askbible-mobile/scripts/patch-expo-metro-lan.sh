#!/usr/bin/env bash
# Expo CLI Metro 默认只 listen 127.0.0.1；真机 Wi‑Fi 需 0.0.0.0（配合 REACT_NATIVE_PACKAGER_HOSTNAME）。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="$ROOT/node_modules/expo/node_modules/@expo/cli/build/src/start/server/metro/runServer-fork.js"
if [[ ! -f "$TARGET" ]]; then
  exit 0
fi
if grep -q 'REACT_NATIVE_PACKAGER_HOSTNAME ? .0.0.0.0' "$TARGET"; then
  exit 0
fi
python3 - "$TARGET" <<'PY'
import sys
path = sys.argv[1]
text = open(path, encoding="utf-8").read()
old = "        const listenHost = host ?? '127.0.0.1';"
new = "        const listenHost = host ?? (process.env.REACT_NATIVE_PACKAGER_HOSTNAME ? '0.0.0.0' : '127.0.0.1');"
if old not in text:
    sys.exit(0)
open(path, "w", encoding="utf-8").write(text.replace(old, new, 1))
PY
