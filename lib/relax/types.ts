export type RelaxSettingsV1 = {
  version: 1;
  /** 同源或绝对 URL；空则仅显示渐变与呼吸动画 */
  videoSrc: string;
  /** 浏览器 `HTMLMediaElement.playbackRate` 典型范围 0.25–4 */
  playbackRate: number;
  posterSrc?: string;
};
