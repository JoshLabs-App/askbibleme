import { NextResponse } from "next/server";
import {
  infoEditionOnlineBatchBlockedReason,
  isInfoEditionOnlineBatchEnabled,
} from "@/lib/bible/info-edition-batch-access";
import {
  pushPublishedToRemote,
  readBatchUiConfig,
  startBatchProcess,
  stopBatchProcess,
  writeBatchUiConfig,
  type InfoEditionBatchUiConfig,
} from "@/lib/bible/info-edition-v1-batch-runner";
import { writeInvalidPublishedScanCache } from "@/lib/bible/info-edition-invalid-scan-cache";
import { scanInvalidPublishedChapters } from "@/lib/bible/info-edition-scan-invalid-published";
import { buildInfoEditionBatchStatusPayload } from "@/lib/bible/info-edition-v1-batch-status";
import type { InfoEditionReaderVariant } from "@/lib/bible/info-edition-v1-publish";

export function infoEditionBatchGetResponse(cwd: string, opts?: { requireOnlineFlag?: boolean }) {
  if (opts?.requireOnlineFlag) {
    const blocked = infoEditionOnlineBatchBlockedReason(cwd);
    if (blocked) {
      return NextResponse.json(
        { ok: false, error: blocked, onlineBatchEnabled: isInfoEditionOnlineBatchEnabled() },
        { status: 403 },
      );
    }
  }
  return NextResponse.json(buildInfoEditionBatchStatusPayload(cwd), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function infoEditionBatchPostResponse(
  cwd: string,
  req: Request,
  opts?: { requireOnlineFlag?: boolean },
) {
  if (opts?.requireOnlineFlag) {
    const blocked = infoEditionOnlineBatchBlockedReason(cwd);
    if (blocked) {
      return NextResponse.json(
        { ok: false, error: blocked, onlineBatchEnabled: isInfoEditionOnlineBatchEnabled() },
        { status: 403 },
      );
    }
  }

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
      const payload = buildInfoEditionBatchStatusPayload(cwd);
      if (!payload.process?.alive) return true;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return false;
  }

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
      translationId:
        typeof body.translationId === "string" ? body.translationId.trim() : prev.translationId,
      outputLanguage: body.outputLanguage === "en" ? "en" : prev.outputLanguage,
      infoRoleId: typeof body.infoRoleId === "string" ? body.infoRoleId.trim() : prev.infoRoleId,
      guideRoleId:
        typeof body.guideRoleId === "string" ? body.guideRoleId.trim() : prev.guideRoleId,
    };
    if (Array.isArray(body.editions)) {
      const eds = body.editions.filter(
        (e): e is InfoEditionReaderVariant => e === "info" || e === "guide",
      );
      if (eds.length) next.editions = eds;
    }
    writeBatchUiConfig(cwd, next);
    return NextResponse.json({
      ...buildInfoEditionBatchStatusPayload(cwd),
      message: "设置已保存。",
    });
  }

  if (action === "regenerate-invalid") {
    const config = readBatchUiConfig(cwd);
    const invalid = scanInvalidPublishedChapters(cwd).filter((t) =>
      config.editions.includes(t.edition),
    );
    if (invalid.length === 0) {
      return NextResponse.json(
        { ok: false, error: "当前 published 中无校验未通过的章节。" },
        { status: 409 },
      );
    }
    writeInvalidPublishedScanCache(cwd, invalid);
    const result = startBatchProcess(cwd, {
      fixInvalid: true,
      fullBible: true,
      pushEachBook:
        buildInfoEditionBatchStatusPayload(cwd).directDisk
          ? false
          : typeof body.pushEachBook === "boolean"
            ? body.pushEachBook
            : config.pushEachBook,
      delayMs: typeof body.delayMs === "number" ? body.delayMs : config.delayMs,
      remoteScpTarget:
        typeof body.remoteScpTarget === "string" ? body.remoteScpTarget : config.remoteScpTarget,
      translationId:
        typeof body.translationId === "string" ? body.translationId : config.translationId,
      outputLanguage: body.outputLanguage === "en" ? "en" : config.outputLanguage,
      infoRoleId: typeof body.infoRoleId === "string" ? body.infoRoleId : config.infoRoleId,
      guideRoleId: typeof body.guideRoleId === "string" ? body.guideRoleId : config.guideRoleId,
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 409 });
    }
    return NextResponse.json({
      ...buildInfoEditionBatchStatusPayload(cwd),
      message: `已启动校验失败重生成（PID ${result.pid}）· 共 ${invalid.length} 个章×版本，校验通过前最多重试 3 次。`,
    });
  }

  if (action === "start" || action === "start-full-bible") {
    const fullBible = action === "start-full-bible";
    const config = readBatchUiConfig(cwd);
    const payload = buildInfoEditionBatchStatusPayload(cwd);
    if (fullBible && payload.fullBible?.complete && body.force !== true) {
      return NextResponse.json(
        {
          ok: false,
          error: "全本已跑完。若要全书重生成，请勾选「强制重生成」后再点全书续跑。",
        },
        { status: 409 },
      );
    }
    if (!fullBible && payload.directDisk) {
      if (payload.fullBible?.complete && !body.force) {
        return NextResponse.json(
          {
            ok: false,
            error: "全本任务已完成。若要重跑，请勾选「强制重生成」后再启动。",
          },
          { status: 409 },
        );
      }
    }
    const result = startBatchProcess(cwd, {
      force: body.force === true,
      fullBible,
      pushEachBook:
        payload.directDisk
          ? false
          : typeof body.pushEachBook === "boolean"
            ? body.pushEachBook
            : config.pushEachBook,
      bookStart: fullBible
        ? ""
        : typeof body.bookStart === "string"
          ? body.bookStart
          : config.bookStart,
      bookEnd: fullBible
        ? ""
        : typeof body.bookEnd === "string"
          ? body.bookEnd
          : config.bookEnd,
      delayMs: typeof body.delayMs === "number" ? body.delayMs : config.delayMs,
      remoteScpTarget:
        typeof body.remoteScpTarget === "string" ? body.remoteScpTarget : config.remoteScpTarget,
      translationId:
        typeof body.translationId === "string" ? body.translationId : config.translationId,
      outputLanguage: body.outputLanguage === "en" ? "en" : config.outputLanguage,
      infoRoleId: typeof body.infoRoleId === "string" ? body.infoRoleId : config.infoRoleId,
      guideRoleId: typeof body.guideRoleId === "string" ? body.guideRoleId : config.guideRoleId,
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 409 });
    }
    const fb = payload.fullBible;
    const resume =
      fb?.resumeBookName && fb.resumeChapter
        ? `从 ${fb.resumeBookName} 第 ${fb.resumeChapter} 章（${fb.resumeEdition === "guide" ? "发现版" : "讲解版"}）续跑`
        : "从创世记起";
    return NextResponse.json({
      ...buildInfoEditionBatchStatusPayload(cwd),
      message: fullBible
        ? `已启动全书批量（PID ${result.pid}）· ${resume} → ${fb?.endBookName ?? "启示录"}，逐章写入 published.json`
        : `已启动批量任务（PID ${result.pid}）`,
    });
  }

  if (action === "restart-full-bible") {
    const payload = buildInfoEditionBatchStatusPayload(cwd);
    const fb = payload.fullBible;
    if (fb?.complete && body.force !== true) {
      return NextResponse.json(
        {
          ok: false,
          error: "全本已跑完。若要全书重生成，请勾选「强制重生成」后再重启。",
        },
        { status: 409 },
      );
    }
    if (payload.process?.alive) {
      const stopped = stopBatchProcess(cwd);
      if (!stopped.ok) {
        return NextResponse.json({ ok: false, error: stopped.error }, { status: 500 });
      }
      const exited = await waitForProcessExit();
      if (!exited) {
        return NextResponse.json(
          { ok: false, error: "停止旧任务超时，请稍后再试重启。" },
          { status: 409 },
        );
      }
    }
    const config = readBatchUiConfig(cwd);
    const result = startBatchProcess(cwd, {
      force: body.force === true,
      fullBible: true,
      pushEachBook:
        payload.directDisk
          ? false
          : typeof body.pushEachBook === "boolean"
            ? body.pushEachBook
            : config.pushEachBook,
      delayMs: typeof body.delayMs === "number" ? body.delayMs : config.delayMs,
      remoteScpTarget:
        typeof body.remoteScpTarget === "string" ? body.remoteScpTarget : config.remoteScpTarget,
      translationId:
        typeof body.translationId === "string" ? body.translationId : config.translationId,
      outputLanguage: body.outputLanguage === "en" ? "en" : config.outputLanguage,
      infoRoleId: typeof body.infoRoleId === "string" ? body.infoRoleId : config.infoRoleId,
      guideRoleId: typeof body.guideRoleId === "string" ? body.guideRoleId : config.guideRoleId,
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 409 });
    }
    return NextResponse.json({
      ...buildInfoEditionBatchStatusPayload(cwd),
      message: `已重启全书任务（PID ${result.pid}），按断点继续。`,
    });
  }

  if (action === "stop") {
    const result = stopBatchProcess(cwd);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }
    return NextResponse.json({
      ...buildInfoEditionBatchStatusPayload(cwd),
      message: "已发送停止信号。",
    });
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
    return NextResponse.json({
      ...buildInfoEditionBatchStatusPayload(cwd),
      message: "已推送到线上磁盘。",
    });
  }

  return NextResponse.json({ ok: false, error: `未知 action：${action}` }, { status: 400 });
}
