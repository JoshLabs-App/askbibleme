#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TASK_DIR="${DEVOTIONAL_VERIFY_DIR:-/tmp/askbible-devotional-acceptance}"
SIM_ID="${DEVOTIONAL_SIM_UDID:?Set DEVOTIONAL_SIM_UDID to an available iOS simulator}"
mkdir -p "$TASK_DIR"
swiftc "$ROOT/apps/askbible-ios/AskBible/Model/PlanDevotionalHandoff.swift" \
  "$ROOT/tools/swift-harness/devotional-handoff/main.swift" -o "$TASK_DIR/policy-check"
"$TASK_DIR/policy-check"
cp "$ROOT/tools/devotional-acceptance/"*.swift "$TASK_DIR/"
python3 - "$ROOT" "$TASK_DIR" <<'PY'
import json,sys,wave,struct,math
from pathlib import Path
root,work=map(Path,sys.argv[1:])
with wave.open(str(work/'chapter.wav'),'wb') as w:
    w.setparams((1,2,16000,0,'NONE','not compressed'))
    w.writeframes(b''.join(struct.pack('<h',int(math.sin(i*440*math.tau/16000)*1000)) for i in range(24000)))
project={
 'name':'DevotionalAcceptance',
 'settings':{'base':{'IPHONEOS_DEPLOYMENT_TARGET':'17.0','SWIFT_VERSION':'5.0'}},
 'targets':{
  'Harness':{'type':'application','platform':'iOS',
   'sources':[{'path':str(root/'apps/askbible-ios/AskBible'),'excludes':['AskBibleApp.swift','Resources','Assets.xcassets']},'Harness.swift',{'path':'chapter.wav','buildPhase':'resources'}],
   'settings':{'base':{'PRODUCT_BUNDLE_IDENTIFIER':'me.askbible.devotional.acceptance','GENERATE_INFOPLIST_FILE':'YES','INFOPLIST_KEY_UIBackgroundModes':['audio'],'INFOPLIST_KEY_UILaunchScreen_Generation':'YES'}}},
  'AcceptanceTests':{'type':'bundle.ui-testing','platform':'iOS','sources':['AcceptanceTests.swift'],
   'settings':{'base':{'PRODUCT_BUNDLE_IDENTIFIER':'me.askbible.devotional.acceptance.tests','GENERATE_INFOPLIST_FILE':'YES','TEST_TARGET_NAME':'Harness'}}}},
 'schemes':{'Harness':{'build':{'targets':{'Harness':'all','AcceptanceTests':['test']}},'test':{'targets':['AcceptanceTests']}}}}
(work/'project.json').write_text(json.dumps(project))
PY
xcodegen generate --spec "$TASK_DIR/project.json" --project "$TASK_DIR"
xcodebuild -project "$TASK_DIR/DevotionalAcceptance.xcodeproj" -scheme Harness \
  -destination "id=$SIM_ID" -derivedDataPath "$TASK_DIR/build" CODE_SIGNING_ALLOWED=NO test > "$TASK_DIR/test.log" 2>&1
printf 'PASS: devotional playback acceptance. Evidence: %s\n' "$TASK_DIR/test.log"
