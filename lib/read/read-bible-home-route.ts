import { isReadBibleHomeRoute } from "@/lib/read/read-route-chrome";

/** 读经 Tab 圣经首页（`/read`），不含章页与子页。 */
export function isReadBibleHomePath(pathname: string): boolean {
  return isReadBibleHomeRoute(pathname);
}
