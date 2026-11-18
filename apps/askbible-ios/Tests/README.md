# Native account isolation regression checks

These XCTest cases compile the native Swift sources and use a separate XCTest runner bundle. Every HTTP request is intercepted by `URLProtocol`; no real login, account deletion, profile update, or reading-sync write is performed. The runner does not install or clear the AskBible app. Auth/sync metadata uses a temporary UserDefaults suite; reading-store fixtures use only the separate test runner's sandbox and are cleared before and after each case.

Requires local Xcode, an available iOS Simulator runtime, and XcodeGen:

```sh
IOS_TEST_SIMULATOR=<simulator-uuid> apps/askbible-ios/Tests/run-account-isolation.sh
```

The checks cover delayed verification and refresh after sign-out, concurrent login ordering, refresh coalescing and transient service failures, profile edits during token rotation, delayed reading-sync responses, persisted highlight cleanup, deletion failure preservation, and uploading highlight-only guest progress. They exercise the actual native auth client/store and sync engine with controlled HTTP responses; they do not establish external-provider OAuth or physical-device acceptance.

Generated projects, logs and results stay under `apps/askbible-ios/build/account-isolation/`. Remove generated build artifacts after verification, retaining only the needed text result evidence.
