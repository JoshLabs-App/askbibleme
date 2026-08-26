/**
 * 金句音频：单池文字全量展示；语音仅首次点播时从安装包准备（不走 Render）。
 * Android 大体积日后再用商店 PAD；当前 sync 打全量 zip 进 assets。
 */
export const GOLDEN_VERSE_POOL_STATIC_SCOPE_ID = "theme-repeat-ge5" as const;

/** 本机已解压的全量语音包至少有这么多 mp3，才视为「语音已准备好」。 */
export const GOLDEN_VERSE_AUDIO_READY_MIN_FILES = 500;
