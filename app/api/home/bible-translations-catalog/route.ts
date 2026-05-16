import { NextResponse } from "next/server";
import { readTranslationsIndex } from "@/lib/bible/translations-store";

/**
 * 首页经文设置：只读已安装译本目录（无敏感路径），供客户端下拉选择。
 */
export async function GET() {
  try {
    const index = await readTranslationsIndex(process.cwd());
    const translations = index.translations.map((t) => ({
      id: t.id,
      labelZh: t.labelZh,
      labelEn: t.labelEn,
      language: t.language,
    }));
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
