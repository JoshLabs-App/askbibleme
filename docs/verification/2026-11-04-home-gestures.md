# Home gesture alignment — 2026-11-04

- Home: horizontal scene navigation, lower-area upward adjustment panel, downward music navigation. Verse rotation remains independent of gestures.
- Music: short press toggles playback, hold opens six album icons; selecting while paused remains paused. Enlarged music-to-Home return target.
- Ambient: scene selection preserves off; when enabled, changes to scene-associated audio. Added volume adjustment.
- iOS panorama uses the catalog's full-screen parchment. Android catalog minimum row height is 40dp, retaining larger typography requirements. Android and Web Explore no longer display the three article shortcuts; article routes remain available.
- Integrated on current main rather than the shared dirty checkout, retaining shipped appearance and panorama changes.

Validation before release:
- iOS local simulator build and long-press/album-state/adjustment Maestro regression passed.
- Android sideload and release AAB builds passed. Samsung install succeeded; final additional gesture regression requires unlocking the device.
- Web browser checks passed: horizontal scene switching, ambient follow/off, upward adjustments, paused album selection, downward music route, return to Home, Explore shortcut removal. Screenshots inspected; panel scroll items and close-button pointer capture corrected during validation.
- TypeScript and release preflight passed (preflight retains existing environment warnings).
- Native local release versions: iOS 1.1.7 (140), Android 1.0.54 (251). Store and production statuses are checked separately after submission/deployment.
