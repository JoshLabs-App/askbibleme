import fs from "node:fs";
import { NextResponse } from "next/server";
import { isMobileBundledScriptureTranslationId } from "@/lib/bible/mobile-bundled-scripture-ids";
import { readBibleTranslationRegistry } from "@/lib/bible/providers/registry";
import { scriptureSqlitePath } from "@/lib/bible/scripture-sqlite-db";

/**
 * 移动 App：全量译本目录（含本地、内置与远端注册译本）。
 */
export async function GET() {
  try {
    const cwd = process.cwd();
    const index = readBibleTranslationRegistry(cwd);
    const translations = index.translations.map((t) => {
      const bundled = isMobileBundledScriptureTranslationId(t.id);
      const isRemote = Boolean(t.provider && t.provider !== "local");
      let bytes = 0;
      try {
        if (!isRemote) {
          const p = scriptureSqlitePath(cwd, t.id);
          if (fs.existsSync(p)) {
            bytes = fs.statSync(p).size;
          }
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
        downloadUrl: isRemote ? null : `/api/mobile/bible/translations/${encodeURIComponent(t.id)}/sqlite`,
        provider: t.provider,
        remoteId: t.remoteId ?? null,
        delivery: t.delivery,
        enabled: t.enabled,
        copyright: t.copyright ?? null,
        publisherUrl: t.publisherUrl ?? null,
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
