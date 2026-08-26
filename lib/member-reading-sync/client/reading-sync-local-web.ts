"use client";

import {
  getScriptureVerseBookmarkStoreSnapshot,
  replaceScriptureVerseBookmarkStore,
} from "@/lib/bible/scripture-verse-bookmarks-client";
import {
  parseScriptureVerseBookmarkStore,
  type ScriptureVerseBookmarkStore,
} from "@/lib/bible/scripture-verse-bookmarks";
import {
  isCuvChapterAudioVoiceId,
  readStoredCuvChapterAudioVoice,
  writeStoredCuvChapterAudioVoice,
} from "@/lib/bible/cuv-chapter-audio-voices";
import type { BibleTranslationsIndex } from "@/lib/bible/translations-types";
import { readExploreYearDayProfile, writeExploreYearDayProfile } from "@/lib/explore/explore-birth-year-prefs";
import type { ExploreYearDayProfile } from "@/lib/explore/explore-birth-year-prefs";
import {
  getHomeVersePoolScope,
  hydrateHomeVersePoolScope,
  setHomeVersePoolScope,
} from "@/lib/home/home-verse-pool-scope-prefs";
import { HOME_BIBLE_TRANSLATIONS_CATALOG_URL } from "@/lib/home-prayer-pools/constants";
import { parseHomeVersePoolMenuScopeId } from "@/lib/home-prayer-pools/home-verse-pool-menu-scopes";
import type { HomePrayerVersePrefsV1 } from "@/lib/home-prayer-pools/types";
import {
  readHomePrayerVersePrefs,
  writeHomePrayerVersePrefs,
} from "@/lib/home-prayer-pools/prefs";
import { applyStoredAppLocale, LOCALE_STORAGE_KEY, parseLocale, type AppLocale } from "@/lib/i18n/config";
import {
  applyNatureHomeUiSyncBundle,
  readNatureHomeUiSyncBundle,
  type NatureHomeUiSyncBundle,
} from "@/lib/member-reading-sync/nature-home-ui-sync-web";
import {
  applyNatureSceneUiSyncBundle,
  readNatureSceneUiSyncBundle,
  type NatureSceneUiSyncBundle,
} from "@/lib/member-reading-sync/nature-scene-ui-sync-web";
import {
  MEMBER_READING_SYNC_BLOB_KEYS,
  type MemberReadingSyncBlob,
  type MemberReadingSyncBlobKey,
  type MemberReadingSyncPushV1,
} from "@/lib/member-reading-sync/schema";
import { readLastReadPosition, writeLastReadPosition, type ReadLastPosition } from "@/lib/read/read-last-position";
import {
  readReadChapterCompletionRecord,
  replaceReadChapterCompletionRecord,
  type ReadChapterCompletionRecord,
} from "@/lib/read/read-chapter-completion";
import {
  applyReadBibleTranslationSyncBundle,
  readReadBibleTranslationSyncBundle,
  type ReadBibleTranslationSyncBundle,
} from "@/lib/read/read-bible-translation-prefs";
import {
  readReadBibleTypographyPrefsFromStorage,
  writeReadBibleTypographyPrefsToStorage,
  type ReadBibleTypographyPrefsV1,
} from "@/lib/read/read-bible-typography-prefs";
import {
  readVerseTextHighlightStore,
  replaceVerseTextHighlightStore,
} from "@/lib/read/read-verse-text-highlights";
import {
  localeValueWithReadingPlan,
  readingPlanFromAppLocale,
} from "@/lib/member-reading-sync/reading-plan-sync-sidecar";
import { shouldSyncReadingPlanPrefs, mergeReadingPlanPrefsValue } from "@/lib/read/reading-plan-prefs-merge";
import {
  readEffectiveReadingPlanPrefs,
  readReadingPlanPrefs,
  writeReadingPlanPrefs,
  type ReadingPlanPrefs,
} from "@/lib/read/reading-plan-prefs";
import {
  hasUserNtDeepRepeatProgress,
  readNtDeepRepeatProgress,
  writeNtDeepRepeatProgress,
} from "@/lib/read/nt-deep-repeat-progress";
import {
  hasUserTripleLoopProgress,
  readTripleLoopProgress,
  writeTripleLoopProgress,
} from "@/lib/read/triple-loop-progress";
import { READ_BIBLE_TYPOGRAPHY_STORAGE_KEY } from "@/lib/read/read-bible-typography-prefs";
import { READ_BIBLE_TRANSLATION_STORAGE_KEY } from "@/lib/read/read-bible-translation-prefs";
import { HOME_PRAYER_PREFS_STORAGE_KEY } from "@/lib/home-prayer-pools/constants";
import { HOME_VERSE_POOL_SCOPE_STORAGE_KEY } from "@/lib/home/home-verse-pool-scope-prefs";
import {
  mergeReadingHabitStatsRecords,
  readReadingHabitStats,
  replaceReadingHabitStatsRecord,
  type ReadingHabitStatsRecord,
} from "@/lib/read/reading-habit-stats";
import {
  readScriptureListenTotalsWeb,
  replaceScriptureListenTotalsWeb,
  type ScriptureListenTotalsRecord,
} from "@/lib/read/scripture-listen-totals-web";
import { isNtDeepRepeatPlanId } from "@/lib/bible/reading-plans/nt-deep-repeat-plan";
import { isTripleLoopPlanId } from "@/lib/bible/reading-plans/triple-loop-plan";
import {
  inferNtDeepRepeatAheadDays,
} from "@/lib/read/nt-deep-repeat-effective-plan-day";
import { resolveNtDeepRepeatPlanDay } from "@/lib/read/nt-deep-repeat-plan-day";
import { inferTripleLoopAheadDays } from "@/lib/read/triple-loop-effective-plan-day";
import { readAheadDays } from "@/lib/read/reading-plan-ahead";
import { getReadingPlanDaySinceEpoch, READING_PLAN_EASTER_EPOCH_DATE } from "@/lib/read/reading-plan-epoch";
import { NT_DEEP_REPEAT_DEFAULT_PACE } from "@/lib/bible/reading-plans/nt-deep-repeat-pace";
import { normalizeNtDeepRepeatChaptersReadKeys } from "@/lib/bible/reading-plans/nt-deep-repeat-chapters-read";
import {
  normalizeNtDeepRepeatReadingState,
  ntDeepRepeatStateForPlanDay,
  type NtDeepRepeatReadingState,
} from "@/lib/bible/reading-plans/nt-deep-repeat-reading";
import {
  normalizeTripleLoopReadingState,
  tripleLoopStateForPlanDay,
  type TripleLoopReadingState,
} from "@/lib/bible/reading-plans/triple-loop-reading";
import { normalizeTripleLoopChaptersReadKeys } from "@/lib/bible/reading-plans/triple-loop-chapters-read";
import { toLocalDateString } from "@/lib/read/reading-plan-prefs";
import {
  readTodayReadingChapterFractionRecord,
  replaceTodayReadingChapterFractionRecord,
  type TodayReadingChapterFractionRecord,
} from "@/lib/read/today-reading-chapter-fraction";
import {
  readTodayReadingDoneRecord,
  replaceTodayReadingDoneRecord,
  type TodayReadingDoneRecord,
} from "@/lib/read/today-reading-done";
import {
  readScriptureRecentSearches,
  replaceScriptureRecentSearches,
  type ScriptureRecentSearchesRecord,
} from "@/lib/read/scripture-recent-searches";

