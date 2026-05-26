# First Open Hint QA Checklist

## Scope
- Feature: one-time first-open hint overlay.
- Platforms: iOS, Android, Web.
- Trigger: first launch only.

## Environment Setup
- Ensure `EXPO_PUBLIC_FIRST_OPEN_HINT_ENABLED` is not `0` for mobile.
- Ensure `NEXT_PUBLIC_FIRST_OPEN_HINT_ENABLED` is not `0` for web.
- Use fresh install or clear app/site local storage before each run.

## Test Cases

### Case 1: First launch shows hint
- **Given** a fresh install (or cleared storage).
- **When** app/web shell loads for the first time.
- **Then** first-open hint appears once with title, subtitle, body, helper, primary, and secondary actions.

### Case 2: Primary action hides and persists
- **Given** first-open hint is visible.
- **When** user taps primary action.
- **Then** hint closes immediately and does not appear after restart/refresh.

### Case 3: Secondary action hides and persists
- **Given** first-open hint is visible.
- **When** user taps secondary action or backdrop.
- **Then** hint closes immediately and does not appear after restart/refresh.

### Case 4: Offline behavior
- **Given** device/browser is offline.
- **When** app/web shell loads first time.
- **Then** hint still appears and can be dismissed normally.

### Case 5: Localization
- **Given** Chinese and English locales.
- **When** first-open hint is shown.
- **Then** each locale shows correct text with no placeholder keys or truncation.

### Case 6: Telemetry taps
- **Given** telemetry is enabled.
- **When** user taps primary action.
- **Then** `tap` event with `target: "intro.start"` is queued/sent.
- **When** user taps secondary action or backdrop.
- **Then** `tap` event with `target: "intro.skip"` is queued/sent.

## Regression Checks
- Home shell remains interactive after dismiss.
- Existing telemetry events (`screen_view`, `tab_select`, etc.) still report.
- No repeat popup on normal reopen unless storage is cleared.
