import fsp from "node:fs/promises";
import { NextResponse } from "next/server";
import { scriptureSqlitePath } from "@/lib/bible/scripture-sqlite-db";
import { readTranslationsIndex } from "@/lib/bible/translations-store";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * 下载指定译本的 SQLite（非内置译本走此接口；内置译本仍随 App 资源包分发）。
 */
export async function GET(_req: Request, context: RouteContext) {
  try {
    const { id: rawId } = await context.params;
    const id = String(rawId || "").trim();
    if (!id || id.includes("..") || id.includes("/")) {
      return NextResponse.json({ error: "invalid_translation_id" }, { status: 400 });
    }

    const cwd = process.cwd();
    const index = await readTranslationsIndex(cwd);
    if (!index.translations.some((t) => t.id === id)) {
      return NextResponse.json({ error: "translation_not_found" }, { status: 404 });
    }

    const absPath = scriptureSqlitePath(cwd, id);
    const stat = await fsp.stat(absPath).catch(() => null);
    if (!stat?.isFile() || stat.size <= 0) {
      return NextResponse.json({ error: "sqlite_missing" }, { status: 404 });
    }

    const body = await fsp.readFile(absPath);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/x-sqlite3",
        "Content-Length": String(stat.size),
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
