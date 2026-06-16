import { NextResponse } from "next/server";
import { buildInfoEditionV3BatchStatusPayload } from "@/lib/bible/info-edition-v3-batch-status";
import {
  readV3BatchUiConfig,
  startV3BatchProcess,
  stopV3BatchProcess,
  writeV3BatchUiConfig,
  type InfoEditionV3BatchUiConfig,
} from "@/lib/bible/info-edition-v3-batch-runner";
import {
  readInfoEditionV3BatchState,
  writeInfoEditionV3BatchState,
} from "@/lib/bible/info-edition-v3-batch-state";
import { isStudioDiskSaveAllowed } from "@/lib/studio-disk-save";

function disk403() {
  return NextResponse.json(
    {
      error:
        "未允许读/写磁盘：开发环境默认可用；生产请设置 STUDIO_ALLOW_DISK_SAVE=1、STUDIO_WRITE_SECRET，并携带 Authorization: Bearer …",
    },
    { status: 403 },
  );
}

export async function infoEditionV3BatchGetResponse(cwd: string, req: Request) {
  if (!isStudioDiskSaveAllowed(req)) return disk403();
  return NextResponse.json(buildInfoEditionV3BatchStatusPayload(cwd), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function infoEditionV3BatchPostResponse(cwd: string, req: Request) {
  if (!isStudioDiskSaveAllowed(req)) return disk403();

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const action = typeof body.action === "string" ? body.action.trim() : "";

  async function waitForProcessExit(timeoutMs = 5000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const payload = buildInfoEditionV3BatchStatusPayload(cwd);
      if (!payload.process?.alive) return true;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return false;
  }

  if (action === "save-config") {
    const prev = readV3BatchUiConfig(cwd);
    const next: InfoEditionV3BatchUiConfig = {
      bookStart: typeof body.bookStart === "string" ? body.bookStart.trim().toUpperCase() : prev.bookStart,
      bookEnd: typeof body.bookEnd === "string" ? body.bookEnd.trim().toUpperCase() : prev.bookEnd,
      delayMs:
        typeof body.delayMs === "number" && body.delayMs >= 0
          ? Math.min(body.delayMs, 60_000)
          : prev.delayMs,
      skipCorrected:
        typeof body.skipCorrected === "boolean" ? body.skipCorrected : prev.skipCorrected,
    };
    writeV3BatchUiConfig(cwd, next);
    return NextResponse.json({
      ...buildInfoEditionV3BatchStatusPayload(cwd),
      message: "设置已保存。",
    });
  }

  if (action === "reset-cursor") {
    const state = readInfoEditionV3BatchState(cwd);
    if (state.running) {
      return NextResponse.json({ ok: false, error: "请先停止运行中的任务。" }, { status: 409 });
    }
    state.cursor = { bookIndex: 0, chapter: 1 };
    writeInfoEditionV3BatchState(cwd, state);
    return NextResponse.json({
      ...buildInfoEditionV3BatchStatusPayload(cwd),
      message: "光标已重置到创世记第 1 章。",
    });
  }

  if (action === "stop") {
    const result = stopV3BatchProcess(cwd);
    await waitForProcessExit();
    return NextResponse.json({
      ...buildInfoEditionV3BatchStatusPayload(cwd),
      message: result.ok ? "已发送停止信号。" : result.error,
    });
  }

  if (action === "start" || action === "start-full-bible") {
    const fullBible = action === "start-full-bible";
    const payload = buildInfoEditionV3BatchStatusPayload(cwd);
    if (fullBible && payload.fullBible?.complete && body.force !== true) {
      return NextResponse.json(
        {
          ok: false,
          error: "全本已标记处理完毕。若要全书重跑，请勾选「强制重跑」后再启动。",
        },
        { status: 409 },
      );
    }

    const result = startV3BatchProcess(cwd, {
      force: body.force === true,
      fullBible,
      bookStart: typeof body.bookStart === "string" ? body.bookStart : undefined,
      bookEnd: typeof body.bookEnd === "string" ? body.bookEnd : undefined,
      delayMs: typeof body.delayMs === "number" ? body.delayMs : undefined,
      skipCorrected:
        typeof body.skipCorrected === "boolean" ? body.skipCorrected : undefined,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 409 });
    }

    return NextResponse.json({
      ...buildInfoEditionV3BatchStatusPayload(cwd),
      message: `已启动 V3 批量纠错（PID ${result.pid}）· DeepSeek 找错并写回发布缓存。`,
    });
  }

  return NextResponse.json({ ok: false, error: `未知 action：${action}` }, { status: 400 });
}
