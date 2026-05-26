/** 首页自然场景：竖屏下自左向右平移一整遍的时长（秒）；与 `lib/nature/nature-home-portrait-pan.ts` 同步 */
export const NATURE_HOME_PORTRAIT_PAN_DURATION_SEC = 30 * 60;

/** 自然场景横屏片源常见比例；用于估算 cover 后水平可平移距离 */
export const NATURE_HOME_VIDEO_LANDSCAPE_ASPECT = 16 / 9;

/** @deprecated 竖屏起始于左侧，不再单独静止等待；保留导出以免旧引用报错 */
export const NATURE_HOME_PORTRAIT_PAN_DELAY_SEC = 0;
