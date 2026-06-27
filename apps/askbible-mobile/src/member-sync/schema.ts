export const MEMBER_READING_SYNC_SCHEMA_VERSION = 1;

export const MEMBER_READING_SYNC_BLOB_KEYS = [
  "bookmarks",
  "highlights",
  "lastPosition",
  "chapterCompletion",
  "tripleLoopProgress",
  "ntDeepRepeatProgress",
  "readingPlanPrefs",
  "todayReadingDone",
  "todayReadingFraction",
  "habitStats",
  "readTypography",
  "readTranslation",
  "recentSearches",
  "homeNatureUi",
  "homePrayerVerse",
  "homeVersePoolScope",
  "natureSceneUi",
  "musicVisualTheme",
  "scripturePlaybackRate",
  "cuvAudioVoice",
  "exploreYearDayProfile",
  "appLocale",
] as const;

export type MemberReadingSyncBlobKey = (typeof MEMBER_READING_SYNC_BLOB_KEYS)[number];

export type MemberReadingSyncBlob = {
  updatedAt: string;
  value: unknown;
};

export type MemberReadingSyncPushV1 = {
  schemaVersion: 1;
  blobs: Partial<Record<MemberReadingSyncBlobKey, MemberReadingSyncBlob>>;
};

export type MemberReadingSyncResponseV1 = {
  ok: boolean;
  schemaVersion: 1;
  revision?: string;
  updatedAt?: string;
  blobs?: Partial<Record<MemberReadingSyncBlobKey, MemberReadingSyncBlob>>;
  error?: string;
  code?: string;
};

export function isMemberReadingSyncBlobKey(key: string): key is MemberReadingSyncBlobKey {
  return (MEMBER_READING_SYNC_BLOB_KEYS as readonly string[]).includes(key);
}

export function parseIsoMs(iso: string | undefined): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

export const MEMBER_READING_SYNC_META_KEY = "askbible.member-reading-sync-meta.v1";

export type MemberReadingSyncMeta = {
  revision: string | null;
  lastSyncedAt: string | null;
};
