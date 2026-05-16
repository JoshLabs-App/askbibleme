# Bible reading plans (bundled)

This folder holds **normalized reading-plan bundles** for optional in-app pickers.

## Regenerate

```bash
npm run import:reading-plans
```

Fetches JSON from [`khornberg/readingplans`](https://github.com/khornberg/readingplans) (README there: transformed from [`devkardia/bibleplan`](https://github.com/devkardia/bibleplan)) and writes:

- `registry.json` — catalog of available plans
- `built/*.json` — one file per plan (`schemaVersion: 1`, 66-book `bookId` aligned with `lib/bible/scripture-books.ts`)

## Scope today

The import script pulls **11 English-oriented mainstream tables** (M’Cheyne, several ESV-labeled tracks, chronological one-year, Heartlight OT+NT, etc.). It does **not** include Chinese three-track / Taiwan Bible Society schedules; add those as separate JSON + registry rows when you have cleared rights and a source file.

## Legal / product note

Plan **schedules** can be copyrighted or trademark-adjacent (publisher names, curated tables). Review upstream terms and your counsel before shipping broadly. The registry `upstreamNote` field repeats this warning.

## Runtime API

- `readReadingPlanRegistrySync(cwd)` — `lib/bible/reading-plans/reading-plans-store.ts`
- `readReadingPlanBundleSync(cwd, planId)` — full `days[]` with `readings[]` (`ReadingPlanRange`: `bookId`, chapter span, optional verses, `label`).

Deep links to the reader can use `startChapter` (and optionally verses later): `/read/{bookId}/{chapter}`.
