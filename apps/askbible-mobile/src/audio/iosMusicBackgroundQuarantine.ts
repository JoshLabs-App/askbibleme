import { AppState, Platform, type AppStateStatus } from "react-native";
import {
  getShellMusicWantPlaying,
  subscribeShellMusicWantPlaying,
} from "./shellMusicWantPlaying";
import {
  getShellVerseWantPlaying,
  subscribeShellVerseWantPlaying,
} from "./shellVerseWantPlaying";
import {
  getShellScriptureWantPlaying,
  subscribeShellScriptureWantPlaying,
} from "./shellScriptureWantPlaying";

let musicBackgroundMinimal = false;
const minimalListeners = new Set<() => void>();

/** iOS：音乐/读经播放且非前台时，卸掉导航/视频重层（金句不卸导航，避免拆掉金句 hook）。 */
export function isIosMusicBackgroundMinimal(): boolean {
  return Platform.OS === "ios" && musicBackgroundMinimal;
}

export function subscribeIosMusicBackgroundMinimal(onChange: () => void): () => void {
  minimalListeners.add(onChange);
  return () => {
    minimalListeners.delete(onChange);
  };
}

function setMusicBackgroundMinimal(next: boolean): void {
  if (musicBackgroundMinimal === next) return;
  musicBackgroundMinimal = next;
  for (const cb of minimalListeners) cb();
}

/**
 * iOS 音乐锁屏：卸掉导航/视频重层。环境音关屏后继续，不在这里停。
 * 金句 hook 挂在 Home 上，卸导航会 stopFully，故金句不卸导航。
 */
export function installIosMusicBackgroundQuarantine(): () => void {
  if (Platform.OS !== "ios") return () => {};

  let delay: ReturnType<typeof setTimeout> | null = null;

  const run = (state: AppStateStatus) => {
    const musicOn = getShellMusicWantPlaying();
    const scriptureOn = getShellScriptureWantPlaying();
    const verseOn = getShellVerseWantPlaying();
    // 只对音乐卸导航。读经/金句卸导航会拆掉页面 cleanup，易误 pause 原生引擎。
    const wantMinimal = state !== "active" && musicOn && !verseOn && !scriptureOn;
    if (delay) {
      clearTimeout(delay);
      delay = null;
    }
    if (!wantMinimal) {
      setMusicBackgroundMinimal(false);
      return;
    }
    // 延迟卸 UI：先让原生抢会话，避免锁屏瞬间同步拆掉整棵 RN 树拖高 CPU。
    delay = setTimeout(() => {
      delay = null;
      if (AppState.currentState === "active") return;
      if (getShellVerseWantPlaying()) return;
      if (!getShellMusicWantPlaying() && !getShellScriptureWantPlaying()) return;
      setMusicBackgroundMinimal(true);
    }, 500);
  };

  run(AppState.currentState);
  const sub = AppState.addEventListener("change", run);
  const unsubWant = subscribeShellMusicWantPlaying(() => run(AppState.currentState));
  const unsubVerse = subscribeShellVerseWantPlaying(() => run(AppState.currentState));
  const unsubScripture = subscribeShellScriptureWantPlaying(() => run(AppState.currentState));
  return () => {
    sub.remove();
    unsubWant();
    unsubVerse();
    unsubScripture();
    if (delay) clearTimeout(delay);
    setMusicBackgroundMinimal(false);
  };
}
