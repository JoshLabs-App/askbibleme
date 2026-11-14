import { NextResponse } from "next/server";
import { readBibleTranslationRegistry } from "@/lib/bible/providers/registry";

/**
 * 构建期生成静态 JSON（内容只来自仓库里的译本注册表，不依赖请求）。
 * 每个页面加载都会取一次，不应每次都唤起函数；也不依赖运行时 fs，边缘运行时可用。
 */
export const dynamic = "force-static";

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
