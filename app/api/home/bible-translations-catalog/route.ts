import { NextResponse } from "next/server";
import { readBibleTranslationRegistry } from "@/lib/bible/providers/registry";

/**
 * 首页经文设置：已安装译本 + 远端注册译本目录（无敏感路径），供客户端下拉选择。
 */
export async function GET() {
  try {
    const index = readBibleTranslationRegistry(process.cwd());
    const translations = index.translations.map((t) => ({
      id: t.id,
      labelZh: t.labelZh,
      labelEn: t.labelEn,
      language: t.language,
      provider: t.provider,
      remoteId: t.remoteId ?? null,
      delivery: t.delivery,
      enabled: t.enabled,
      copyright: t.copyright ?? null,
      publisherUrl: t.publisherUrl ?? null,
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
