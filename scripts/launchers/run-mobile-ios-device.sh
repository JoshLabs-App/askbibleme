#!/usr/bin/env bash
# USB iPhone：安装 Release 独立包（默认 B 路径）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
exec bash "$ROOT/scripts/build-mobile-ios-device-standalone.sh"
