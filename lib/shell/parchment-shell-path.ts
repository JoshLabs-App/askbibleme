import { normalizeAppPath } from "@/lib/shell/narrow-parchment-shell";

/**
 * 不使用全屏羊皮卷壳的路由（自然视频首页、场景选择、音乐暗色沉浸、后台等）。
 * 其余前台页面默认羊皮卷底 + 暖色 `--brand-*`。
 */
export function isParchmentShellExcludedPath(pathname: string): boolean {
  const p = normalizeAppPath(pathname);
  if (p === "/" || p === "/nature" || p.startsWith("/nature/") || p === "/tv" || p.startsWith("/tv/")) {
    return true;
  }
  if (p === "/scenes" || p.startsWith("/scenes/")) return true;
  if (p === "/music" || p.startsWith("/music/")) return true;
  if (p === "/admin" || p.startsWith("/admin/")) return true;
  if (p === "/studio" || p.startsWith("/studio/")) return true;
  return false;
}

export function isParchmentShellPath(pathname: string): boolean {
  return !isParchmentShellExcludedPath(pathname);
}
