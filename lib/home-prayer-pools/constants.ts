/** 与 `public/data/home-prayer-pools/` 下目录名一致（`all` 或分类 `id`） */
export const HOME_PRAYER_POOL_PUBLIC_BASE = "/data/home-prayer-pools";

export const HOME_PRAYER_POOL_CHUNK_SIZE = 20;

export const HOME_PRAYER_PREFS_STORAGE_KEY = "selah-home-verse-prefs-v1";

/** 与 `verseDisplay` 同步，供 RSC 只解析需要的轮播语言（单语不解析另一语言） */
export const VERSE_DISPLAY_COOKIE_NAME = "selah_verse_display";

/** 首页经文设置：读本目录（公开 GET） */
export const HOME_BIBLE_TRANSLATIONS_CATALOG_URL = "/api/home/bible-translations-catalog";

/** 轮播接近末尾时预取更多条数 */
export const HOME_PRAYER_FEED_BATCH_SIZE = 28;

export const HOME_PRAYER_PREFETCH_REMAINING = 12;
