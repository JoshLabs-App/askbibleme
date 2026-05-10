import fs from "node:fs/promises";
import path from "node:path";
import { STUDIO_DOC_ENTRIES } from "@/lib/studio-config";

/** 服务端读取 `docs/*.md`，供 `/studio` 与 `/admin/studio` 共用 */
export async function loadStudioInitialDocuments(cwd = process.cwd()): Promise<Record<string, string>> {
  const initial: Record<string, string> = {};
  for (const { id } of STUDIO_DOC_ENTRIES) {
    const filePath = path.join(cwd, "docs", `${id}.md`);
    try {
      initial[id] = await fs.readFile(filePath, "utf-8");
    } catch (e) {
      const code = (e as NodeJS.ErrnoException)?.code;
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[Studio] 无法读取 ${id}.md（${code ?? "unknown"}）：${msg}`);
      initial[id] = "";
    }
  }
  return initial;
}
