import { NextResponse } from "next/server";
import { generateInfoEditionChapterForReader } from "@/lib/bible/info-edition-v1-generate-reader";
import {
  clearInfoEditionPending,
  getInfoEditionReaderCache,
  setInfoEditionReaderFailed,
  tryBeginInfoEditionPending,
} from "@/lib/bible/info-edition-v1-reader-cache";
import { scriptureBooks } from "@/lib/bible/scripture-books";
import { isStudioDiskSaveAllowed } from "@/lib/studio-disk-save";

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

export async function GET(req: Request) {
  const parsed = parseBookChapter(new URL(req.url).searchParams);
  if ("error" in parsed) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }
  const cache = getInfoEditionReaderCache(process.cwd(), parsed.bookId, parsed.chapter);
  return NextResponse.json(
    { ok: true, ...cache },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: Request) {
  if (!isStudioDiskSaveAllowed(req)) {
    return NextResponse.json(
      {
        ok: false,
        error: "本章导读生成仅在开发环境可用；线上需接入数据库后再开放。",
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const bookId =
    typeof o.bookId === "string"
      ? o.bookId.trim().toUpperCase()
      : new URL(req.url).searchParams.get("bookId")?.trim().toUpperCase() ?? "";
  const chapter = Number(
    o.chapter ?? new URL(req.url).searchParams.get("chapter"),
  );
  const bookMeta = scriptureBooks.find((b) => b.bookId === bookId);
  if (!bookMeta) return NextResponse.json({ ok: false, error: "无效书卷。" }, { status: 400 });
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > bookMeta.chapters) {
    return NextResponse.json({ ok: false, error: "无效章号。" }, { status: 400 });
  }

  const cwd = process.cwd();
  const cached = getInfoEditionReaderCache(cwd, bookId, chapter);
  if (cached.status === "ready" && cached.published) {
    return NextResponse.json(
      { ok: true, status: "ready", published: cached.published },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  if (cached.status === "pending") {
    return NextResponse.json(
      { ok: true, status: "pending" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const began = tryBeginInfoEditionPending(cwd, bookId, chapter);
  if (!began) {
    return NextResponse.json(
      { ok: true, status: "pending" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const result = await generateInfoEditionChapterForReader(cwd, bookId, chapter);
    clearInfoEditionPending(cwd, bookId, chapter);
    if (!result.ok) {
      setInfoEditionReaderFailed(cwd, bookId, chapter, result.error);
      return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
    }
    return NextResponse.json(
      { ok: true, status: "ready", published: result.published },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    clearInfoEditionPending(cwd, bookId, chapter);
    const msg = e instanceof Error ? e.message : String(e);
    setInfoEditionReaderFailed(cwd, bookId, chapter, msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
