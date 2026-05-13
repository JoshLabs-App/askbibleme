/**
 * 首页 / 轮播等短展示用：去掉和修等译本中的括注，减轻行长与断行压力（不改动译本源文件）。
 *
 * - `〔…〕`：如「原文作…」类译注
 * - 经节**开头**重复的半角 `(…)` 或全角 `（…）`：如诗前的「(上行之诗)」「（大卫的诗）」
 */
export function stripZhVerseDisplayNotes(text: string): string {
  const raw = text.trim();
  if (!raw) return "";

  let s = raw.replace(/\u3014[\s\S]*?\u3015/g, "");

  for (let i = 0; i < 8; i++) {
    const next = s.replace(/^\s*\([^)]*\)\s*/, "").replace(/^\s*（[^）]*）\s*/, "");
    if (next === s) break;
    s = next;
  }

  const collapsed = s.replace(/\s{2,}/g, " ").trim();
  return collapsed.length > 0 ? collapsed : raw;
}
