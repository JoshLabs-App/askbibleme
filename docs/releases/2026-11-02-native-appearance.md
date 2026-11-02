# In-app appearance selection — 2026-11-02

The user menu now offers System, Light, and Dark appearance in simplified/traditional Chinese and English. Defaults remain System; choices persist locally across launches. iOS uses AppStorage and the window color-scheme preference. Android provides one reactive palette to screens, sheets, cards, and update dialogs and follows system night mode only when System is selected. The parchment texture is reduced consistently in dark mode, including the bottom playback surface.

## Validation

- iOS Release simulator build and signed archive/export passed. Real UI taps exercised Light/Dark switching and process restart persistence. System mode changed to dark after changing the simulator's system appearance. Screenshots inspected.
- Android signed sideload APK, Web APK, and release AAB builds passed. Emulator UI taps exercised Light/Dark switching, process restart persistence, and System selection. System night mode and the selected System chip were inspected. Screenshots retained. Also inspected the dark catalog, chapter selector, Genesis 1 text, and bottom playback surface.
- Site-copy generation/check: 431 strings across Swift/Kotlin; design-token parity: 358 values passed.
- Samsung now has the Play edition. A separate sideload test app was installed without altering the Play installation or its data. Device interaction changed during testing, so final acceptance uses the isolated emulator; do not claim a completed physical-device regression.
- Test-only artifacts and automation stayed outside release sources. Main checkout's concurrent TV/playback changes were excluded.

## Release

- Android 1.0.52 (249): signed Web APK verified; Google Play production submission succeeded with `changes_not_sent_for_review=false`; API readback shows version 249, rollout configuration `completed` (not proof of approval/public availability).
- Download channel: version.json is 1.0.52 (249), APK HTTP 200, 53,302,924 bytes, Last-Modified 2026-11-02 13:54:50 GMT. The official `/app` page uses the same latest-APK URL; its displayed version metadata has a one-hour cache.
- iOS 1.1.5 (138): upload succeeded, delivery `c6f8887d-4b7f-4927-9950-f256f70a3ef3`; build VALID and submitted for App Review; submission `cf93f10c-5064-4733-b571-8dfc9fab2741`, automatic release after approval.
- Source: `9eab8614`; PR #33.
