import { bundledBibleTranslationsCatalog } from "../api/fetchBibleTranslationsCatalog";
import { readCuvChapterAudioVoice, writeCuvChapterAudioVoice } from "../bible/cuv-chapter-audio-voice-prefs";
import { isCuvChapterAudioVoiceId } from "../bible/cuv-chapter-audio-voices";
import {
  parseScriptureVerseBookmarkStore,
  type ScriptureVerseBookmarkStore,
} from "../bible/scripture-verse-bookmark-store";
import {
  getScriptureVerseBookmarkStore,
  replaceScriptureVerseBookmarkStore,
} from "../bible/scripture-verse-bookmarks";
import { readExploreYearDayProfile, writeExploreBirthDate, writeExploreYearDayProfile } from "../explore/explore-birth-year-prefs";
import type { ExploreYearDayProfile } from "../explore/explore-birth-year-prefs";
import {
  getHomeVersePoolScope,
  hydrateHomeVersePoolScope,
  replaceHomeVersePoolScopeForSync,
} from "../home/homeVersePoolScopePrefs";
import type { HomeVersePoolScopeId } from "../explore/explore-home-verse-pool-scopes";
import {
  readHomePrayerVersePrefs,
  writeHomePrayerVersePrefs,
  type HomePrayerVersePrefsV1,
} from "../home/homePrayerVersePrefs";
import {
  applyNatureHomeUiSyncBundle,
  readNatureHomeUiSyncBundle,
  type NatureHomeUiSyncBundle,
} from "../home/natureHomePrefs";
import { parseLocale, type AppLocale } from "../i18n/config";
import { getLocale, hydrateLocaleFromStorage, setLocale } from "../i18n/locale-store";
import {
  readMusicVisualTheme,
  writeMusicVisualTheme,
  type MusicVisualTheme,
} from "../music/music-visual-theme-prefs";
import {
  normalizeScripturePlaybackRate,
  readScripturePlaybackRate,
  writeScripturePlaybackRate,
} from "../music/music-playback-prefs";
import { readLastReadPosition, writeLastReadPosition, type ReadLastPosition } from "../read/read-last-position";
import {
  readReadChapterCompletionRecord,
  replaceReadChapterCompletionRecord,
  type ReadChapterCompletionRecord,
} from "../read/read-chapter-completion";
import {
  applyReadBibleTranslationSyncBundle,
  readReadBibleTranslationSyncBundle,
  type ReadBibleTranslationSyncBundle,
} from "../read/read-bible-translation-prefs";
import {
  readReadBibleTypographyPrefs,
  writeReadBibleTypographyPrefs,
  type ReadBibleTypographyPrefsV1,
} from "../read/read-bible-typography-prefs";
import {
  readVerseTextHighlightStore,
  replaceVerseTextHighlightStore,
  type VerseTextHighlightStore,
} from "../read/read-verse-text-highlights";
import {
  readReadingHabitStats,
  replaceReadingHabitStatsRecord,
  type ReadingHabitStatsRecord,
} from "../read/reading-habit-stats";
import { readReadingPlanPrefs, writeReadingPlanPrefs, type ReadingPlanPrefs } from "../read/reading-plan/reading-plan-prefs";
import {
  readTripleLoopProgress,
  writeTripleLoopProgress,
} from "../read/reading-plan/triple-loop-progress";
import type { TripleLoopReadingState } from "../read/reading-plan/triple-loop-reading";
import {
  readTodayReadingChapterFractionRecord,
  replaceTodayReadingChapterFractionRecord,
  type TodayReadingChapterFractionRecord,
} from "../read/reading-plan/today-reading-chapter-fraction";
import {
  readTodayReadingDoneRecord,
  replaceTodayReadingDoneRecord,
  type TodayReadingDoneRecord,
} from "../read/reading-plan/today-reading-done";
import {
  readScriptureRecentSearches,
  replaceScriptureRecentSearches,
  type ScriptureRecentSearchesRecord,
} from "../read/scripture-recent-searches";
import {
  applyNatureSceneUiSyncBundle,
  readNatureSceneUiSyncBundle,
  type NatureSceneUiSyncBundle,
} from "./natureSceneUiSync";
import {
  MEMBER_READING_SYNC_BLOB_KEYS,
  type MemberReadingSyncBlob,
  type MemberReadingSyncBlobKey,
  type MemberReadingSyncPushV1,
} from "./schema";

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

