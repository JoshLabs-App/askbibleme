import type { ShellMediaSessionPayload } from "./shellMediaControls";

export type ShellAuxMediaOwner = {
  id: string;
  pause: () => void | Promise<void>;
  resume: () => void | Promise<void>;
  buildPayload: () => ShellMediaSessionPayload | null;
  /**
   * 壳层主曲接手时让路：只停轨，不标成用户锁屏暂停（否则主曲结束后环境音不会自动回）。
   * 未实现时回退到 pause。
   */
  yieldPlayback?: () => void | Promise<void>;
};

let owner: ShellAuxMediaOwner | null = null;

/** 环境音 / 金句等非壳层主播放器：占用锁屏控制时注册，离开时清空。 */
export function setShellAuxMediaOwner(next: ShellAuxMediaOwner | null): void {
  owner = next;
}

export function getShellAuxMediaOwner(): ShellAuxMediaOwner | null {
  return owner;
}

/** 壳层音乐独占前：立刻停掉环境音/金句等 aux，不依赖首页是否仍在渲染（freezeOnBlur）。 */
export async function pauseShellAuxMediaOwner(): Promise<void> {
  const aux = owner;
  if (!aux) return;
  try {
    await (aux.yieldPlayback ?? aux.pause)();
  } catch {
    /* ignore */
  }
}
