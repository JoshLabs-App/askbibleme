#!/usr/bin/env bash
set -euo pipefail
IOS_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEST_BUILD="$IOS_ROOT/build/account-isolation"
mkdir -p "$TEST_BUILD"
sed -e "s|path: ../AskBible|path: $IOS_ROOT/AskBible|" \
    -e "s|path: AccountIsolationTests.swift|path: $IOS_ROOT/Tests/AccountIsolationTests.swift|" \
    "$IOS_ROOT/Tests/project.yml" > "$TEST_BUILD/project.yml"
xcodegen generate --spec "$TEST_BUILD/project.yml" --project "$TEST_BUILD" >/dev/null
# Uses a dedicated XCTest runner bundle; it never installs or clears the user's AskBible app.
xcodebuild -project "$TEST_BUILD/AskBibleAccountIsolation.xcodeproj" -scheme AccountIsolationTests \
  -destination "platform=iOS Simulator,id=${IOS_TEST_SIMULATOR:?Set IOS_TEST_SIMULATOR to an available simulator UUID}" \
  -derivedDataPath "$TEST_BUILD/DerivedData" -resultBundlePath "$TEST_BUILD/results-$(date +%s).xcresult" \
  CODE_SIGNING_ALLOWED=NO COMPILER_INDEX_STORE_ENABLE=NO test "$@"
