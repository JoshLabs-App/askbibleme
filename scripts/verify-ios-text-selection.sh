#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TASK_DIR="${IOS_SELECTION_WORK_DIR:-/tmp/askbible-text-selection}"
mkdir -p "$TASK_DIR/tests"
command -v xcodegen >/dev/null
SIM_ID="${IOS_SELECTION_SIM_UDID:-}"
if [[ -z "$SIM_ID" ]]; then
  SIM_ID="$(xcrun simctl list devices available --json | python3 -c 'import sys,json; print(next((d["udid"] for ds in json.load(sys.stdin)["devices"].values() for d in ds if d["name"] == "AskBible 选择验收"), ""))')"
fi
if [[ -z "$SIM_ID" ]]; then
  RUNTIME_ID="$(xcrun simctl list runtimes --json | python3 -c 'import sys,json; r=[r for r in json.load(sys.stdin)["runtimes"] if r["isAvailable"] and "iOS" in r["name"]]; print(sorted(r,key=lambda x:tuple(map(int,x["version"].split("."))))[-1]["identifier"])')"
  SIM_ID="$(xcrun simctl create 'AskBible 选择验收' com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro "$RUNTIME_ID")"
fi
xcrun simctl boot "$SIM_ID" 2>/dev/null || true
xcrun simctl bootstatus "$SIM_ID" -b
xcodebuild -project "$ROOT/apps/askbible-ios/AskBible.xcodeproj" -scheme AskBible \
  -configuration Debug -sdk iphonesimulator -destination "id=$SIM_ID" \
  -derivedDataPath "$TASK_DIR/app-build" CODE_SIGNING_ALLOWED=NO build > "$TASK_DIR/build.log" 2>&1
xcrun simctl install "$SIM_ID" "$TASK_DIR/app-build/Build/Products/Debug-iphonesimulator/AskBible.app"
cp "$ROOT/tools/ios-selection-ui/SelectionTests.swift" "$ROOT/tools/ios-selection-ui/project.yml" "$TASK_DIR/tests/"
xcodegen generate --spec "$TASK_DIR/tests/project.yml" --project "$TASK_DIR/tests"
if (( $# )); then CASES=("$@"); else CASES=(testSingleVerseCopy testDragAcrossParagraphs testBookmarkPersists); fi
for CASE in "${CASES[@]}"; do
  xcodebuild -project "$TASK_DIR/tests/SelectionAcceptance.xcodeproj" -scheme SelectionTests \
    -destination "id=$SIM_ID" -derivedDataPath "$TASK_DIR/test-build" \
    -only-testing:"SelectionTests/SelectionTests/$CASE" CODE_SIGNING_ALLOWED=NO test > "$TASK_DIR/$CASE.log" 2>&1
  if [[ "$CASE" != testBookmarkPersists ]]; then
    xcrun simctl pbpaste "$SIM_ID" > "$TASK_DIR/$CASE.txt"
    python3 - "$TASK_DIR/$CASE.txt" "$CASE" <<'PY'
import pathlib,sys
text=pathlib.Path(sys.argv[1]).read_text()
if sys.argv[2] == 'testSingleVerseCopy':
    assert text == '创世记 1:1\n1\u2002起初神创造天地。', repr(text)
else:
    assert text.startswith('创世记 1:1–'), repr(text[:80])
    assert '2\u2002地是空虚混沌' in text and '26\u2002神说' in text, repr(text)
print(sys.argv[2] + ': clipboard verified')
PY
  fi
  echo "$CASE passed"
done
echo "Evidence: $TASK_DIR/test-build/Logs/Test"
