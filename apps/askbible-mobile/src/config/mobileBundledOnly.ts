/**
 * 内容策略（AskBible.me App）：
 *
 * **不拉主站内容库**（自然/音乐更新包、探索、金句池远程、内容 manifest、译本目录远程、导读远程生成）：
 * - 默认开启（含 `__DEV__` 真机联调）
 * - 仅当 `EXPO_PUBLIC_MOBILE_BUNDLED_ONLY=0` 时关闭（本机联调内容 API）
 *
 * **仍可走网站 / 外站**（用户明确保留）：
 * - 音乐：曲目清单 JSON + 非首曲音频走 Cloudflare R2（禁止 askbible.me）
 * - 账号：Supabase Auth 直连；删号走 Edge Function `delete-account`
 * - 读经同步 / 反馈 / 纠错：Supabase 表直连（须先执行 supabase/migrations/20260812_app_direct_sync_feedback.sql）
 * - 圣经音频：章朗读（FHL / YouVersion / WEB / 潮语 / 主站 `/audio` 语音包）
 * - YouVersion 正文：设备直抓 bible.com（不经主站章 API）
 * - 译本正文：安装包内置 sqlite，或按章 chapter-api（无主站整本 sqlite 下载）
 *
 * `EXPO_PUBLIC_MOBILE_OFFLINE_FIRST`：读经正文/导读优先本地（可与 BUNDLED_ONLY 叠用）。
 */

export function isMobileOfflineFirst(): boolean {
  const flag = process.env.EXPO_PUBLIC_MOBILE_OFFLINE_FIRST?.trim();
  if (flag === "0") return false;
  if (flag === "1") return true;
  return true;
}

/**
 * 内容纯本地包：禁止请求主站的自然/音乐/探索等内容类 API 与媒体更新包。
 * 未显式配置时默认开启（开发与生产一致）。
 */
export function isMobileBundledOnly(): boolean {
  const flag = process.env.EXPO_PUBLIC_MOBILE_BUNDLED_ONLY?.trim();
  if (flag === "0") return false;
  if (flag === "1") return true;
  return true;
}

/** 读经正文/导读/目录：离线优先或不打主站内容。 */
export function isMobileScriptureReadLocalOnly(): boolean {
  return isMobileOfflineFirst() || isMobileBundledOnly();
}

/**
 * 章朗读外站流式：默认允许（FHL / YouVersion / 潮语等）。
 * `EXPO_PUBLIC_MOBILE_CHAPTER_AUDIO_STREAM=0` 可关掉。
 */
export function isMobileScriptureAudioStreamAllowed(): boolean {
  const flag = process.env.EXPO_PUBLIC_MOBILE_CHAPTER_AUDIO_STREAM?.trim();
  if (flag === "0") return false;
  if (flag === "1") return true;
  return true;
}

/** 圣经相关（章朗读音频）是否允许打主站。与内容库（自然/音乐/探索）分离。 */
export function isMobileScriptureSiteRemoteAllowed(): boolean {
  return true;
}

export { isMemberRegisterEnabled } from "../auth/member-register-enabled";
