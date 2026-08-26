export const MUSIC_HOME_QUEUE_ROW_HEIGHT = 40;
export const MUSIC_HOME_QUEUE_VIEWPORT_HEIGHT = 168;
export const MUSIC_HOME_QUEUE_FADE_BAND = 46;
/** 列表首尾的留白，保证任意一行都能滚到视口正中。 */
export const MUSIC_HOME_QUEUE_CENTER_PAD =
  MUSIC_HOME_QUEUE_VIEWPORT_HEIGHT / 2 - MUSIC_HOME_QUEUE_ROW_HEIGHT / 2;

const ROW_OPACITY = 0.92;
const ACTIVE_SCALE = 1.14;
const SCALE_GAIN = 0.08;

type Interp = { inputRange: number[]; outputRange: number[] };

/**
 * 行的淡入淡出与缩放都是滚动位置的分段线性函数，所以能整段交给原生动画驱动。
 *
 * 之前每帧在 JS 里按 scrollY 重算每一行，滚动时 60Hz 打 setState，整棵音乐页跟着重渲染。
 * 现在只在挂载时算一次 inputRange，滚动过程 JS 零参与。
 */

/** 行中心正好落在视口顶端时的滚动位置；行中心 = 这个值减去当前 scrollY。 */
function rowCenterAtZeroScroll(rowIndex: number): number {
  return rowIndex * MUSIC_HOME_QUEUE_ROW_HEIGHT + MUSIC_HOME_QUEUE_ROW_HEIGHT / 2;
}

export function musicHomeQueueRowOpacityInterp(rowIndex: number): Interp {
  const c = rowCenterAtZeroScroll(rowIndex);
  const vh = MUSIC_HOME_QUEUE_VIEWPORT_HEIGHT;
  const band = MUSIC_HOME_QUEUE_FADE_BAND;
  // scrollY 递增 = 行往上走。四个拐点：滑出底部、下淡入完成、上淡出开始、滑出顶部。
  return {
    inputRange: [c - vh, c - (vh - band), c - band, c],
    outputRange: [0, ROW_OPACITY, ROW_OPACITY, 0],
  };
}

export function musicHomeQueueRowScaleInterp(rowIndex: number): Interp {
  const c = rowCenterAtZeroScroll(rowIndex);
  const center = MUSIC_HOME_QUEUE_VIEWPORT_HEIGHT / 2;
  const reach = center * 0.85;
  return {
    inputRange: [c - (center + reach), c - center, c - (center - reach)],
    outputRange: [1, 1 + SCALE_GAIN, 1],
  };
}

export const MUSIC_HOME_QUEUE_ACTIVE_OPACITY = 1;
export const MUSIC_HOME_QUEUE_ACTIVE_SCALE = ACTIVE_SCALE;
