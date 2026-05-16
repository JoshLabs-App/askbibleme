import { after, NextResponse } from "next/server";
import {
  getInfoEditionReaderCache,
  tryBeginInfoEditionPending,
} from "@/lib/bible/info-edition-v1-reader-cache";
import { runInfoEditionV1ReaderGenerationJob } from "@/lib/bible/info-edition-v1-reader-job";
import { scriptureBooks } from "@/lib/bible/scripture-books";
import { isStudioDiskSaveAllowed } from "@/lib/studio-disk-save";

export const maxDuration = 300;

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

const noStore = { headers: { "Cache-Control": "no-store" } };

export async function GET(req: Request) {
  const parsed = parseBookChapter(new URL(req.url).searchParams);
  if ("error" in parsed) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }
  const cache = getInfoEditionReaderCache(process.cwd(), parsed.bookId, parsed.chapter);
  return NextResponse.json({ ok: true, ...cache }, noStore);
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
    return NextResponse.json({ ok: true, status: "ready", published: cached.published }, noStore);
  }
  if (cached.status === "pending") {
    return NextResponse.json({ ok: true, status: "pending" }, noStore);
  }

  const began = tryBeginInfoEditionPending(cwd, bookId, chapter);
  if (!began) {
    return NextResponse.json({ ok: true, status: "pending" }, noStore);
  }

  after(() => runInfoEditionV1ReaderGenerationJob(cwd, bookId, chapter));

  return NextResponse.json({ ok: true, status: "pending" }, noStore);
}
