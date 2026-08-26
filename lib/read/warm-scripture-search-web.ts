/** 已预热的译本 id（对齐 App `warmScriptureSearchDatabase`）。 */
const warmedTranslationIds = new Set<string>();

/** 轻量请求打开服务端 SQLite，缩短首次搜索冷启动。 */
export async function warmScriptureSearchWeb(translationId: string): Promise<void> {
  const id = String(translationId || "").trim();
  if (!id || warmedTranslationIds.has(id)) return;
  warmedTranslationIds.add(id);
  try {
    const params = new URLSearchParams({
      q: "神",
      translationId: id,
      scope: "all",
    });
    const res = await fetch(`/api/read/scripture-search?${params.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) warmedTranslationIds.delete(id);
  } catch {
    warmedTranslationIds.delete(id);
  }
}
