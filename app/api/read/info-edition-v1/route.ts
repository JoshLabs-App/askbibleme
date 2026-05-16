import { after, NextResponse } from "next/server";
import { runInfoEditionV1ReaderGenerationJob } from "@/lib/bible/info-edition-v1-reader-job";
import {
  getInfoEditionReaderCacheAsync,
  getInfoEditionReaderPersistence,
  isInfoEditionReaderGenerateAllowed,
  tryBeginInfoEditionPendingAsync,
} from "@/lib/bible/info-edition-v1-reader-persistence";
import { scriptureBooks } from "@/lib/bible/scripture-books";

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
  const cache = await getInfoEditionReaderCacheAsync(process.cwd(), parsed.bookId, parsed.chapter);
  return NextResponse.json({ ok: true, ...cache }, noStore);
}

export async function POST(req: Request) {
  if (!isInfoEditionReaderGenerateAllowed()) {
    const mode = getInfoEditionReaderPersistence();
    const error =
      mode === "none"
        ? "本章导读生成未启用：Render 请挂载 Disk（如 /mnt/data），并设 INFO_EDITION_DISK_SAVE=1、INFO_EDITION_DATA_DIR=/mnt/data、AI_API_KEY。"
        : "本章导读生成暂不可用。";
    return NextResponse.json({ ok: false, error }, { status: 503 });
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
  const cached = await getInfoEditionReaderCacheAsync(cwd, bookId, chapter);
  if (cached.status === "ready" && cached.published) {
    return NextResponse.json({ ok: true, status: "ready", published: cached.published }, noStore);
  }
  if (cached.status === "pending") {
    return NextResponse.json({ ok: true, status: "pending" }, noStore);
  }

  const began = await tryBeginInfoEditionPendingAsync(cwd, bookId, chapter);
  if (!began) {
    return NextResponse.json({ ok: true, status: "pending" }, noStore);
  }

  after(() => runInfoEditionV1ReaderGenerationJob(cwd, bookId, chapter));

  return NextResponse.json({ ok: true, status: "pending" }, noStore);
}
