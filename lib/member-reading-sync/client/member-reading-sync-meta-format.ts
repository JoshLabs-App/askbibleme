/** 抽屉 / 详情里展示上次同步时间（对齐 App `memberReadingSyncDebugFormat`）。 */
export function formatMemberReadingSyncMetaTime(
  iso: string | null | undefined,
  locale: string,
): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const loc = locale === "en" ? "en-US" : locale === "zh-TW" ? "zh-TW" : "zh-CN";
  return d.toLocaleString(loc, {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
