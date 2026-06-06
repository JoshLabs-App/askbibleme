import fs from "node:fs";
import { NextResponse } from "next/server";
import { isMobileBundledScriptureTranslationId } from "@/lib/bible/mobile-bundled-scripture-ids";
import { scriptureSqlitePath } from "@/lib/bible/scripture-sqlite-db";
import { readTranslationsIndex } from "@/lib/bible/translations-store";

/**
 * 移动 App：全量译本目录（含是否内置、SQLite 体积与下载路径）。
 */
export async function GET() {
  try {
    const cwd = process.cwd();
    const index = await readTranslationsIndex(cwd);
    const translations = index.translations.map((t) => {
      const bundled = isMobileBundledScriptureTranslationId(t.id);
      let bytes = 0;
      try {
        const p = scriptureSqlitePath(cwd, t.id);
        if (fs.existsSync(p)) {
          bytes = fs.statSync(p).size;
        }
      } catch {
        bytes = 0;
      }
      return {
        id: t.id,
        labelZh: t.labelZh,
        labelEn: t.labelEn,
        language: t.language,
        bundled,
        bytes,
        downloadUrl: bundled ? null : `/api/mobile/bible/translations/${encodeURIComponent(t.id)}/sqlite`,
      };
    });

    return NextResponse.json(
      {
        version: 1 as const,
        translations,
        defaultTranslationId: index.defaultTranslationId,
      },
      { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=86400" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ version: 1 as const, translations: [], error: msg }, { status: 200 });
  }
}
