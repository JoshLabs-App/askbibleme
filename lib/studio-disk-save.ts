import { STUDIO_DOC_ENTRIES } from "./studio-config";
import { isExtraStudioDocId } from "./studio-doc-manifest";

/**
 * 是否允许将 Studio 文档写回项目 docs/*.md。
 * - `next dev`（NODE_ENV=development）默认允许，可用 STUDIO_DISABLE_DISK_SAVE=1 关闭。
 * - `next start` 等：设 STUDIO_ALLOW_DISK_SAVE=1 且 STUDIO_WRITE_SECRET，请求须带
 *   `Authorization: Bearer <同一密钥>`。
 */
export function isStudioDiskSaveAllowed(req: Request): boolean {
  if (process.env.STUDIO_DISABLE_DISK_SAVE === "1") {
    return false;
  }
  if (process.env.NODE_ENV === "development") {
    return true;
  }
  if (process.env.STUDIO_ALLOW_DISK_SAVE !== "1") {
    return false;
  }
  const secret = process.env.STUDIO_WRITE_SECRET?.trim();
  if (!secret) {
    return false;
  }
  const auth =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  return auth === secret;
}

export function isStudioDocId(id: string): boolean {
  if (STUDIO_DOC_ENTRIES.some((e) => e.id === id)) return true;
  return isExtraStudioDocId(id);
}
