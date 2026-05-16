import { NextResponse } from "next/server";
import {
  getInfoEditionReaderCacheAsync,
  getInfoEditionReaderPersistence,
  infoEditionReaderGenerateBlockedReason,
  isInfoEditionReaderGenerateAllowed,
  tryBeginInfoEditionPendingAsync,
} from "@/lib/bible/info-edition-v1-reader-persistence";
import { runInfoEditionV1ReaderGenerationJob } from "@/lib/bible/info-edition-v1-reader-job";
import { scheduleInfoEditionV1ReaderJob } from "@/lib/bible/info-edition-v1-schedule-job";
import { scriptureBooks } from "@/lib/bible/scripture-books";

export const maxDuration = 300;
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

const noStore = { headers: { "Cache-Control": "no-store" } };

export async function GET(req: Request) {
  try {
    const parsed = parseBookChapter(new URL(req.url).searchParams);
    if ("error" in parsed) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    }
    const cache = await getInfoEditionReaderCacheAsync(process.cwd(), parsed.bookId, parsed.chapter);
    return NextResponse.json({ ok: true, ...cache }, noStore);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[info-edition-v1] GET failed", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500, ...noStore });
  }
}

export async function POST(req: Request) {
  try {
    if (!isInfoEditionReaderGenerateAllowed()) {
      const error =
        infoEditionReaderGenerateBlockedReason() ?? "本章导读生成暂不可用。";
      return NextResponse.json({ ok: false, error }, { status: 503, ...noStore });
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
    if (cached.status === "failed" && cached.error) {
      return NextResponse.json({ ok: true, status: "failed", error: cached.error }, noStore);
    }

    let began = false;
    try {
      began = await tryBeginInfoEditionPendingAsync(cwd, bookId, chapter);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[info-edition-v1] tryBegin pending failed", msg);
      return NextResponse.json(
        { ok: true, status: "failed", error: msg },
        { status: 200, ...noStore },
      );
    }

    if (!began) {
      return NextResponse.json({ ok: true, status: "pending" }, noStore);
    }

    /** Supabase / 无盘主机：同请求内跑完生成，避免 after() 未执行而一直 pending */
    if (getInfoEditionReaderPersistence(cwd) === "supabase") {
      await runInfoEditionV1ReaderGenerationJob(cwd, bookId, chapter);
      const afterCache = await getInfoEditionReaderCacheAsync(cwd, bookId, chapter);
      return NextResponse.json({ ok: true, ...afterCache }, noStore);
    }

    scheduleInfoEditionV1ReaderJob(cwd, bookId, chapter);

    return NextResponse.json({ ok: true, status: "pending" }, noStore);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[info-edition-v1] POST failed", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500, ...noStore });
  }
}
