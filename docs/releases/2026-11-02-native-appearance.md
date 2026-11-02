# In-app appearance selection — 2026-11-02

The user menu now offers System, Light, and Dark appearance in simplified/traditional Chinese and English. Defaults remain System; choices persist locally across launches. iOS uses AppStorage and the window color-scheme preference. Android provides one reactive palette to screens, sheets, cards, and update dialogs and follows system night mode only when System is selected. The parchment texture is reduced consistently in dark mode, including the bottom playback surface.

## Validation

- iOS Release simulator build and signed archive/export passed. Real UI taps exercised Light/Dark switching and process restart persistence. System mode changed to dark after changing the simulator's system appearance. Screenshots inspected.
- Android signed sideload APK, Web APK, and release AAB builds passed. Emulator UI taps exercised Light/Dark switching, process restart persistence, and System selection. System night mode and the selected System chip were inspected. Screenshots retained.
- Site-copy generation/check: 431 strings across Swift/Kotlin; design-token parity: 358 values passed.
- Samsung now has the Play edition. A separate sideload test app was installed without altering the Play installation or its data. Device interaction changed during testing, so final acceptance uses the isolated emulator; do not claim a completed physical-device regression.
- Test-only artifacts and automation stayed outside release sources. Main checkout's concurrent TV/playback changes were excluded.

## Release

Target: iOS 1.1.5 (138), Android 1.0.52 (249). Store and download receipts recorded after publication.
