/** 横向滑动最小位移（px） */
export const SHELL_SWIPE_MIN_DX = 56;

export type ShellSwipeDirection = "left" | "right";

/** 当前路由是否支持壳层左右滑（由各页注册具体动作） */
export function resolveShellSwipeSurface(pathname: string): "home" | "music" | "read-chapter" | null {
  const p = pathname.replace(/\/$/, "") || "/";
  if (p === "/" || p === "/(tabs)" || p === "/(tabs)/index") return "home";
  if (p.includes("/music")) return "music";
  if (/\/read\/[^/]+\/\d+$/.test(p)) return "read-chapter";
  return null;
}

export function shellSwipeDirection(dx: number): ShellSwipeDirection | null {
  if (Math.abs(dx) < SHELL_SWIPE_MIN_DX) return null;
  return dx < 0 ? "left" : "right";
}

/** 手指左划 → -1（序列向左）；右划 → +1（序列向右） */
export function shellSwipeIndexDelta(direction: ShellSwipeDirection): -1 | 1 {
  return direction === "left" ? -1 : 1;
}
