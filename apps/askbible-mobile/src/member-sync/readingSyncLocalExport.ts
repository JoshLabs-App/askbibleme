import AsyncStorage from "@react-native-async-storage/async-storage";
import { readCuvChapterAudioVoice } from "../bible/cuv-chapter-audio-voice-prefs";
import {
  CUV_CHAPTER_AUDIO_VOICE_STORAGE_KEY,
  CUV_CHAPTER_AUDIO_VOICE_STORAGE_KEY_LEGACY,
} from "../bible/cuv-chapter-audio-voices";
import {
  getScriptureVerseBookmarkStore,
} from "../bible/scripture-verse-bookmarks";
import { readExploreYearDayProfile } from "../explore/explore-birth-year-prefs";
import {
  HOME_PRAYER_PREFS_STORAGE_KEY,
  HOME_PRAYER_PREFS_STORAGE_KEY_LEGACY,
  readHomePrayerVersePrefs,
} from "../home/homePrayerVersePrefs";
import {
  getHomeVersePoolScope,
  HOME_VERSE_POOL_SCOPE_KEY,
  hydrateHomeVersePoolScope,
} from "../home/homeVersePoolScopePrefs";
import {
  readNatureHomeUiSyncBundle,
} from "../home/natureHomePrefs";
import { NATURE_HOME_PREFS_KEYS, NATURE_HOME_PREFS_LEGACY_KEYS } from "../home/natureHomePrefsKeys";
import type { AppLocale } from "../i18n/config";
import { LOCALE_STORAGE_KEY, LOCALE_STORAGE_KEY_LEGACY } from "../i18n/config";
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
  READ_BIBLE_TRANSLATION_MODE_STORAGE_KEY,
  READ_BIBLE_TRANSLATION_STORAGE_KEY,
  readReadBibleTranslationSyncBundle,
} from "../read/read-bible-translation-prefs";
import {
  READ_BIBLE_TYPOGRAPHY_STORAGE_KEY,
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
import { shouldSyncReadingPlanPrefs } from "../read/reading-plan/reading-plan-prefs-merge";
import { readReadingPlanPrefs } from "../read/reading-plan/reading-plan-prefs";
import { localeValueWithReadingPlan } from "./readingPlanSyncSidecar";
import {
  hasUserNtDeepRepeatProgress,
  readNtDeepRepeatProgress,
} from "../read/reading-plan/nt-deep-repeat-progress";
import {
  hasUserTripleLoopProgress,
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
import { blobsHaveMemberReadingProgress } from "./memberReadingSyncOwnerPolicy";
import {
  type MemberReadingSyncBlob,
  type MemberReadingSyncBlobKey,
  type MemberReadingSyncPushV1,
} from "./schema";
import { exploreProfileHasData } from "./readingSyncBlobValidators";

export { blobsHaveMemberReadingProgress };

const MUSIC_VISUAL_THEME_KEY = "askbible-mobile-music-visual-theme-v1";
const SCRIPTURE_PLAYBACK_RATE_KEY = "askbible-mobile-scripture-playback-rate-v1";
const NATURE_ACTIVE_SCENE_KEY = "askbible-mobile-nature-active-scene-v1";
const NATURE_LOOP_ALL_KEY = "askbible-mobile-nature-scene-loop-all-v1";
const NATURE_AMBIENT_SCENE_KEY = "askbible-mobile-nature-ambient-scene-v1";
const NATURE_AMBIENT_VOLUME_KEY = "askbible-mobile-nature-ambient-master-volume-v1";

function blobNow(): string {
  return new Date().toISOString();
}

function wrapBlob(value: unknown, updatedAt = blobNow()): MemberReadingSyncBlob {
  return { updatedAt, value };
}

async function hasStoredKeys(keys: string[]): Promise<boolean> {
  try {
    const pairs = await AsyncStorage.multiGet(keys);
    return pairs.some(([, value]) => value != null && value !== "");
  } catch {
    return false;
  }
}

async function readAppLocaleSyncBundle(): Promise<{ version: 1; locale: AppLocale }> {
  await hydrateLocaleFromStorage();
  return { version: 1, locale: getLocale() };
}

/** 本机是否已有会写入云端的读经进度（重装后的空默认值不算）。 */
export async function localHasMemberReadingProgress(): Promise<boolean> {
  const [
    bookmarks,
    highlights,
    lastPosition,
    listen,
    completion,
    today,
    fraction,
    habit,
    plan,
    hasTriple,
    hasNt,
  ] = await Promise.all([
    getScriptureVerseBookmarkStore(),
    readVerseTextHighlightStore(),
    readLastReadPosition(),
    readScriptureListenTotalsRecord(),
    readReadChapterCompletionRecord(),
    readTodayReadingDoneRecord(),
    readTodayReadingChapterFractionRecord(),
    readReadingHabitStats(),
    readReadingPlanPrefs(),
    hasUserTripleLoopProgress(),
    hasUserNtDeepRepeatProgress(),
  ]);
  if (Object.keys(bookmarks).length) return true;
  if (Object.keys(highlights).length) return true;
  if (lastPosition) return true;
  if (listen.totalSec > 0) return true;
  if (completion.completed.length) return true;
  if (today?.doneKeys.length) return true;
  if (fraction && Object.keys(fraction.fractions).length) return true;
  if (habit.completedDates.length) return true;
  if (shouldSyncReadingPlanPrefs(plan)) return true;
  return hasTriple || hasNt;
}

export async function exportLocalReadingBlobs(): Promise<MemberReadingSyncPushV1> {
  const [
    hasTypography,
    hasTranslation,
    hasHomeNature,
    hasHomePrayer,
    hasVersePoolScope,
    hasNatureScene,
    hasMusicTheme,
    hasPlaybackRate,
    hasCuvVoice,
    hasLocale,
  ] = await Promise.all([
    hasStoredKeys([READ_BIBLE_TYPOGRAPHY_STORAGE_KEY]),
    hasStoredKeys([READ_BIBLE_TRANSLATION_STORAGE_KEY, READ_BIBLE_TRANSLATION_MODE_STORAGE_KEY]),
    hasStoredKeys([...Object.values(NATURE_HOME_PREFS_KEYS), ...Object.values(NATURE_HOME_PREFS_LEGACY_KEYS)]),
    hasStoredKeys([HOME_PRAYER_PREFS_STORAGE_KEY, HOME_PRAYER_PREFS_STORAGE_KEY_LEGACY]),
    hasStoredKeys([HOME_VERSE_POOL_SCOPE_KEY]),
    hasStoredKeys([
      NATURE_ACTIVE_SCENE_KEY,
      NATURE_LOOP_ALL_KEY,
      NATURE_AMBIENT_SCENE_KEY,
      NATURE_AMBIENT_VOLUME_KEY,
    ]),
    hasStoredKeys([MUSIC_VISUAL_THEME_KEY]),
    hasStoredKeys([SCRIPTURE_PLAYBACK_RATE_KEY]),
    hasStoredKeys([CUV_CHAPTER_AUDIO_VOICE_STORAGE_KEY, CUV_CHAPTER_AUDIO_VOICE_STORAGE_KEY_LEGACY]),
    hasStoredKeys([LOCALE_STORAGE_KEY, LOCALE_STORAGE_KEY_LEGACY]),
  ]);

  await hydrateHomeVersePoolScope();
  const [
    bookmarks,
    highlights,
    lastPosition,
    chapterCompletion,
    readingPlanPrefs,
    tripleLoopProgress,
    ntDeepRepeatProgress,
    hasTripleProgress,
    hasNtProgress,
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
    hasUserTripleLoopProgress(),
    hasUserNtDeepRepeatProgress(),
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
  if (hasMusicTheme) blobs.musicVisualTheme = wrapBlob({ version: 1, theme: musicVisualTheme }, now);
  if (hasPlaybackRate) {
    blobs.scripturePlaybackRate = wrapBlob({ version: 1, rate: scripturePlaybackRate }, now);
  }
  if (hasCuvVoice) blobs.cuvAudioVoice = wrapBlob({ version: 1, voiceId: cuvAudioVoice }, now);
  if (exploreProfileHasData(exploreYearDayProfile)) {
    blobs.exploreYearDayProfile = wrapBlob({ version: 1, profile: exploreYearDayProfile }, now);
  }
  if (hasLocale && !blobs.appLocale) blobs.appLocale = wrapBlob(appLocale, now);

  return { schemaVersion: 1, blobs };
}
