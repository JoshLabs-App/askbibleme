/**
 * 是否允许通过当前部署环境访问「可编辑产品文档 / 管理」相关界面与 API
 *（`/admin`、`/api/admin`、`/studio`、`/api/studio`、`/api/ai`）。
 *
 * `/api/ai` 须一并保护：`/chat` 曾接受任意 `baseUrl`（SSRF / 盗用服务端 API Key）、
 * `/local-models` 可对任意地址发起服务端请求、`/preset` 可能把环境变量中的网关密钥返回给匿名调用方。
 *
 * - `NODE_ENV === "development"`（`npm run dev`）：默认允许。
 * - `VERCEL_ENV === "production"`：默认不允许，除非 `SELAH_ALLOW_ADMIN_IN_PRODUCTION=1`。
 * - 其它（如 Vercel Preview、`next start` 本机）：默认允许。
 * - 任意非 development 若需关闭：`SELAH_DISABLE_PUBLIC_ADMIN=1`。
 */
export function isSelahOnlineEditorSurfaceAllowed(): boolean {
  if (process.env.NODE_ENV === "development") {
    return true;
  }
  if (process.env.SELAH_DISABLE_PUBLIC_ADMIN === "1") {
    return false;
  }
  if (process.env.VERCEL_ENV === "production") {
    return process.env.SELAH_ALLOW_ADMIN_IN_PRODUCTION === "1";
  }
  return true;
}
