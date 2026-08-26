import { NextResponse } from "next/server";
import {
  getInfoEditionReaderCacheAsync,
  resolveInfoEditionReaderTarget,
} from "@/lib/bible/info-edition-v1-reader-persistence";
import { scriptureBooks } from "@/lib/bible/scripture-books";

export const runtime = "nodejs";

function parseBookChapter(searchParams: URLSearchParams): { bookId: string; chapter: number } | { error: string } {
  const bookId = searchParams.get("bookId")?.trim().toUpperCase() ?? "";
  const chapter = Number(searchParams.get("chapter"));
  if (!bookId) return { error: "缺少 bookId。" };
  const bookMeta = scriptureBooks.find((b) => b.bookId === bookId);
  if (!bookMeta) return { error: "无效书卷。" };
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > bookMeta.chapters) {
    return { error: "无效章号。" };
  }
  return { bookId, chapter };
}

function parseEditionTarget(cwd: string, searchParams: URLSearchParams) {
  return resolveInfoEditionReaderTarget(cwd, {
    edition: searchParams.get("edition"),
    roleId: searchParams.get("roleId"),
  });
}

const noStore = { headers: { "Cache-Control": "no-store" } };

/** 只读已发布导读；现场生成已下线。 */
export async function GET(req: Request) {
  try {
    const cwd = process.cwd();
    const url = new URL(req.url);
    const parsed = parseBookChapter(url.searchParams);
    if ("error" in parsed) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    }
    const target = parseEditionTarget(cwd, url.searchParams);
    if ("error" in target) {
      return NextResponse.json({ ok: false, error: target.error }, { status: 400 });
    }
    const cache = await getInfoEditionReaderCacheAsync(cwd, parsed.bookId, parsed.chapter, target);
    return NextResponse.json({ ok: true, edition: target.variant, ...cache }, noStore);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[info-edition-v1] GET failed", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500, ...noStore });
  }
}

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      status: "failed",
      error: "导读现场生成已下线，请使用已发布内容。",
      code: "generate_disabled",
    },
    { status: 410, ...noStore },
  );
}