function exploreProfileHasData(profile: ExploreYearDayProfile): boolean {
  return Boolean(
    profile.birthDate ||
      profile.displayName ||
      profile.weddingAnniversary ||
      profile.baptismDate,
  );
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
    todayReadingDone,
    todayReadingFraction,
    habitStats,
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
    readTodayReadingDoneRecord(),
    readTodayReadingChapterFractionRecord(),
    readReadingHabitStats(),
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
  if (todayReadingDone?.doneKeys.length) blobs.todayReadingDone = wrapBlob(todayReadingDone, now);
  if (todayReadingFraction && Object.keys(todayReadingFraction.fractions).length) {
    blobs.todayReadingFraction = wrapBlob(todayReadingFraction, now);
  }
  if (habitStats.completedDates.length) blobs.habitStats = wrapBlob(habitStats, now);

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

function isBookmarkStore(value: unknown): value is ScriptureVerseBookmarkStore {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isHighlightStore(value: unknown): value is VerseTextHighlightStore {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isLastPosition(value: unknown): value is ReadLastPosition {
  if (!value || typeof value !== "object") return false;
  const v = value as ReadLastPosition;
  return Boolean(v.bookId && Number.isInteger(v.chapter) && v.chapter >= 1);
}

function isChapterCompletion(value: unknown): value is ReadChapterCompletionRecord {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as ReadChapterCompletionRecord).version === 1 &&
      Array.isArray((value as ReadChapterCompletionRecord).completed),
  );
}

function isReadingPlanPrefs(value: unknown): value is ReadingPlanPrefs {
  if (!value || typeof value !== "object") return false;
  return typeof (value as ReadingPlanPrefs).planId === "string";
}

function isTripleLoopState(value: unknown): value is TripleLoopReadingState {
  if (!value || typeof value !== "object") return false;
  const v = value as TripleLoopReadingState;
  return Boolean(v.ot && v.nt && v.wisdom);
}

function isTodayDoneRecord(value: unknown): value is TodayReadingDoneRecord {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as TodayReadingDoneRecord).version === 1 &&
      typeof (value as TodayReadingDoneRecord).scopeKey === "string" &&
      Array.isArray((value as TodayReadingDoneRecord).doneKeys),
  );
}

function isTodayFractionRecord(value: unknown): value is TodayReadingChapterFractionRecord {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as TodayReadingChapterFractionRecord).version === 1 &&
      typeof (value as TodayReadingChapterFractionRecord).scopeKey === "string" &&
      typeof (value as TodayReadingChapterFractionRecord).fractions === "object",
  );
}

function isHabitStats(value: unknown): value is ReadingHabitStatsRecord {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as ReadingHabitStatsRecord).version === 1 &&
      Array.isArray((value as ReadingHabitStatsRecord).completedDates),
  );
}

function isTypographyPrefs(value: unknown): value is ReadBibleTypographyPrefsV1 {
  return Boolean(value && typeof value === "object" && typeof (value as ReadBibleTypographyPrefsV1).size === "string");
}

function isTranslationBundle(value: unknown): value is ReadBibleTranslationSyncBundle {
  return Boolean(value && typeof value === "object" && (value as ReadBibleTranslationSyncBundle).version === 1);
}

function isRecentSearches(value: unknown): value is ScriptureRecentSearchesRecord {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as ScriptureRecentSearchesRecord).version === 1 &&
      Array.isArray((value as ScriptureRecentSearchesRecord).terms),
  );
}

function isHomeNatureUi(value: unknown): value is NatureHomeUiSyncBundle {
  return Boolean(value && typeof value === "object" && (value as NatureHomeUiSyncBundle).version === 1);
}

function isHomePrayerVerse(value: unknown): value is HomePrayerVersePrefsV1 {
  return Boolean(
    value && typeof value === "object" && (value as HomePrayerVersePrefsV1).version === 1,
  );
}

function isHomeVersePoolScope(value: unknown): value is { version: 1; scopeId: HomeVersePoolScopeId } {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as { version?: unknown }).version === 1 &&
      typeof (value as { scopeId?: unknown }).scopeId === "string",
  );
}

function isNatureSceneUi(value: unknown): value is NatureSceneUiSyncBundle {
  return Boolean(value && typeof value === "object" && (value as NatureSceneUiSyncBundle).version === 1);
}

function isMusicVisualTheme(value: unknown): value is { version: 1; theme: MusicVisualTheme } {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as { version?: unknown }).version === 1 &&
      typeof (value as { theme?: unknown }).theme === "string",
  );
}

function isScripturePlaybackRate(value: unknown): value is { version: 1; rate: number } {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as { version?: unknown }).version === 1 &&
      typeof (value as { rate?: unknown }).rate === "number",
  );
}

