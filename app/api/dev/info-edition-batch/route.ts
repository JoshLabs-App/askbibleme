import { NextResponse } from "next/server";
import {
  countBatchProgress,
  readInfoEditionBatchState,
} from "@/lib/bible/info-edition-v1-batch-state";
import {
  pushPublishedToRemote,
  readBatchLogTail,
  readBatchLockPid,
  readBatchUiConfig,
  reconcileBatchRunningFlag,
  startBatchProcess,
  stopBatchProcess,
  writeBatchUiConfig,
  type InfoEditionBatchUiConfig,
} from "@/lib/bible/info-edition-v1-batch-runner";
import { loadPublishedInfoEditionChapter } from "@/lib/bible/info-edition-v1-published-store";
import {
  INFO_EDITION_GUIDE_V2_ROLE_ID,
  INFO_EDITION_V1_PUBLISH_ROLE_ID,
  type InfoEditionReaderVariant,
} from "@/lib/bible/info-edition-v1-publish";
import { scriptureBooks } from "@/lib/bible/scripture-books";

export const dynamic = "force-dynamic";

function devOnly(): NextResponse | null {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ ok: false, error: "仅开发环境可用。" }, { status: 404 });
  }
  return null;
}

function buildStatusPayload(cwd: string) {
  const editions: InfoEditionReaderVariant[] = ["info", "guide"];
  const processAlive = reconcileBatchRunningFlag(cwd);
  const pid = readBatchLockPid(cwd);
  const state = readInfoEditionBatchState(cwd, editions);
  const totalChapters = scriptureBooks.reduce((s, b) => s + b.chapters, 0);
  const progress = countBatchProgress(state, totalChapters);
  const config = readBatchUiConfig(cwd);

  const books = scriptureBooks.map((b) => {
    const row = state.books[b.bookId];
    let done = 0;
    for (let c = 1; c <= b.chapters; c++) {
      const ch = row?.byChapter[String(c)];
      for (const ed of state.editions) {
        if (ch?.[ed] === "ok" || ch?.[ed] === "skipped") done += 1;
      }
    }
    const total = b.chapters * state.editions.length;
    return {
      bookId: b.bookId,
      bookName: b.bookName,
      chapters: b.chapters,
      done,
      total,
      percent: total > 0 ? Math.round((done / total) * 100) : 0,
      syncedAt: row?.syncedAt ?? null,
      lastSyncError: row?.lastSyncError ?? null,
    };
  });

  const cursorBook = scriptureBooks[state.cursor.bookIndex];

  return {
    ok: true as const,
    process: { pid, alive: processAlive },
    config,
    logTail: readBatchLogTail(cwd),
    state: {
      running: state.running,
      startedAt: state.startedAt,
      updatedAt: state.updatedAt,
      skipExisting: state.skipExisting,
      force: state.force,
      editions: state.editions,
      stats: state.stats,
      lastRun: state.lastRun ?? null,
      cursor: {
        bookIndex: state.cursor.bookIndex,
        bookId: cursorBook?.bookId ?? null,
        bookName: cursorBook?.bookName ?? null,
        chapter: state.cursor.chapter,
        edition: state.editions[state.cursor.editionIndex] ?? "info",
      },
    },
    progress,
    books,
    sample: state.lastRun
      ? {
          info: loadPublishedInfoEditionChapter(cwd, state.lastRun.bookId, state.lastRun.chapter, {
            roleId: INFO_EDITION_V1_PUBLISH_ROLE_ID,
            variant: "info",
          }),
          guide: loadPublishedInfoEditionChapter(cwd, state.lastRun.bookId, state.lastRun.chapter, {
            roleId: INFO_EDITION_GUIDE_V2_ROLE_ID,
            variant: "guide",
          }),
        }
      : null,
  };
}

export async function GET() {
  const blocked = devOnly();
  if (blocked) return blocked;
  return NextResponse.json(buildStatusPayload(process.cwd()), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request) {
  const blocked = devOnly();
  if (blocked) return blocked;

  const cwd = process.cwd();
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const action = typeof body.action === "string" ? body.action.trim() : "";

  if (action === "save-config") {
    const prev = readBatchUiConfig(cwd);
    const next: InfoEditionBatchUiConfig = {
      remoteScpTarget:
        typeof body.remoteScpTarget === "string" ? body.remoteScpTarget.trim() : prev.remoteScpTarget,
      pushEachBook:
        typeof body.pushEachBook === "boolean" ? body.pushEachBook : prev.pushEachBook,
      bookStart: typeof body.bookStart === "string" ? body.bookStart.trim().toUpperCase() : prev.bookStart,
      bookEnd: typeof body.bookEnd === "string" ? body.bookEnd.trim().toUpperCase() : prev.bookEnd,
      delayMs:
        typeof body.delayMs === "number" && body.delayMs >= 0
          ? Math.min(body.delayMs, 60_000)
          : prev.delayMs,
      editions: prev.editions,
    };
    if (Array.isArray(body.editions)) {
      const eds = body.editions.filter(
        (e): e is InfoEditionReaderVariant => e === "info" || e === "guide",
      );
      if (eds.length) next.editions = eds;
    }
    writeBatchUiConfig(cwd, next);
    return NextResponse.json({ ...buildStatusPayload(cwd), message: "设置已保存。" });
  }

  if (action === "start") {
    const config = readBatchUiConfig(cwd);
    const result = startBatchProcess(cwd, {
      force: body.force === true,
      pushEachBook:
        typeof body.pushEachBook === "boolean" ? body.pushEachBook : config.pushEachBook,
      bookStart: typeof body.bookStart === "string" ? body.bookStart : config.bookStart,
      delayMs: typeof body.delayMs === "number" ? body.delayMs : config.delayMs,
      remoteScpTarget:
        typeof body.remoteScpTarget === "string" ? body.remoteScpTarget : config.remoteScpTarget,
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 409 });
    }
    return NextResponse.json({
      ...buildStatusPayload(cwd),
      message: `已启动批量任务（PID ${result.pid}）`,
    });
  }

  if (action === "stop") {
    const result = stopBatchProcess(cwd);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }
    return NextResponse.json({ ...buildStatusPayload(cwd), message: "已发送停止信号。" });
  }

  if (action === "push-remote") {
    const target =
      typeof body.remoteScpTarget === "string"
        ? body.remoteScpTarget
        : readBatchUiConfig(cwd).remoteScpTarget;
    const result = pushPublishedToRemote(cwd, target);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ...buildStatusPayload(cwd), message: "已推送到线上磁盘。" });
  }

  return NextResponse.json({ ok: false, error: `未知 action：${action}` }, { status: 400 });
}
