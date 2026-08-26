#!/usr/bin/env bash
# Keep only one packaged build per kind under dist/mobile.
# Safe to run anytime; called automatically after successful AAB / IPA / APK builds.
# Does NOT touch Gradle caches, Xcode DerivedData, or Metro caches (those affect rebuild speed).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${MOBILE_DIST_DIR:-$ROOT/dist/mobile}"
KEEP_TEMP="${MOBILE_DIST_KEEP_TEMP:-0}"

if [[ ! -d "$OUT" ]]; then
  echo "→ dist/mobile 不存在，跳过清理"
  exit 0
fi

bytes_before="$(du -sk "$OUT" 2>/dev/null | awk '{print $1}')"
removed=0

prune_kind() {
  local pattern="$1"
  local keep="$2"
  local f
  shopt -s nullglob
  for f in "$OUT"/$pattern; do
    if [[ -n "$keep" && "$(basename "$f")" == "$(basename "$keep")" ]]; then
      continue
    fi
    rm -f "$f"
    removed=$((removed + 1))
    echo "  删除 $(basename "$f")"
  done
  shopt -u nullglob
}

echo "→ 清理 dist/mobile（每种产物只留一版）…"

# Prefer *-latest; if missing, keep the newest stamped file and rename to latest.
ensure_latest() {
  local glob_pat="$1"
  local latest_name="$2"
  local latest="$OUT/$latest_name"
  if [[ -f "$latest" ]]; then
    prune_kind "$glob_pat" "$latest"
    return
  fi
  shopt -s nullglob
  local candidates=("$OUT"/$glob_pat)
  shopt -u nullglob
  if [[ ${#candidates[@]} -eq 0 ]]; then
    return
  fi
  local newest
  newest="$(ls -t "${candidates[@]}" | head -1)"
  if [[ "$(basename "$newest")" != "$latest_name" ]]; then
    cp "$newest" "$latest"
    echo "  提升为 latest: $(basename "$newest") → $latest_name"
  fi
  prune_kind "$glob_pat" "$latest"
}

ensure_latest "askbible-android-*.aab" "askbible-android-latest.aab"
ensure_latest "askbible-android-*.apk" "askbible-android-latest.apk"
ensure_latest "askbible-ios-*.ipa" "askbible-ios-latest.ipa"

# Drop leftover export/archive dirs under ios/build (rebuild speed unaffected:
# next release build already recreates them).
if [[ "$KEEP_TEMP" != "1" ]]; then
  for d in \
    "$ROOT/apps/askbible-mobile/ios/build/export" \
    "$ROOT/apps/askbible-mobile/ios/build/"*.xcarchive
  do
    if [[ -e "$d" ]]; then
      rm -rf "$d"
      removed=$((removed + 1))
      echo "  删除临时 $(basename "$d")"
    fi
  done
fi

bytes_after="$(du -sk "$OUT" 2>/dev/null | awk '{print $1}')"
freed_mb=$(( (bytes_before - bytes_after) / 1024 ))
if [[ "$freed_mb" -lt 0 ]]; then freed_mb=0; fi

if [[ "$freed_mb" -gt 0 ]]; then
  echo "✓ dist/mobile 清理完成（删除 ${removed} 项，约释放 ${freed_mb} MB）"
else
  echo "✓ dist/mobile 清理完成（删除 ${removed} 项）"
fi
du -sh "$OUT" 2>/dev/null | awk '{print "  当前体积: " $1}'
