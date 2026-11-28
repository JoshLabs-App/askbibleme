/**
 * 是否允许通过当前部署环境访问管理相关界面与 API
 *（`/admin`、`/api/admin` 与线上批量运维入口）。
 *
 * - `NODE_ENV === "development"`（`npm run dev`）：默认允许。
 * - 任意生产环境（`NODE_ENV === "production"`，含 Cloudflare Workers 与本机 `next start`）：默认不允许，除非显式设 `SELAH_ALLOW_ADMIN_IN_PRODUCTION=1`。
 * - 任意非 development 若需强制关闭：`SELAH_DISABLE_PUBLIC_ADMIN=1`。
 */
export function isSelahOnlineEditorSurfaceAllowed(): boolean {
  if (process.env.NODE_ENV === "development") {
    return true;
  }
  if (process.env.SELAH_DISABLE_PUBLIC_ADMIN === "1") {
    return false;
  }
  if (process.env.NODE_ENV === "production") {
    return process.env.SELAH_ALLOW_ADMIN_IN_PRODUCTION === "1";
  }
  return true;
}
