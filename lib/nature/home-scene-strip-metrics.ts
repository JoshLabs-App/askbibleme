/** 与 App `HomeSceneThumb` / `HomeNatureScreen` 对齐的横向场景条尺寸 */
export const HOME_SCENE_THUMB_SIZE = 64;
export const HOME_SCENE_THUMB_GAP = 10;
export const HOME_SCENE_THUMB_SLOT_PAD = 10;
export const HOME_SCENE_THUMB_SLOT_WIDTH = HOME_SCENE_THUMB_SIZE + HOME_SCENE_THUMB_SLOT_PAD;
export const HOME_SCENE_THUMB_STRIDE = HOME_SCENE_THUMB_SLOT_WIDTH + HOME_SCENE_THUMB_GAP;
export const HOME_SCENE_STRIP_EDGE_PAD = 22;

export const AMBIENT_ICON_SIZE = 28;
export const AMBIENT_ICON_GAP = 10;

/** 浮层 Tab 占位（与 App `SHELL_TAB_BAR_CLEARANCE` 一致） */
export const NATURE_HOME_TAB_BAR_CLEARANCE_PX = 72;

export const SCENE_LOOP_ALL_ID = "__askbible_all_scene_loop__";
export const SCENE_LOOP_SWITCH_MS = 30 * 60 * 1000;

export function homeSceneStripContentWidth(itemCount: number): number {
  if (itemCount <= 0) return 0;
  return (
    itemCount * HOME_SCENE_THUMB_SLOT_WIDTH +
    Math.max(0, itemCount - 1) * HOME_SCENE_THUMB_GAP
  );
}

export function homeSceneStripScrollX(
  index: number,
  viewportWidth: number,
  itemCount: number,
  edgePadding = HOME_SCENE_STRIP_EDGE_PAD,
): number {
  if (itemCount <= 0 || viewportWidth < 1 || index < 0) return 0;
  const contentW = homeSceneStripContentWidth(itemCount) + edgePadding * 2;
  const x = edgePadding + index * HOME_SCENE_THUMB_STRIDE;
  const maxScroll = Math.max(0, contentW - viewportWidth);
  const centered = x - (viewportWidth - HOME_SCENE_THUMB_SLOT_WIDTH) / 2;
  return Math.max(0, Math.min(centered, maxScroll));
}

export function ambientStripContentWidth(count: number): number {
  if (count <= 0) return HOME_SCENE_STRIP_EDGE_PAD * 2;
  return (
    count * AMBIENT_ICON_SIZE +
    Math.max(0, count - 1) * AMBIENT_ICON_GAP +
    HOME_SCENE_STRIP_EDGE_PAD * 2
  );
}
