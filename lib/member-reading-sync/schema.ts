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
  "scriptureListenTotals",
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

export type MemberReadingSyncDocumentV1 = {
  schemaVersion: 1;
  userId: string;
  revision: string;
  updatedAt: string;
  blobs: Partial<Record<MemberReadingSyncBlobKey, MemberReadingSyncBlob>>;
};

export type MemberReadingSyncPushV1 = {
  schemaVersion: 1;
  blobs: Partial<Record<MemberReadingSyncBlobKey, MemberReadingSyncBlob>>;
};

export const MEMBER_READING_SYNC_META_KEY = "askbible.member-reading-sync-meta.v1";

export type MemberReadingSyncMeta = {
  revision: string | null;
  lastSyncedAt: string | null;
  /** 本机同步数据当前归属的会员 id；切换帐号时用于隔离。 */
  boundUserId?: string | null;
  /** 登出清空后：下次登录只拉云端。 */
  requirePullOnly?: boolean;
};

export function isMemberReadingSyncBlobKey(key: string): key is MemberReadingSyncBlobKey {
  return (MEMBER_READING_SYNC_BLOB_KEYS as readonly string[]).includes(key);
}

export function parseIsoMs(iso: string | undefined): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}
