#!/usr/bin/env bash
# expo-sqlite: add a small Swift compatibility shim so the module imports SQLite3 cleanly.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="$ROOT/node_modules/expo-sqlite/ios/SQLiteCompat.swift"
mkdir -p "$(dirname "$TARGET")"
if [[ -f "$TARGET" ]] && grep -q '^import SQLite3$' "$TARGET"; then
  exit 0
fi
python3 - "$TARGET" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
path.write_text(
    "import SQLite3\n\n"
    "// Compatibility shim for ExpoSQLite Swift module build.\n",
    encoding="utf-8",
)
PY