let translationsIndexCache: BibleTranslationsIndex | null = null;

async function loadTranslationsIndex(): Promise<BibleTranslationsIndex> {
  if (translationsIndexCache) return translationsIndexCache;
  const res = await fetch(HOME_BIBLE_TRANSLATIONS_CATALOG_URL, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error("translations_catalog_unavailable");
  translationsIndexCache = (await res.json()) as BibleTranslationsIndex;
  return translationsIndexCache;
}

function blobNow(): string {
  return new Date().toISOString();
}

function wrapBlob(value: unknown, updatedAt = blobNow()): MemberReadingSyncBlob {
  return { updatedAt, value };
}

function readAppLocaleSyncBundle(): { version: 1; locale: AppLocale } {
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
    return { version: 1, locale: raw ? parseLocale(raw) : parseLocale("zh-CN") };
  } catch {
    return { version: 1, locale: parseLocale("zh-CN") };
  }
}

function exploreProfileHasData(profile: ExploreYearDayProfile): boolean {
  return Boolean(
    profile.birthDate || profile.displayName || profile.weddingAnniversary || profile.baptismDate,
  );
}

function hasStoredKeys(keys: string[]): boolean {
  try {
    return keys.some((k) => {
      const v = localStorage.getItem(k);
      return v != null && v !== "";
    });
  } catch {
    return false;
  }
}

