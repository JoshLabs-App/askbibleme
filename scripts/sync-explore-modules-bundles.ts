#!/usr/bin/env npx tsx
/**
 * Bundle explore module content (prayer, narrow gate, year-day-count, etc.) for Web API + App.
 * Run: npx tsx scripts/sync-explore-modules-bundles.ts
 */
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import {
  BIBLICAL_LIFESPAN_ERA,
  BIBLICAL_LIFESPAN_MODERN_ERA,
  BIBLICAL_LIFESPAN_NT_SCALE_YEARS,
  BIBLICAL_LIFESPAN_SCALE_YEARS,
  BIBLICAL_LIFESPANS,
} from "../lib/explore/biblical-lifespans";
import { CENTURY_SPAN_YEARS, LIFE_BATTERY_SEGMENT_COUNT } from "../lib/explore/century-timeline";
import {
  NARROW_GATE_BOOK_ABBR_TO_ID,
  NARROW_GATE_CATEGORIES,
  NARROW_GATE_TITLES_EN,
} from "../lib/explore/narrow-gate-content";
import {
  PRAISE_WORSHIP_BOOK_ABBR_TO_ID,
  PRAISE_WORSHIP_CATEGORIES,
  PRAISE_WORSHIP_TITLES_EN,
} from "../lib/explore/praise-worship-content";
import {
  PRAYER_SCRIPTURE_BOOK_ABBR_TO_ID,
  PRAYER_SCRIPTURE_SCENARIOS,
} from "../lib/explore/prayer-scripture-content";
import {
  WORD_OF_GOD_BOOK_ABBR_TO_ID,
  WORD_OF_GOD_CATEGORIES,
  WORD_OF_GOD_TITLES_EN,
} from "../lib/explore/word-of-god-content";
import {
  YEAR_DAY_COUNT_LEAD_REF,
  YEAR_DAY_COUNT_LIFE_DAY_READ_TARGET,
  YEAR_DAY_COUNT_SCRIPTURES,
} from "../lib/explore/year-day-count-refs";
import { YEARS_DAYS_ETERNITY_EN } from "../lib/explore/years-days-eternity-content-en";
import { YEARS_DAYS_ETERNITY_ZH } from "../lib/explore/years-days-eternity-content";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const payload = {
  schemaVersion: 1 as const,
  prayer: {
    bookAbbrToId: PRAYER_SCRIPTURE_BOOK_ABBR_TO_ID,
    scenarios: PRAYER_SCRIPTURE_SCENARIOS,
  },
  narrowGate: {
    bookAbbrToId: NARROW_GATE_BOOK_ABBR_TO_ID,
    categories: NARROW_GATE_CATEGORIES,
    titlesEn: NARROW_GATE_TITLES_EN,
  },
  praiseWorship: {
    bookAbbrToId: PRAISE_WORSHIP_BOOK_ABBR_TO_ID,
    categories: PRAISE_WORSHIP_CATEGORIES,
    titlesEn: PRAISE_WORSHIP_TITLES_EN,
  },
  wordOfGod: {
    bookAbbrToId: WORD_OF_GOD_BOOK_ABBR_TO_ID,
    categories: WORD_OF_GOD_CATEGORIES,
    titlesEn: WORD_OF_GOD_TITLES_EN,
  },
  yearsDaysEternity: {
    zh: YEARS_DAYS_ETERNITY_ZH,
    en: YEARS_DAYS_ETERNITY_EN,
  },
  yearDayCount: {
    lifeDayReadTarget: YEAR_DAY_COUNT_LIFE_DAY_READ_TARGET,
    leadRef: YEAR_DAY_COUNT_LEAD_REF,
    scriptures: YEAR_DAY_COUNT_SCRIPTURES,
  },
  biblicalLifespans: {
    scaleYears: BIBLICAL_LIFESPAN_SCALE_YEARS,
    ntScaleYears: BIBLICAL_LIFESPAN_NT_SCALE_YEARS,
    modernEra: BIBLICAL_LIFESPAN_MODERN_ERA,
    era: BIBLICAL_LIFESPAN_ERA,
    lifespans: BIBLICAL_LIFESPANS,
  },
  centuryTimeline: {
    spanYears: CENTURY_SPAN_YEARS,
    batterySegmentCount: LIFE_BATTERY_SEGMENT_COUNT,
  },
};

const contentVersion = createHash("sha256")
  .update(JSON.stringify(payload))
  .digest("hex")
  .slice(0, 16);

const bundle = { ...payload, contentVersion };
const outWeb = path.join(repoRoot, "data/explore-modules/bundle.json");
const outMobile = path.join(repoRoot, "apps/askbible-mobile/src/explore/explore-modules-bundled.json");

fs.mkdirSync(path.dirname(outWeb), { recursive: true });
const json = `${JSON.stringify(bundle)}\n`;
fs.writeFileSync(outWeb, json);
fs.writeFileSync(outMobile, json);
console.log(`Wrote ${outWeb} (${(fs.statSync(outWeb).size / 1024).toFixed(0)} KB)`);
console.log(`Wrote ${outMobile}`);
