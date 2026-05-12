/** 仅允许站内自然成片路径，防止把任意 URL 写进配置后借预取外泄 */
export function isPrefetchableNatureVideoSrc(src: string): boolean {
  const u = src.trim();
  if (!u.startsWith("/") || u.includes("..")) return false;
  if (!u.startsWith("/nature/uploads/")) return false;
  if (!u.toLowerCase().endsWith(".mp4")) return false;
  return true;
}