function isReadingPlanPrefs(value: unknown): value is ReadingPlanPrefs {
  if (!value || typeof value !== "object") return false;
  const planId = (value as { planId?: unknown }).planId;
  return typeof planId === "string" && planId.trim().length > 0;
}

/** 本机是否已有会写入云端的读经进度（重装后的空默认值不算）。 */
export function localHasMemberReadingProgressWeb(): boolean {
  if (typeof window === "undefined") return false;
  const bookmarks = getScriptureVerseBookmarkStoreSnapshot();
  const highlights = readVerseTextHighlightStore();
  const lastPosition = readLastReadPosition();
  const listen = readScriptureListenTotalsWeb();
  const completion = readReadChapterCompletionRecord();
  const today = readTodayReadingDoneRecord();
  const fraction = readTodayReadingChapterFractionRecord();
  const habit = readReadingHabitStats();
  const plan = readReadingPlanPrefs();
  if (Object.keys(bookmarks).length) return true;
  if (Object.keys(highlights).length) return true;
  if (lastPosition) return true;
  if (listen.totalSec > 0) return true;
  if (completion.completed.length) return true;
  if (today?.doneKeys.length) return true;
  if (fraction && Object.keys(fraction.fractions).length) return true;
  if (habit.completedDates.length) return true;
  if (plan && shouldSyncReadingPlanPrefs(plan)) return true;
  return hasUserTripleLoopProgress() || hasUserNtDeepRepeatProgress();
}

