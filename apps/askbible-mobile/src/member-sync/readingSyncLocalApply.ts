import { bundledBibleTranslationsCatalog } from "../api/fetchBibleTranslationsCatalog";
import { readCuvChapterAudioVoice, writeCuvChapterAudioVoice } from "../bible/cuv-chapter-audio-voice-prefs";
import { isCuvChapterAudioVoiceId } from "../bible/cuv-chapter-audio-voices";
import {
  parseScriptureVerseBookmarkStore,
} from "../bible/scripture-verse-bookmark-store";
import {
  getScriptureVerseBookmarkStore,
  replaceScriptureVerseBookmarkStore,
} from "../bible/scripture-verse-bookmarks";
import { readExploreYearDayProfile, writeExploreBirthDate, writeExploreYearDayProfile } from "../explore/explore-birth-year-prefs";
import {
  replaceHomeVersePoolScopeForSync,
} from "../home/homeVersePoolScopePrefs";
import type { HomeVersePoolScopeId } from "../explore/explore-home-verse-pool-scopes";
import {
  writeHomePrayerVersePrefs,
} from "../home/homePrayerVersePrefs";
import {
  applyNatureHomeUiSyncBundle,
} from "../home/natureHomePrefs";
import { parseLocale } from "../i18n/config";
import { setLocale } from "../i18n/locale-store";
import {
  writeMusicVisualTheme,
} from "../music/music-visual-theme-prefs";
import {
  normalizeScripturePlaybackRate,
  writeScripturePlaybackRate,
} from "../music/music-playback-prefs";
import { writeLastReadPosition } from "../read/read-last-position";
import {
  replaceReadChapterCompletionRecord,
} from "../read/read-chapter-completion";
import {
  applyReadBibleTranslationSyncBundle,
} from "../read/read-bible-translation-prefs";
import {
  writeReadBibleTypographyPrefs,
} from "../read/read-bible-typography-prefs";
import {
  replaceVerseTextHighlightStore,
} from "../read/read-verse-text-highlights";
import {
  replaceReadingHabitStatsRecord,
} from "../read/reading-habit-stats";
import { writeReadingPlanPrefs } from "../read/reading-plan/reading-plan-prefs";
import {
  replaceTripleLoopProgress,
} from "../read/reading-plan/triple-loop-progress";
import {
  normalizeTodayReadingDoneForLocalPrefs,
  replaceTodayReadingDoneRecord,
} from "../read/reading-plan/today-reading-done";
import {
  normalizeTodayReadingFractionForLocalPrefs,
  replaceTodayReadingChapterFractionRecord,
} from "../read/reading-plan/today-reading-chapter-fraction";
import {
  replaceScriptureRecentSearches,
} from "../read/scripture-recent-searches";
import {
  applyNatureSceneUiSyncBundle,
} from "./natureSceneUiSync";
import {
  type MemberReadingSyncBlobKey,
} from "./schema";
import {
  isAppLocaleBundle,
  isBookmarkStore,
  isChapterCompletion,
  isCuvAudioVoice,
  isExploreProfileBundle,
  isHabitStats,
  isHighlightStore,
  isHomeNatureUi,
  isHomePrayerVerse,
  isHomeVersePoolScope,
  isLastPosition,
  isMusicVisualTheme,
  isNatureSceneUi,
  isReadingPlanPrefs,
  isRecentSearches,
  isScripturePlaybackRate,
  isTodayDoneRecord,
  isTodayFractionRecord,
  isTranslationBundle,
  isTripleLoopState,
  isTypographyPrefs,
} from "./readingSyncBlobValidators";

export async function applyReadingSyncBlob(key: MemberReadingSyncBlobKey, value: unknown): Promise<void> {
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
      if (isTripleLoopState(value)) await replaceTripleLoopProgress(value);
      break;
    case "todayReadingDone":
      if (isTodayDoneRecord(value)) {
        await replaceTodayReadingDoneRecord(await normalizeTodayReadingDoneForLocalPrefs(value));
      }
      break;
    case "todayReadingFraction":
      if (isTodayFractionRecord(value)) {
        await replaceTodayReadingChapterFractionRecord(
          await normalizeTodayReadingFractionForLocalPrefs(value),
        );
      }
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
