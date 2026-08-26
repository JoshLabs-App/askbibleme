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
  /** 本机同步数据当前归属的会员 id；切换帐号时用于隔离。 */
  boundUserId: string | null;
  /**
   * 登出时已清空本机同步数据：下次登录应只拉云端。
   * 卸载重装会丢掉本标记，不能把它当成「游客升级」；未绑定必须先看云端。
   */
  requirePullOnly: boolean;
  /** 最近一次失败原因；成功后清空。 */
  lastError?: string | null;
};