export async function exportLocalReadingBlobsWeb(): Promise<MemberReadingSyncPushV1> {
  if (typeof window === "undefined") return { schemaVersion: 1, blobs: {} };

  const hasTypography = hasStoredKeys([READ_BIBLE_TYPOGRAPHY_STORAGE_KEY]);
  const hasTranslation = hasStoredKeys([READ_BIBLE_TRANSLATION_STORAGE_KEY]);
  const hasHomeNature = hasStoredKeys([
    "askbible-nature-visual-levels-v1",
    "selah-nature-visual-levels-v1",
    "askbible-nature-home-verse-appearance-v1",
    "selah-nature-home-verse-appearance-v1",
    "askbible-nature-home-text-scale-v1",
    "selah-shell-template-chrome-tune-v1",
  ]);
  const hasHomePrayer = hasStoredKeys([HOME_PRAYER_PREFS_STORAGE_KEY, "selah-home-verse-prefs-v1"]);
  const hasVersePoolScope = hasStoredKeys([HOME_VERSE_POOL_SCOPE_STORAGE_KEY]);
  const hasNatureScene = hasStoredKeys([
    "askbible-nature-home-active-scene-v1",
    "selah-nature-home-active-scene-v1",
    "askbible-nature-home-scene-loop-all-v1",
    "askbible-nature-home-ambient-scene-v1",
  ]);
  const hasLocale = hasStoredKeys([LOCALE_STORAGE_KEY, "selah-locale-v1"]);

  const index = await loadTranslationsIndex();
  hydrateHomeVersePoolScope();

  const now = blobNow();
  const blobs: Partial<Record<MemberReadingSyncBlobKey, MemberReadingSyncBlob>> = {};

  const bookmarks = getScriptureVerseBookmarkStoreSnapshot();
  const highlights = readVerseTextHighlightStore();
  const lastPosition = readLastReadPosition();
  const chapterCompletion = readReadChapterCompletionRecord();
  const readingPlanPrefs = readReadingPlanPrefs();
  const tripleLoopProgress = readTripleLoopProgress();
  const ntDeepRepeatProgress = readNtDeepRepeatProgress();
  const hasTripleProgress = hasUserTripleLoopProgress();
  const hasNtProgress = hasUserNtDeepRepeatProgress();
  const todayReadingDone = readTodayReadingDoneRecord();
  const todayReadingFraction = readTodayReadingChapterFractionRecord();
  const habitStats = readReadingHabitStats();
  const readTypography = readReadBibleTypographyPrefsFromStorage();
  const readTranslation = readReadBibleTranslationSyncBundle(index);
  const recentSearches = readScriptureRecentSearches();
  const homeNatureUi = readNatureHomeUiSyncBundle();
  const homePrayerVerse = readHomePrayerVersePrefs();
  const natureSceneUi = readNatureSceneUiSyncBundle();
  const exploreYearDayProfile = readExploreYearDayProfile();
  const appLocale = readAppLocaleSyncBundle();

  if (Object.keys(bookmarks).length) blobs.bookmarks = wrapBlob(bookmarks, now);
  if (Object.keys(highlights).length) blobs.highlights = wrapBlob(highlights, now);
  if (lastPosition) blobs.lastPosition = wrapBlob(lastPosition, now);
  if (chapterCompletion.completed.length) blobs.chapterCompletion = wrapBlob(chapterCompletion, now);
  if (readingPlanPrefs && shouldSyncReadingPlanPrefs(readingPlanPrefs)) {
    blobs.readingPlanPrefs = wrapBlob(readingPlanPrefs, now);
    blobs.appLocale = wrapBlob(
      localeValueWithReadingPlan(hasLocale ? appLocale : null, readingPlanPrefs),
      now,
    );
  }
  if (hasTripleProgress) blobs.tripleLoopProgress = wrapBlob(tripleLoopProgress, now);
  if (hasNtProgress) blobs.ntDeepRepeatProgress = wrapBlob(ntDeepRepeatProgress, now);
  if (todayReadingDone?.doneKeys.length) blobs.todayReadingDone = wrapBlob(todayReadingDone, now);
  if (todayReadingFraction && Object.keys(todayReadingFraction.fractions).length) {
    blobs.todayReadingFraction = wrapBlob(todayReadingFraction, now);
  }
  if (habitStats.completedDates.length) blobs.habitStats = wrapBlob(habitStats, now);
  const scriptureListenTotals = readScriptureListenTotalsWeb();
  if (scriptureListenTotals.totalSec > 0) {
    blobs.scriptureListenTotals = wrapBlob(scriptureListenTotals, now);
  }

  if (hasTypography) blobs.readTypography = wrapBlob(readTypography, now);
  if (hasTranslation) blobs.readTranslation = wrapBlob(readTranslation, now);
  if (recentSearches.terms.length) blobs.recentSearches = wrapBlob(recentSearches, now);
  if (hasHomeNature) blobs.homeNatureUi = wrapBlob(homeNatureUi, now);
  if (hasHomePrayer) blobs.homePrayerVerse = wrapBlob(homePrayerVerse, now);
  if (hasVersePoolScope) {
    blobs.homeVersePoolScope = wrapBlob({ version: 1, scopeId: getHomeVersePoolScope() }, now);
  }
  if (hasNatureScene) blobs.natureSceneUi = wrapBlob(natureSceneUi, now);
  blobs.cuvAudioVoice = wrapBlob({ version: 1, voiceId: readStoredCuvChapterAudioVoice() }, now);
  if (exploreProfileHasData(exploreYearDayProfile)) {
    blobs.exploreYearDayProfile = wrapBlob({ version: 1, profile: exploreYearDayProfile }, now);
  }
  if (hasLocale && !blobs.appLocale) blobs.appLocale = wrapBlob(appLocale, now);

  return { schemaVersion: 1, blobs };
}

