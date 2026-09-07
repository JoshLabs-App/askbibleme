/**
 * 未内置进安装包、但已把整本 sqlite 传到 R2 的译本：`/api/mobile/bible/translations`
 * 用这张表给 App 一个真实可下的 `downloadUrl`（App 选中该译本时按需拉一次，装到本机后离线可读）。
 * 上传：`npx wrangler r2 object put askbible-media/bible/{id}.sqlite --file=data/bible/sqlite/{id}.sqlite --remote`。
 * 不在这张表里的非内置译本，`downloadUrl` 仍是 null——尚未上传，不假装可下载。
 */
const R2_PUBLIC_BASE = "https://pub-f30fb48025d841f09c37bb9b52df5354.r2.dev";

const MOBILE_SCRIPTURE_R2_DOWNLOAD_IDS = new Set<string>(["kjv"]);

export function mobileScriptureR2DownloadUrl(id: string): string | null {
  const trimmed = String(id || "").trim().toLowerCase();
  if (!trimmed || !MOBILE_SCRIPTURE_R2_DOWNLOAD_IDS.has(trimmed)) return null;
  return `${R2_PUBLIC_BASE}/bible/${trimmed}.sqlite`;
}
