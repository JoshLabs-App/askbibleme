# Bible panorama and app text sizes

Release targets: iOS 1.1.6 (139), Android 1.0.53 (250), and the web reader.

The panorama replaces Music in the main navigation; music is available from the Home menu. Six acts expand in one scrolling view. Book names have consistent emphasis, all 66 introductions are visible before expansion, and expanded books provide context and chapter links. Readers can locate their chapter in the panorama and resume reading. Context headings use “经文脉络” / “Scripture in context”.

The shared content covers 1189 chapters, 18 section notes, and nine typed connections with explanations. The six-act organization is a reading guide, not a claim about the Bible's original divisions. Wisdom and prophetic books connect by context, rather than an invented single chronology. Chinese, Traditional Chinese and English use the existing locale mechanisms.

App text size choices: system, standard, large and extra large. Existing reading-specific size controls remain. Native dark appearance fixes already shipped in Android 249 and iOS 138 are retained from `codex/dark-reading-contrast`; the release branch is based on current main and does not include that branch's unrelated TV work.

Validation before submission:
- iOS simulator build and signed device archive/export.
- Android local sideload, web APK and release AAB builds; release unit tests.
- Structural content check: 66 books / 1189 chapters, valid links, identical iOS and web JSON.
- iOS Maestro: Home → panorama → Creation → context → expanded Genesis.
- Web: Creation expands directly; Genesis 2 opens; chapter link locates Creation; expansion state persists.
- Web at 390px and extra-large text: no horizontal overflow; menu preview and book text scale.
- Samsung device was disconnected during final release verification; final integrated package was not installed on it. Earlier panorama iterations were tested on that device.

Release status must be verified with the stores and `/app-build.json`; successful builds are not a release confirmation.
