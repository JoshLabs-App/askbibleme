import type { ExploreYearDayProfile } from "../explore/explore-birth-year-prefs";
import type { HomeVersePoolScopeId } from "../home/homeVersePoolScopePrefs";
import { isHomeVersePoolMenuScopeId } from "@/lib/home-prayer-pools/home-verse-pool-menu-scopes";
import type { HomePrayerVersePrefsV1 } from "../home/homePrayerVersePrefs";
import type { NatureHomeUiSyncBundle } from "../home/natureHomePrefs";
import type { AppLocale } from "../i18n/config";
import type { MusicVisualTheme } from "../music/music-visual-theme-prefs";
import type { ReadLastPosition } from "../read/read-last-position";
import type { ReadChapterCompletionRecord } from "../read/read-chapter-completion";
import type { ReadBibleTranslationSyncBundle } from "../read/read-bible-translation-prefs";
import type { ReadBibleTypographyPrefsV1 } from "../read/read-bible-typography-prefs";
import type { VerseTextHighlightStore } from "../read/read-verse-text-highlights";
import type { ReadingHabitStatsRecord } from "../read/reading-habit-stats";
import type { NtDeepRepeatReadingState } from "../read/reading-plan/nt-deep-repeat-reading";
import type { ReadingPlanPrefs } from "../read/reading-plan/reading-plan-prefs";
import type { TripleLoopReadingState } from "../read/reading-plan/triple-loop-reading";
import type { TodayReadingChapterFractionRecord } from "../read/reading-plan/today-reading-chapter-fraction";
import type { TodayReadingDoneRecord } from "../read/reading-plan/today-reading-done";
import type { ScriptureRecentSearchesRecord } from "../read/scripture-recent-searches";
import type { ScriptureVerseBookmarkStore } from "../bible/scripture-verse-bookmark-store";
import type { NatureSceneUiSyncBundle } from "./natureSceneUiSync";

export function isBookmarkStore(value: unknown): value is ScriptureVerseBookmarkStore {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function isHighlightStore(value: unknown): value is VerseTextHighlightStore {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function isLastPosition(value: unknown): value is ReadLastPosition {
  if (!value || typeof value !== "object") return false;
  const v = value as ReadLastPosition;
  return Boolean(v.bookId && Number.isInteger(v.chapter) && v.chapter >= 1);
}

export function isChapterCompletion(value: unknown): value is ReadChapterCompletionRecord {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as ReadChapterCompletionRecord).version === 1 &&
      Array.isArray((value as ReadChapterCompletionRecord).completed),
  );
}

export function isReadingPlanPrefs(value: unknown): value is ReadingPlanPrefs {
  if (!value || typeof value !== "object") return false;
  return typeof (value as ReadingPlanPrefs).planId === "string";
}

export function isTripleLoopState(value: unknown): value is TripleLoopReadingState {
  if (!value || typeof value !== "object") return false;
  const v = value as TripleLoopReadingState;
  return Boolean(v.ot && v.nt && v.wisdom);
}

export function isNtDeepRepeatState(value: unknown): value is NtDeepRepeatReadingState {
  if (!value || typeof value !== "object") return false;
  const v = value as NtDeepRepeatReadingState;
  return Boolean(
    v.ot &&
      typeof v.curriculumIndex === "number" &&
      typeof v.dayInSegment === "number" &&
      typeof v.pace === "number",
  );
}

export function isTodayDoneRecord(value: unknown): value is TodayReadingDoneRecord {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as TodayReadingDoneRecord).version === 1 &&
      typeof (value as TodayReadingDoneRecord).scopeKey === "string" &&
      Array.isArray((value as TodayReadingDoneRecord).doneKeys),
  );
}

export function isTodayFractionRecord(value: unknown): value is TodayReadingChapterFractionRecord {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as TodayReadingChapterFractionRecord).version === 1 &&
      typeof (value as TodayReadingChapterFractionRecord).scopeKey === "string" &&
      typeof (value as TodayReadingChapterFractionRecord).fractions === "object",
  );
}

export function isHabitStats(value: unknown): value is ReadingHabitStatsRecord {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as ReadingHabitStatsRecord).version === 1 &&
      Array.isArray((value as ReadingHabitStatsRecord).completedDates),
  );
}

export function isTypographyPrefs(value: unknown): value is ReadBibleTypographyPrefsV1 {
  return Boolean(value && typeof value === "object" && typeof (value as ReadBibleTypographyPrefsV1).size === "string");
}

export function isTranslationBundle(value: unknown): value is ReadBibleTranslationSyncBundle {
  return Boolean(value && typeof value === "object" && (value as ReadBibleTranslationSyncBundle).version === 1);
}

export function isRecentSearches(value: unknown): value is ScriptureRecentSearchesRecord {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as ScriptureRecentSearchesRecord).version === 1 &&
      Array.isArray((value as ScriptureRecentSearchesRecord).terms),
  );
}

export function isHomeNatureUi(value: unknown): value is NatureHomeUiSyncBundle {
  return Boolean(value && typeof value === "object" && (value as NatureHomeUiSyncBundle).version === 1);
}

export function isHomePrayerVerse(value: unknown): value is HomePrayerVersePrefsV1 {
  return Boolean(
    value && typeof value === "object" && (value as HomePrayerVersePrefsV1).version === 1,
  );
}

export function isHomeVersePoolScope(value: unknown): value is { version: 1; scopeId: HomeVersePoolScopeId } {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as { version?: unknown }).version === 1 &&
      typeof (value as { scopeId?: unknown }).scopeId === "string" &&
      isHomeVersePoolMenuScopeId(String((value as { scopeId?: unknown }).scopeId)),
  );
}

export function isNatureSceneUi(value: unknown): value is NatureSceneUiSyncBundle {
  return Boolean(value && typeof value === "object" && (value as NatureSceneUiSyncBundle).version === 1);
}

export function isMusicVisualTheme(value: unknown): value is { version: 1; theme: MusicVisualTheme } {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as { version?: unknown }).version === 1 &&
      typeof (value as { theme?: unknown }).theme === "string",
  );
}

export function isScripturePlaybackRate(value: unknown): value is { version: 1; rate: number } {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as { version?: unknown }).version === 1 &&
      typeof (value as { rate?: unknown }).rate === "number",
  );
}

export function isCuvAudioVoice(value: unknown): value is { version: 1; voiceId: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as { version?: unknown }).version === 1 &&
      typeof (value as { voiceId?: unknown }).voiceId === "string",
  );
}

export function isExploreProfileBundle(value: unknown): value is { version: 1; profile: ExploreYearDayProfile } {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as { version?: unknown }).version === 1 &&
      typeof (value as { profile?: unknown }).profile === "object",
  );
}

export function isAppLocaleBundle(value: unknown): value is { version: 1; locale: AppLocale } {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as { version?: unknown }).version === 1 &&
      typeof (value as { locale?: unknown }).locale === "string",
  );
}

export function exploreProfileHasData(profile: ExploreYearDayProfile): boolean {
  return Boolean(
    profile.birthDate ||
      profile.displayName ||
      profile.weddingAnniversary ||
      profile.baptismDate,
  );
}
