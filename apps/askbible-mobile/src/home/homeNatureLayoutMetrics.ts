import { shellPlaybackTransportMetrics as tm } from "../shell/shellPlaybackTransportLayout";

/** 首页布局尺寸：无副作用，供 StyleSheet 与高度计算共用，避免 Fast Refresh 半更新 ReferenceError。 */

export const HOME_SCENE_STRIP_EDGE_PAD = 16;
/** 横屏沉浸：场景条/环境音条左右留白加大 */
export const HOME_SCENE_STRIP_LANDSCAPE_EDGE_PAD = 48;
/** 横屏沉浸：缩略图槽位更贴底 */
export const HOME_SCENE_THUMB_LANDSCAPE_SLOT_PAD = 4;
export const AMBIENT_ICON_SIZE = 36;
/** 环境音图标槽宽（无底下文案） */
export const AMBIENT_CHIP_WIDTH = AMBIENT_ICON_SIZE;
/** 环境音图标在芯片内的左右留白（图标居中） */
export const HOME_AMBIENT_CHIP_INSET = (AMBIENT_CHIP_WIDTH - AMBIENT_ICON_SIZE) / 2;
/** 环境音芯片总高（仅图标） */
export const AMBIENT_CHIP_HEIGHT = AMBIENT_ICON_SIZE;
/** 环境音 / 快捷行 / 专辑条共用：略拉开，减少误点相邻图标 */
export const AMBIENT_ICON_GAP = 16;
/** 底栏各排图标之间的上下间距（环境音 / 场景 / 专辑/金句），以图标外沿对齐 */
export const HOME_BOTTOM_ICON_ROW_GAP = 22;
/** 首页专辑/播放条高度：与音乐页播放键同高 */
export const HOME_ALBUM_ROW_H = tm.playBtnSize;
/** 首页四枚专辑图标：比播放坞 loop 图标大一号 */
export const HOME_ALBUM_ICON_SIZE = tm.loopIconSize + 4;
/** 字号 / 定时侧组：与 72 播放钮同行，不宜再拉开 */
export const QUICK_CONTROL_ICON_GAP = 16;
/** 播放行字号/定时触控边长（不随环境音图标放大） */
export const QUICK_CONTROL_HIT_SIZE = 32;
/** 底栏「字号 / 定时」独立行的触控边长，即该行行高 */
export const HOME_SCALE_TIMER_ROW_H = 36;
