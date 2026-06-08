/**
 * 离线优先（播放与读经内容）：
 * - 已下载 / 安装包内资源优先，不常规直连远端媒体 URL 播放
 * - 读经页打开时不拉 askbible.me（译本目录、章音频、导读版等走本地）
 * - 联网拉目录 / manifest / 按需下载仅走侧栏「资料更新」等显式流程
 */
export function isMobileOfflineFirst(): boolean {
  const flag = process.env.EXPO_PUBLIC_MOBILE_OFFLINE_FIRST?.trim();
  if (flag === "0") return false;
  if (flag === "1") return true;
  return true;
}

/**
 * 纯本地包：为 `1` 时禁止请求 askbible.me（无目录同步、无按需下载）。
 * 与 `EXPO_PUBLIC_MOBILE_OFFLINE_FIRST` 独立；生产 TestFlight 应为 `0`（包内 1 首 + 联网拉列表/下载）。
 */
export function isMobileBundledOnly(): boolean {
  const flag = process.env.EXPO_PUBLIC_MOBILE_BUNDLED_ONLY?.trim();
  if (flag === "0") return false;
  if (flag === "1") return true;
  return !__DEV__;
}

/**
 * 读经正文/导读/目录等：离线优先，不常规打 askbible.me。
 * 整章朗读播放见 `isMobileScriptureAudioStreamAllowed`（未下载时可联网）。
 */
export function isMobileScriptureReadLocalOnly(): boolean {
  return isMobileOfflineFirst() || isMobileBundledOnly();
}

/** 章朗读：已下载/包内优先；未下载时允许 FHL 闫大卫等远端流式（仅 BUNDLED_ONLY=1 时完全禁止）。 */
export function isMobileScriptureAudioStreamAllowed(): boolean {
  return !isMobileBundledOnly();
}

export { isMemberRegisterEnabled } from "../auth/member-register-enabled";
