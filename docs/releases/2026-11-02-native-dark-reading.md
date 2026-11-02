# Native dark reading release — 2026-11-02

The post-reading Explore and Reference cards now use native icons and themed surfaces instead of translucent artwork. Shared Markdown text follows the reading theme, including paragraphs, headings, quotes, lists, links, emphasis, and tables. Larger reading sizes stack the cards. The contrast audit also corrected Android devotional, reminder, plan, and catalog text and iOS catalog labels.

## Release receipts

- Source implementation: `16859327` on `codex/dark-reading-contrast`; PR #33. Isolated from concurrent uncommitted TV/playback work.
- iOS: 1.1.5 (137), App Store Connect `WAITING_FOR_REVIEW`, build `VALID`, release policy `AFTER_APPROVAL`. Delivery UUID `ad654996-e50c-4bfa-aea3-041f2b2515ad`.
- Android: 1.0.51 (248), Google Play production edit committed successfully with `changes_not_sent_for_review=false`; production track readback contains version 248 and rollout status `completed`. This is a submission/rollout configuration receipt, not proof of review approval or public availability.
- Android download channel: version.json and APK updated to 1.0.51 (248); HTTP 200 and new Last-Modified verified.
- Apple required the newly mandatory social-media declaration. The editable App Info declaration was set to `socialMedia=false`, matching the app's absence of social feeds or user-generated social interaction; existing rating answers were preserved.

## Validation

- Signed iOS archive and IPA export succeeded; final IPA identifier/version checked.
- Android debug APK, Web APK, and release AAB built; APK signature and final package/version checked. Gradle unit-test tasks had no test sources and are not counted as test coverage.
- Existing info-edition parity check passed all 32 cases across Swift, Kotlin, and TypeScript (16 real chapter cases and 16 synthetic cases).
- Native component snapshot harnesses rendered the real card/Markdown components on iOS and Android simulators. Inspected dark and light body text, headings, links, emphasis, quotes, lists, and tables; iOS large-card layout inspected. Test harness sources were removed and excluded from the store builds.
- Measured key dark text/surface pairs: 7.66–11.53:1; checked light pairs: 5.38–13.44:1.
- No physical devices were connected. Snapshot validation is not a full end-to-end tap/navigation, playback, login, or purchase regression.

Local screenshots, contrast measurements, artifact hashes, and store receipts are retained in the chat's `dark-reading` visualization artifacts. Disposable build outputs are removed after upload and verification.
