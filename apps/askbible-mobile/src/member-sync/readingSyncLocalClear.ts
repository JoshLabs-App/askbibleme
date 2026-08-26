import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  CUV_CHAPTER_AUDIO_VOICE_STORAGE_KEY,
  CUV_CHAPTER_AUDIO_VOICE_STORAGE_KEY_LEGACY,
} from "../bible/cuv-chapter-audio-voices";
import {
  SCRIPTURE_VERSE_BOOKMARKS_STORAGE_KEY,
  SCRIPTURE_VERSE_BOOKMARKS_STORAGE_KEY_LEGACY,
} from "../bible/scripture-verse-bookmark-store";
import { replaceScriptureVerseBookmarkStore } from "../bible/scripture-verse-bookmarks";
import { clearExploreBirthDate } from "../explore/explore-birth-year-prefs";
import { HOME_PRAYER_PREFS_STORAGE_KEY, HOME_PRAYER_PREFS_STORAGE_KEY_LEGACY } from "../home/homePrayerVersePrefs";
import { HOME_VERSE_POOL_SCOPE_KEY } from "../home/homeVersePoolScopePrefs";
import { NATURE_HOME_PREFS_KEYS, NATURE_HOME_PREFS_LEGACY_KEYS } from "../home/natureHomePrefsKeys";
import { LOCALE_STORAGE_KEY, LOCALE_STORAGE_KEY_LEGACY } from "../i18n/config";
import { READ_BIBLE_TYPOGRAPHY_STORAGE_KEY } from "../read/read-bible-typography-prefs";
import {
  READ_BIBLE_TRANSLATION_MODE_STORAGE_KEY,
  READ_BIBLE_TRANSLATION_STORAGE_KEY,
} from "../read/read-bible-translation-prefs";
import { READ_VERSE_TEXT_HIGHLIGHTS_STORAGE_KEY } from "../read/read-verse-text-highlights";
import { replaceVerseTextHighlightStore } from "../read/read-verse-text-highlights";
import {
  clearReadingHabitStatsLocal,
  READING_HABIT_STATS_STORAGE_KEY,
  READING_HABIT_STATS_STORAGE_KEY_LEGACY,
} from "../read/reading-habit-stats";
import { clearScriptureListenTotalsLocal } from "../read/scripture-listen-totals";
import { SCRIPTURE_RECENT_SEARCHES_STORAGE_KEY } from "../read/scripture-recent-searches";
import {
  NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY,
} from "../read/reading-plan/nt-deep-repeat-progress";
import {
  READING_PLAN_PREFS_STORAGE_KEY,
  READING_PLAN_PREFS_STORAGE_KEY_LEGACY,
  writeReadingPlanPrefs,
} from "../read/reading-plan/reading-plan-prefs";
import {
  TODAY_READING_CHAPTER_FRACTION_KEY,
  TODAY_READING_CHAPTER_FRACTION_KEY_LEGACY,
} from "../read/reading-plan/today-reading-chapter-fraction";
import {
  TODAY_READING_DONE_STORAGE_KEY,
  TODAY_READING_DONE_STORAGE_KEY_LEGACY,
} from "../read/reading-plan/today-reading-done";
import {
  TRIPLE_LOOP_PROGRESS_STORAGE_KEY,
  TRIPLE_LOOP_PROGRESS_STORAGE_KEY_LEGACY,
  resetTripleLoopProgressToEpochDefault,
} from "../read/reading-plan/triple-loop-progress";
import { clearTodayPlanScriptureResume } from "../read/today-plan-scripture-resume";
import { writeMemberReadingSyncMeta } from "./memberReadingSyncApi";
import { beginApplyingRemoteMemberSync, endApplyingRemoteMemberSync } from "./readingSyncLocal";

const READ_CHAPTER_COMPLETION_KEY = "askbible-read-chapter-completion-v1";
const READ_CHAPTER_COMPLETION_KEY_LEGACY = "selah-read-chapter-completion-v1";
const READ_LAST_POSITION_KEY = "askbible-mobile-read-last-v1";
const MUSIC_VISUAL_THEME_KEY = "askbible-mobile-music-visual-theme-v1";
const SCRIPTURE_PLAYBACK_RATE_KEY = "askbible-mobile-scripture-playback-rate-v1";
const NATURE_ACTIVE_SCENE_KEY = "askbible-mobile-nature-active-scene-v1";
const NATURE_LOOP_ALL_KEY = "askbible-mobile-nature-scene-loop-all-v1";
const NATURE_AMBIENT_SCENE_KEY = "askbible-mobile-nature-ambient-scene-v1";
const NATURE_AMBIENT_VOLUME_KEY = "askbible-mobile-nature-ambient-master-volume-v1";
const NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY_V4 = "askbible-nt-deep-repeat-progress-v4";
const NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY_V3 = "askbible-nt-deep-repeat-progress-v3";
const HOME_VERSE_GAP_KEY = "askbible-home-verse-gap-sec-v1";

