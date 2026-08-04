import { readCuvChapterAudioVoice } from "../bible/cuv-chapter-audio-voice-prefs";
import {
  getScriptureVerseBookmarkStore,
} from "../bible/scripture-verse-bookmarks";
import { readExploreYearDayProfile } from "../explore/explore-birth-year-prefs";
import {
  getHomeVersePoolScope,
  hydrateHomeVersePoolScope,
} from "../home/homeVersePoolScopePrefs";
import {
  readHomePrayerVersePrefs,
} from "../home/homePrayerVersePrefs";
import {
  readNatureHomeUiSyncBundle,
} from "../home/natureHomePrefs";
import type { AppLocale } from "../i18n/config";
import { getLocale, hydrateLocaleFromStorage } from "../i18n/locale-store";
import {
  readMusicVisualTheme,
} from "../music/music-visual-theme-prefs";
import {
  readScripturePlaybackRate,
} from "../music/music-playback-prefs";
import { readLastReadPosition } from "../read/read-last-position";
import {
  readReadChapterCompletionRecord,
} from "../read/read-chapter-completion";
import {
  readReadBibleTranslationSyncBundle,
} from "../read/read-bible-translation-prefs";
import {
  readReadBibleTypographyPrefs,
} from "../read/read-bible-typography-prefs";
import {
  readVerseTextHighlightStore,
} from "../read/read-verse-text-highlights";
import {
  readReadingHabitStats,
} from "../read/reading-habit-stats";
import {
  readScriptureListenTotalsRecord,
} from "../read/scripture-listen-totals";
import { readReadingPlanPrefs } from "../read/reading-plan/reading-plan-prefs";
import {
  readNtDeepRepeatProgress,
} from "../read/reading-plan/nt-deep-repeat-progress";
import {
  readTripleLoopProgress,
} from "../read/reading-plan/triple-loop-progress";
import {
  readTodayReadingChapterFractionRecord,
} from "../read/reading-plan/today-reading-chapter-fraction";
import {
  readTodayReadingDoneRecord,
} from "../read/reading-plan/today-reading-done";
import {
  readScriptureRecentSearches,
} from "../read/scripture-recent-searches";
import {
  readNatureSceneUiSyncBundle,
} from "./natureSceneUiSync";
import {
  type MemberReadingSyncBlob,
  type MemberReadingSyncBlobKey,
  type MemberReadingSyncPushV1,
} from "./schema";
import { exploreProfileHasData } from "./readingSyncBlobValidators";

function blobNow(): string {
  return new Date().toISOString();
}

function wrapBlob(value: unknown, updatedAt = blobNow()): MemberReadingSyncBlob {
  return { updatedAt, value };
}

async function readAppLocaleSyncBundle(): Promise<{ version: 1; locale: AppLocale }> {
  await hydrateLocaleFromStorage();
  return { version: 1, locale: getLocale() };
}

export async function exportLocalReadingBlobs(): Promise<MemberReadingSyncPushV1> {
  await hydrateHomeVersePoolScope();
  const [
    bookmarks,
    highlights,
    lastPosition,
    chapterCompletion,
    readingPlanPrefs,
    tripleLoopProgress,
    ntDeepRepeatProgress,
    todayReadingDone,
    todayReadingFraction,
    habitStats,
    scriptureListenTotals,
    readTypography,
    readTranslation,
    recentSearches,
    homeNatureUi,
    homePrayerVerse,
    natureSceneUi,
    musicVisualTheme,
    scripturePlaybackRate,
    cuvAudioVoice,
    exploreYearDayProfile,
    appLocale,
  ] = await Promise.all([
    getScriptureVerseBookmarkStore(),
    readVerseTextHighlightStore(),
    readLastReadPosition(),
    readReadChapterCompletionRecord(),
    readReadingPlanPrefs(),
    readTripleLoopProgress(),
    readNtDeepRepeatProgress(),
    readTodayReadingDoneRecord(),
    readTodayReadingChapterFractionRecord(),
    readReadingHabitStats(),
    readScriptureListenTotalsRecord(),
    readReadBibleTypographyPrefs(),
    readReadBibleTranslationSyncBundle(),
    readScriptureRecentSearches(),
    readNatureHomeUiSyncBundle(),
    readHomePrayerVersePrefs(),
    readNatureSceneUiSyncBundle(),
    readMusicVisualTheme(),
    readScripturePlaybackRate(),
    readCuvChapterAudioVoice(),
    readExploreYearDayProfile(),
    readAppLocaleSyncBundle(),
  ]);

  const now = blobNow();
  const blobs: Partial<Record<MemberReadingSyncBlobKey, MemberReadingSyncBlob>> = {};

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
  if (scriptureListenTotals.totalSec > 0) {
    blobs.scriptureListenTotals = wrapBlob(scriptureListenTotals, now);
  }

  blobs.readTypography = wrapBlob(readTypography, now);
  blobs.readTranslation = wrapBlob(readTranslation, now);
  if (recentSearches.terms.length) blobs.recentSearches = wrapBlob(recentSearches, now);
  blobs.homeNatureUi = wrapBlob(homeNatureUi, now);
  blobs.homePrayerVerse = wrapBlob(homePrayerVerse, now);
  blobs.homeVersePoolScope = wrapBlob({ version: 1, scopeId: getHomeVersePoolScope() }, now);
  blobs.natureSceneUi = wrapBlob(natureSceneUi, now);
  blobs.musicVisualTheme = wrapBlob({ version: 1, theme: musicVisualTheme }, now);
  blobs.scripturePlaybackRate = wrapBlob({ version: 1, rate: scripturePlaybackRate }, now);
  blobs.cuvAudioVoice = wrapBlob({ version: 1, voiceId: cuvAudioVoice }, now);
  if (exploreProfileHasData(exploreYearDayProfile)) {
    blobs.exploreYearDayProfile = wrapBlob({ version: 1, profile: exploreYearDayProfile }, now);
  }
  blobs.appLocale = wrapBlob(appLocale, now);

  return { schemaVersion: 1, blobs };
}
