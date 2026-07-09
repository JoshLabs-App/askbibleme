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
import { readReadingPlanPrefs, writeReadingPlanPrefs, type ReadingPlanPrefs } from "@/lib/read/reading-plan-prefs";
import {
  mergeReadingHabitStatsRecords,
  readReadingHabitStats,
  replaceReadingHabitStatsRecord,
  type ReadingHabitStatsRecord,
} from "@/lib/read/reading-habit-stats";
import { readTripleLoopProgress, writeTripleLoopProgress } from "@/lib/read/triple-loop-progress";
import { readNtDeepRepeatProgress, writeNtDeepRepeatProgress } from "@/lib/read/nt-deep-repeat-progress";
import { isNtDeepRepeatPlanId } from "@/lib/bible/reading-plans/nt-deep-repeat-plan";
import { isTripleLoopPlanId } from "@/lib/bible/reading-plans/triple-loop-plan";
import { reconcileNtDeepRepeatAheadDays } from "@/lib/read/nt-deep-repeat-effective-plan-day";
import { reconcileTripleLoopAheadDays } from "@/lib/read/triple-loop-effective-plan-day";
import { readAheadDays } from "@/lib/read/reading-plan-ahead";
import type { NtDeepRepeatReadingState } from "@/lib/bible/reading-plans/nt-deep-repeat-reading";
import type { TripleLoopReadingState } from "@/lib/bible/reading-plans/triple-loop-reading";
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

export async function exportLocalReadingBlobsWeb(): Promise<MemberReadingSyncPushV1> {
  if (typeof window === "undefined") return { schemaVersion: 1, blobs: {} };
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
  if (readingPlanPrefs) blobs.readingPlanPrefs = wrapBlob(readingPlanPrefs, now);
  if (tripleLoopProgress) blobs.tripleLoopProgress = wrapBlob(tripleLoopProgress, now);
  if (ntDeepRepeatProgress) blobs.ntDeepRepeatProgress = wrapBlob(ntDeepRepeatProgress, now);
  if (todayReadingDone?.doneKeys.length) blobs.todayReadingDone = wrapBlob(todayReadingDone, now);
  if (todayReadingFraction && Object.keys(todayReadingFraction.fractions).length) {
    blobs.todayReadingFraction = wrapBlob(todayReadingFraction, now);
  }
  blobs.habitStats = wrapBlob(habitStats, now);

  blobs.readTypography = wrapBlob(readTypography, now);
  blobs.readTranslation = wrapBlob(readTranslation, now);
  if (recentSearches.terms.length) blobs.recentSearches = wrapBlob(recentSearches, now);
  blobs.homeNatureUi = wrapBlob(homeNatureUi, now);
  blobs.homePrayerVerse = wrapBlob(homePrayerVerse, now);
  blobs.homeVersePoolScope = wrapBlob({ version: 1, scopeId: getHomeVersePoolScope() }, now);
  blobs.natureSceneUi = wrapBlob(natureSceneUi, now);
  blobs.cuvAudioVoice = wrapBlob({ version: 1, voiceId: readStoredCuvChapterAudioVoice() }, now);
  if (exploreProfileHasData(exploreYearDayProfile)) {
    blobs.exploreYearDayProfile = wrapBlob({ version: 1, profile: exploreYearDayProfile }, now);
  }
  blobs.appLocale = wrapBlob(appLocale, now);

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

async function reconcileTripleLoopReadingPlanAfterSyncWeb(): Promise<void> {
  const prefs = readReadingPlanPrefs();
  if (!prefs || !isTripleLoopPlanId(prefs.planId)) return;
  const progress = readTripleLoopProgress();
  const next = reconcileTripleLoopAheadDays(prefs, progress);
  if (readAheadDays(next) === readAheadDays(prefs)) return;
  writeReadingPlanPrefs(next);
}

async function reconcileNtDeepRepeatReadingPlanAfterSyncWeb(): Promise<void> {
  const prefs = readReadingPlanPrefs();
  if (!prefs || !isNtDeepRepeatPlanId(prefs.planId)) return;
  const progress = readNtDeepRepeatProgress();
  const next = reconcileNtDeepRepeatAheadDays(prefs, progress);
  if (readAheadDays(next) === readAheadDays(prefs)) return;
  writeReadingPlanPrefs(next);
}

export async function applyMemberReadingSyncBlobsWeb(
  blobs: Partial<Record<MemberReadingSyncBlobKey, MemberReadingSyncBlob>> | undefined,
): Promise<void> {
  if (!blobs || typeof window === "undefined") return;
  for (const key of MEMBER_READING_SYNC_BLOB_KEYS) {
    const blob = blobs[key];
    if (!blob) continue;
    await applyBlob(key, blob.value);
  }
  await reconcileTripleLoopReadingPlanAfterSyncWeb();
  await reconcileNtDeepRepeatReadingPlanAfterSyncWeb();
}