/** 会员 reading-sync 相关本机 key（含 legacy）；帐号切换时整批移除。 */
const MEMBER_READING_SYNC_LOCAL_KEYS: string[] = [
  SCRIPTURE_VERSE_BOOKMARKS_STORAGE_KEY,
  SCRIPTURE_VERSE_BOOKMARKS_STORAGE_KEY_LEGACY,
  READ_VERSE_TEXT_HIGHLIGHTS_STORAGE_KEY,
  READ_LAST_POSITION_KEY,
  READ_CHAPTER_COMPLETION_KEY,
  READ_CHAPTER_COMPLETION_KEY_LEGACY,
  READING_PLAN_PREFS_STORAGE_KEY,
  READING_PLAN_PREFS_STORAGE_KEY_LEGACY,
  TRIPLE_LOOP_PROGRESS_STORAGE_KEY,
  TRIPLE_LOOP_PROGRESS_STORAGE_KEY_LEGACY,
  NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY,
  NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY_V4,
  NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY_V3,
  TODAY_READING_DONE_STORAGE_KEY,
  TODAY_READING_DONE_STORAGE_KEY_LEGACY,
  TODAY_READING_CHAPTER_FRACTION_KEY,
  TODAY_READING_CHAPTER_FRACTION_KEY_LEGACY,
  READING_HABIT_STATS_STORAGE_KEY,
  READING_HABIT_STATS_STORAGE_KEY_LEGACY,
  "askbible-scripture-listen-totals-v1",
  READ_BIBLE_TYPOGRAPHY_STORAGE_KEY,
  READ_BIBLE_TRANSLATION_STORAGE_KEY,
  READ_BIBLE_TRANSLATION_MODE_STORAGE_KEY,
  SCRIPTURE_RECENT_SEARCHES_STORAGE_KEY,
  HOME_PRAYER_PREFS_STORAGE_KEY,
  HOME_PRAYER_PREFS_STORAGE_KEY_LEGACY,
  HOME_VERSE_POOL_SCOPE_KEY,
  HOME_VERSE_GAP_KEY,
  NATURE_HOME_PREFS_KEYS.verseAppearance,
  NATURE_HOME_PREFS_KEYS.textScale,
  NATURE_HOME_PREFS_KEYS.softFocus,
  NATURE_HOME_PREFS_KEYS.liveVideo,
  NATURE_HOME_PREFS_KEYS.chromeTune,
  NATURE_HOME_PREFS_KEYS.verseRotationSec,
  NATURE_HOME_PREFS_KEYS.goldenVerseAudioTranslation,
  NATURE_HOME_PREFS_KEYS.ttsPrefs,
  NATURE_HOME_PREFS_LEGACY_KEYS.verseAppearance,
  NATURE_HOME_PREFS_LEGACY_KEYS.textScale,
  NATURE_HOME_PREFS_LEGACY_KEYS.softFocus,
  NATURE_HOME_PREFS_LEGACY_KEYS.chromeTune,
  NATURE_HOME_PREFS_LEGACY_KEYS.ttsPrefs,
  NATURE_ACTIVE_SCENE_KEY,
  NATURE_LOOP_ALL_KEY,
  NATURE_AMBIENT_SCENE_KEY,
  NATURE_AMBIENT_VOLUME_KEY,
  MUSIC_VISUAL_THEME_KEY,
  SCRIPTURE_PLAYBACK_RATE_KEY,
  CUV_CHAPTER_AUDIO_VOICE_STORAGE_KEY,
  CUV_CHAPTER_AUDIO_VOICE_STORAGE_KEY_LEGACY,
  LOCALE_STORAGE_KEY,
  LOCALE_STORAGE_KEY_LEGACY,
];

/**
 * 清空本机会员读经同步数据（含内存缓存）。
 * 调用方须已设置 applyingRemoteMemberSync，或由此函数包一层。
 */
export async function clearLocalMemberReadingSyncBlobs(): Promise<void> {
  beginApplyingRemoteMemberSync();
  try {
    await AsyncStorage.multiRemove(MEMBER_READING_SYNC_LOCAL_KEYS);
    await Promise.all([
      replaceScriptureVerseBookmarkStore({}),
      replaceVerseTextHighlightStore({}),
      writeReadingPlanPrefs(null),
      resetTripleLoopProgressToEpochDefault(),
      clearReadingHabitStatsLocal(),
      clearScriptureListenTotalsLocal(),
      clearExploreBirthDate(),
      clearTodayPlanScriptureResume(),
    ]);
  } finally {
    endApplyingRemoteMemberSync();
  }
}

/** 退出登录：清本机同步数据，并标记下次登录只拉云端。 */
export async function clearMemberReadingLocalForSignOut(): Promise<void> {
  await clearLocalMemberReadingSyncBlobs();
  await writeMemberReadingSyncMeta({
    revision: null,
    lastSyncedAt: null,
    boundUserId: null,
    requirePullOnly: true,
  });
}