async function applyBlob(key: MemberReadingSyncBlobKey, value: unknown): Promise<void> {
  const index = await loadTranslationsIndex();
  switch (key) {
    case "bookmarks":
      if (value && typeof value === "object" && !Array.isArray(value)) {
        replaceScriptureVerseBookmarkStore(
          parseScriptureVerseBookmarkStore(JSON.stringify(value as ScriptureVerseBookmarkStore)),
        );
      }
      break;
    case "highlights":
      if (value && typeof value === "object" && !Array.isArray(value)) {
        replaceVerseTextHighlightStore(value as Record<string, { i: number; c: string }[]>);
      }
      break;
    case "lastPosition":
      if (value && typeof value === "object") writeLastReadPosition(value as ReadLastPosition);
      break;
    case "chapterCompletion":
      if (value && typeof value === "object") {
        replaceReadChapterCompletionRecord(value as ReadChapterCompletionRecord);
      }
      break;
    case "readingPlanPrefs":
      if (value === null) writeReadingPlanPrefs(null);
      else if (value && typeof value === "object") writeReadingPlanPrefs(value as ReadingPlanPrefs);
      break;
    case "tripleLoopProgress":
      if (value && typeof value === "object") writeTripleLoopProgress(value as TripleLoopReadingState);
      break;
    case "ntDeepRepeatProgress":
      if (value && typeof value === "object") writeNtDeepRepeatProgress(value as NtDeepRepeatReadingState);
      break;
    case "todayReadingDone":
      if (value && typeof value === "object") replaceTodayReadingDoneRecord(value as TodayReadingDoneRecord);
      break;
    case "todayReadingFraction":
      if (value && typeof value === "object") {
        replaceTodayReadingChapterFractionRecord(value as TodayReadingChapterFractionRecord);
      }
      break;
    case "habitStats":
      if (value && typeof value === "object") {
        const local = readReadingHabitStats();
        replaceReadingHabitStatsRecord(
          mergeReadingHabitStatsRecords(local, value as ReadingHabitStatsRecord),
        );
      }
      break;
    case "scriptureListenTotals":
      if (
        value &&
        typeof value === "object" &&
        (value as ScriptureListenTotalsRecord).version === 1 &&
        typeof (value as ScriptureListenTotalsRecord).totalSec === "number"
      ) {
        replaceScriptureListenTotalsWeb(value as ScriptureListenTotalsRecord);
      }
      break;
    case "readTypography":
      if (value && typeof value === "object") {
        writeReadBibleTypographyPrefsToStorage(value as ReadBibleTypographyPrefsV1);
      }
      break;
    case "readTranslation":
      if (value && typeof value === "object") {
        applyReadBibleTranslationSyncBundle(value as ReadBibleTranslationSyncBundle, index);
      }
      break;
    case "recentSearches":
      if (value && typeof value === "object") replaceScriptureRecentSearches(value as ScriptureRecentSearchesRecord);
      break;
    case "homeNatureUi":
      if (value && typeof value === "object") applyNatureHomeUiSyncBundle(value as NatureHomeUiSyncBundle);
      break;
    case "homePrayerVerse":
      if (value && typeof value === "object") {
        const incoming = value as HomePrayerVersePrefsV1;
        writeHomePrayerVersePrefs({ ...readHomePrayerVersePrefs(), ...incoming, version: 1 });
      }
      break;
    case "homeVersePoolScope":
      if (value && typeof value === "object" && typeof (value as { scopeId?: unknown }).scopeId === "string") {
        setHomeVersePoolScope(parseHomeVersePoolMenuScopeId((value as { scopeId: string }).scopeId));
      }
      break;
    case "natureSceneUi":
      if (value && typeof value === "object") applyNatureSceneUiSyncBundle(value as NatureSceneUiSyncBundle);
      break;
    case "musicVisualTheme":
    case "scripturePlaybackRate":
      break;
    case "cuvAudioVoice": {
      if (!value || typeof value !== "object") break;
      const voiceId = (value as { voiceId?: unknown }).voiceId;
      if (typeof voiceId === "string" && isCuvChapterAudioVoiceId(voiceId)) {
        writeStoredCuvChapterAudioVoice(voiceId);
      }
      break;
    }
    case "exploreYearDayProfile":
      if (value && typeof value === "object") {
        const profile = (value as { profile?: ExploreYearDayProfile }).profile;
        if (profile?.birthDate && profile.displayName) {
          writeExploreYearDayProfile({
            birthDate: profile.birthDate,
            displayName: profile.displayName,
            weddingAnniversary: profile.weddingAnniversary,
            baptismDate: profile.baptismDate,
          });
        }
      }
      break;
    case "appLocale":
      if (value && typeof value === "object" && typeof (value as { locale?: unknown }).locale === "string") {
        applyStoredAppLocale(parseLocale((value as { locale: string }).locale));
      }
      break;
    default:
      break;
  }
}

