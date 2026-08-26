import { SHELL_TAB_BAR_CLEARANCE } from "../shell/shellLayout";
import {
  SHELL_SCRIPTURE_DOCK_CONTENT_HEIGHT,
  SHELL_TAB_BAR_DOCK_GAP,
} from "../shell/shellPlaybackTransportLayout";

/** 读经章底栏：快捷操作行叠在 Tab 导航之上（已空，仅 Scrim / 非章页兼容） */
export const READ_CHAPTER_ACTION_ROW_HEIGHT = 40;
export const READ_CHAPTER_ACTION_ROW_GAP = 6;
/** 快捷操作行距屏幕左右缘（与 safe-area 取较大值） */
export const READ_CHAPTER_ACTION_ROW_PAD_X = 22;
export const READ_CHAPTER_SCROLL_BOTTOM_BASE = SHELL_TAB_BAR_CLEARANCE + 28;

/** 非章页：旧快捷行占位（Scrim / 首页滚动） */
export const READ_CHAPTER_SCROLL_BOTTOM_EXTRA =
  READ_CHAPTER_ACTION_ROW_HEIGHT + READ_CHAPTER_ACTION_ROW_GAP;

/** 章页固定播放坞占位（坞内容 + 与 Tab 行间距） */
export const READ_CHAPTER_SCRIPTURE_DOCK_SCROLL_EXTRA =
  SHELL_SCRIPTURE_DOCK_CONTENT_HEIGHT + SHELL_TAB_BAR_DOCK_GAP;

export function readChapterScrollBottomPad(safeBottom: number, withScriptureDock: boolean): number {
  const base = READ_CHAPTER_SCROLL_BOTTOM_BASE + safeBottom;
  return withScriptureDock ? base + READ_CHAPTER_SCRIPTURE_DOCK_SCROLL_EXTRA : base;
}

export type ReadChapterBottomChromeApi = {
  openCatalog?: () => void;
  goNext: () => void;
  hasNext: boolean;
};

type Listener = () => void;
const listeners = new Set<Listener>();
let bottomChromeApi: ReadChapterBottomChromeApi | null = null;

function sameBottomChromeApi(
  a: ReadChapterBottomChromeApi | null,
  b: ReadChapterBottomChromeApi | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.hasNext === b.hasNext;
}

export function getReadChapterBottomChromeApi(): ReadChapterBottomChromeApi | null {
  return bottomChromeApi;
}

export function setReadChapterBottomChromeApi(api: ReadChapterBottomChromeApi | null): void {
  if (sameBottomChromeApi(bottomChromeApi, api)) return;
  bottomChromeApi = api;
  listeners.forEach((l) => l());
}

export function subscribeReadChapterBottomChromeApi(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