function isCuvAudioVoice(value: unknown): value is { version: 1; voiceId: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as { version?: unknown }).version === 1 &&
      typeof (value as { voiceId?: unknown }).voiceId === "string",
  );
}

function isExploreProfileBundle(value: unknown): value is { version: 1; profile: ExploreYearDayProfile } {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as { version?: unknown }).version === 1 &&
      typeof (value as { profile?: unknown }).profile === "object",
  );
}

function isAppLocaleBundle(value: unknown): value is { version: 1; locale: AppLocale } {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as { version?: unknown }).version === 1 &&
      typeof (value as { locale?: unknown }).locale === "string",
  );
}

async function applyBlob(key: MemberReadingSyncBlobKey, value: unknown): Promise<void> {
  const catalog = bundledBibleTranslationsCatalog();
  switch (key) {
    case "bookmarks":
      if (isBookmarkStore(value)) {
        await replaceScriptureVerseBookmarkStore(parseScriptureVerseBookmarkStore(JSON.stringify(value)));
      }
      break;
    case "highlights":
      if (isHighlightStore(value)) await replaceVerseTextHighlightStore(value);
      break;
    case "lastPosition":
      if (isLastPosition(value)) await writeLastReadPosition(value);
      break;
    case "chapterCompletion":
      if (isChapterCompletion(value)) await replaceReadChapterCompletionRecord(value);
      break;
    case "readingPlanPrefs":
      if (value === null) await writeReadingPlanPrefs(null);
      else if (isReadingPlanPrefs(value)) await writeReadingPlanPrefs(value);
      break;
    case "tripleLoopProgress":
      if (isTripleLoopState(value)) await writeTripleLoopProgress(value);
      break;
    case "todayReadingDone":
      if (isTodayDoneRecord(value)) await replaceTodayReadingDoneRecord(value);
      break;
    case "todayReadingFraction":
      if (isTodayFractionRecord(value)) await replaceTodayReadingChapterFractionRecord(value);
      break;
    case "habitStats":
      if (isHabitStats(value)) await replaceReadingHabitStatsRecord(value);
      break;
    case "readTypography":
      if (isTypographyPrefs(value)) await writeReadBibleTypographyPrefs(value);
      break;
    case "readTranslation":
      if (isTranslationBundle(value)) await applyReadBibleTranslationSyncBundle(value, catalog);
      break;
    case "recentSearches":
      if (isRecentSearches(value)) await replaceScriptureRecentSearches(value);
      break;
    case "homeNatureUi":
      if (isHomeNatureUi(value)) await applyNatureHomeUiSyncBundle(value);
      break;
    case "homePrayerVerse":
      if (isHomePrayerVerse(value)) await writeHomePrayerVersePrefs(value);
      break;
    case "homeVersePoolScope":
      if (isHomeVersePoolScope(value)) {
        await replaceHomeVersePoolScopeForSync(value.scopeId as HomeVersePoolScopeId);
      }
      break;
    case "natureSceneUi":
      if (isNatureSceneUi(value)) await applyNatureSceneUiSyncBundle(value);
      break;
    case "musicVisualTheme":
      if (isMusicVisualTheme(value)) await writeMusicVisualTheme(value.theme);
      break;
    case "scripturePlaybackRate":
      if (isScripturePlaybackRate(value)) {
        await writeScripturePlaybackRate(normalizeScripturePlaybackRate(value.rate));
      }
      break;
    case "cuvAudioVoice":
      if (isCuvAudioVoice(value) && isCuvChapterAudioVoiceId(value.voiceId)) {
        await writeCuvChapterAudioVoice(value.voiceId);
      }
      break;
    case "exploreYearDayProfile":
      if (isExploreProfileBundle(value)) {
        const { profile } = value;
        if (profile.birthDate && profile.displayName) {
          await writeExploreYearDayProfile({
            birthDate: profile.birthDate,
            displayName: profile.displayName,
            weddingAnniversary: profile.weddingAnniversary,
            baptismDate: profile.baptismDate,
          });
        } else if (profile.birthDate) {
          await writeExploreBirthDate(profile.birthDate);
        }
      }
      break;
    case "appLocale":
      if (isAppLocaleBundle(value)) await setLocale(parseLocale(value.locale));
      break;
    default:
      break;
  }
}

export async function applyMemberReadingSyncBlobs(
  blobs: Partial<Record<MemberReadingSyncBlobKey, MemberReadingSyncBlob>> | undefined,
): Promise<void> {
  if (!blobs) return;
  for (const key of MEMBER_READING_SYNC_BLOB_KEYS) {
    const blob = blobs[key];
    if (!blob) continue;
    await applyBlob(key, blob.value);
  }
}