async function reconcileTripleLoopReadingPlanAfterSyncWeb(): Promise<boolean> {
  const prefs = readEffectiveReadingPlanPrefs();
  if (!isTripleLoopPlanId(prefs.planId)) return false;

  const stored = readTripleLoopProgress();
  const prefsAhead = readAheadDays(prefs);
  const inferred = inferTripleLoopAheadDays(stored);
  if (inferred <= prefsAhead) return false;

  if (prefs.chosen !== true) {
    writeReadingPlanPrefs({ ...prefs, aheadDays: inferred, chosen: true });
    return true;
  }

  const planDay = getReadingPlanDaySinceEpoch() + prefsAhead;
  writeTripleLoopProgress(
    normalizeTripleLoopReadingState({
      ...tripleLoopStateForPlanDay(planDay),
      startedAt: stored.startedAt?.trim() || READING_PLAN_EASTER_EPOCH_DATE,
      chaptersReadKeys: normalizeTripleLoopChaptersReadKeys(stored.chaptersReadKeys),
    }),
  );
  return false;
}

async function reconcileNtDeepRepeatReadingPlanAfterSyncWeb(): Promise<boolean> {
  const prefs = readEffectiveReadingPlanPrefs();
  if (!isNtDeepRepeatPlanId(prefs.planId)) return false;

  const stored = readNtDeepRepeatProgress();
  const prefsAhead = readAheadDays(prefs);
  const inferred = inferNtDeepRepeatAheadDays(stored, prefs);
  if (inferred <= prefsAhead) return false;

  if (prefs.chosen !== true) {
    writeReadingPlanPrefs({ ...prefs, aheadDays: inferred, chosen: true });
    return true;
  }

  const planDay = resolveNtDeepRepeatPlanDay(prefs) + prefsAhead;
  const pace = prefs.ntDeepRepeatPace ?? stored.pace ?? NT_DEEP_REPEAT_DEFAULT_PACE;
  const startedAt = prefs.startedOn?.trim() || stored.startedAt?.trim() || toLocalDateString(new Date());
  writeNtDeepRepeatProgress(
    normalizeNtDeepRepeatReadingState({
      ...ntDeepRepeatStateForPlanDay(planDay, { pace, startedAt }),
      pace,
      startedAt,
      chaptersReadKeys: normalizeNtDeepRepeatChaptersReadKeys(stored.chaptersReadKeys),
    }),
  );
  return false;
}

export async function applyMemberReadingSyncBlobsWeb(
  blobs: Partial<Record<MemberReadingSyncBlobKey, MemberReadingSyncBlob>> | undefined,
): Promise<boolean> {
  if (!blobs || typeof window === "undefined") return false;

  const sidecarPlan = readingPlanFromAppLocale(blobs.appLocale?.value);
  if (!blobs.readingPlanPrefs && isReadingPlanPrefs(sidecarPlan)) {
    const current = readReadingPlanPrefs();
    const merged = current ? mergeReadingPlanPrefsValue(sidecarPlan, current) : sidecarPlan;
    if (isReadingPlanPrefs(merged)) {
      writeReadingPlanPrefs(merged);
    }
  }

  for (const key of MEMBER_READING_SYNC_BLOB_KEYS) {
    const blob = blobs[key];
    if (!blob) continue;
    await applyBlob(key, blob.value);
  }
  const triple = await reconcileTripleLoopReadingPlanAfterSyncWeb();
  const ndr = await reconcileNtDeepRepeatReadingPlanAfterSyncWeb();
  return triple || ndr;
}
