import { NextResponse } from "next/server";
import {
  newV4HistoryEntryId,
  readInfoEditionV4WorkspaceSync,
  writeInfoEditionV4WorkspaceSync,
} from "@/lib/bible/info-edition-v4-store";
import type {
  InfoEditionV4Draft,
  InfoEditionV4HistoryEntry,
  InfoEditionV4Phase,
  InfoEditionV4PipelinePair,
} from "@/lib/bible/info-edition-v4-types";
import type { InfoEditionV1Generation } from "@/lib/bible/info-edition-v1-types";
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

function parseGeneration(raw: unknown): InfoEditionV1Generation | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const profileId = typeof row.profileId === "string" ? row.profileId : "";
  if (!profileId) return null;
  const text = typeof row.text === "string" ? row.text : "";
  return {
    profileId,
    profileName: typeof row.profileName === "string" ? row.profileName : "",
    generationRoleId: typeof row.generationRoleId === "string" ? row.generationRoleId : "unknown",
    generationRoleLabel: typeof row.generationRoleLabel === "string" ? row.generationRoleLabel : "",
    text,
    charCount: typeof row.charCount === "number" ? row.charCount : text.length,
    error: typeof row.error === "string" ? row.error : undefined,
  };
}

function parseDraft(body: Record<string, unknown>): InfoEditionV4Draft | { error: string } {
  const themeTitle = typeof body.themeTitle === "string" ? body.themeTitle.trim() : "";
  if (!themeTitle) return { error: "缺少主题名称。" };
  const editorNotes = typeof body.editorNotes === "string" ? body.editorNotes : "";
  const compileText = typeof body.compileText === "string" ? body.compileText : "";
  const reviseText = typeof body.reviseText === "string" ? body.reviseText : "";
  const lastUsedProfileId = typeof body.lastUsedProfileId === "string" ? body.lastUsedProfileId.trim() : "";
  const rawIds = body.selectedProfileIds;
  if (!Array.isArray(rawIds)) return { error: "缺少 selectedProfileIds 数组。" };
  const selectedProfileIds = rawIds
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean);
  const pickRoleIds = (key: string, fallback: string[]) => {
    const raw = body[key];
    if (!Array.isArray(raw)) return fallback;
    return [...new Set(raw.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean))];
  };
  return {
    themeTitle,
    editorNotes,
    compileText,
    reviseText,
    lastUsedProfileId,
    selectedProfileIds: [...new Set(selectedProfileIds)],
    selectedCompileRoleIds: pickRoleIds("selectedCompileRoleIds", []),
    selectedReviseRoleIds: pickRoleIds("selectedReviseRoleIds", []),
  };
}

function parsePipelinePairs(raw: unknown): InfoEditionV4PipelinePair[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: InfoEditionV4PipelinePair[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const compile = parseGeneration(row.compile);
    if (!compile) continue;
    const revise = row.revise != null ? parseGeneration(row.revise) : null;
    out.push({ compile, revise });
  }
  return out.length ? out : undefined;
}

function parsePhase(raw: unknown): InfoEditionV4Phase | null {
  const phase = typeof raw === "string" ? raw.trim() : "";
  if (phase === "compile" || phase === "revise" || phase === "pipeline") return phase;
  return null;
}

export async function GET(req: Request) {
  if (!isStudioDiskSaveAllowed(req)) return disk403();
  const workspace = readInfoEditionV4WorkspaceSync(process.cwd());
  return NextResponse.json({ ok: true, workspace }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  if (!isStudioDiskSaveAllowed(req)) return disk403();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "须为 JSON。" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "无效请求体。" }, { status: 400 });
  }
  const o = body as Record<string, unknown>;
  const action = typeof o.action === "string" ? o.action : "save_current";
  const cwd = process.cwd();
  const workspace = readInfoEditionV4WorkspaceSync(cwd);

  if (action === "save_current") {
    const draft = parseDraft(o);
    if ("error" in draft) return NextResponse.json({ ok: false, error: draft.error }, { status: 400 });
    workspace.current = draft;
    writeInfoEditionV4WorkspaceSync(cwd, workspace);
    return NextResponse.json({ ok: true, workspace });
  }

  if (action === "save_pipeline") {
    const draft = parseDraft(o);
    if ("error" in draft) return NextResponse.json({ ok: false, error: draft.error }, { status: 400 });
    const pipelinePairs = parsePipelinePairs(o.pipelinePairs);
    if (!pipelinePairs?.length) {
      return NextResponse.json({ ok: false, error: "缺少 pipeline 对比结果。" }, { status: 400 });
    }
    const now = new Date().toISOString();
    const entry: InfoEditionV4HistoryEntry = {
      ...draft,
      id: newV4HistoryEntryId(),
      savedAt: now,
      generatedAt: now,
      themeTitleCharCount: draft.themeTitle.length,
      entryKind: "pipeline",
      phase: "pipeline",
      pipelinePairs,
    };
    workspace.history = [entry, ...workspace.history];
    workspace.current = draft;
    writeInfoEditionV4WorkspaceSync(cwd, workspace);
    return NextResponse.json({ ok: true, workspace, compareId: entry.id });
  }

  if (action === "restore_history") {
    const historyId = typeof o.historyId === "string" ? o.historyId.trim() : "";
    if (!historyId) return NextResponse.json({ ok: false, error: "缺少 historyId。" }, { status: 400 });
    const entry = workspace.history.find((h) => h.id === historyId);
    if (!entry) return NextResponse.json({ ok: false, error: "未找到该历史条目。" }, { status: 404 });
    workspace.current = {
      themeTitle: entry.themeTitle,
      editorNotes: entry.editorNotes,
      compileText: entry.compileText,
      reviseText: entry.reviseText,
      lastUsedProfileId: entry.lastUsedProfileId,
      selectedProfileIds: [...entry.selectedProfileIds],
      selectedCompileRoleIds: [...entry.selectedCompileRoleIds],
      selectedReviseRoleIds: [...entry.selectedReviseRoleIds],
    };
    writeInfoEditionV4WorkspaceSync(cwd, workspace);
    return NextResponse.json({ ok: true, workspace, entry });
  }

  if (action === "delete_history") {
    const historyId = typeof o.historyId === "string" ? o.historyId.trim() : "";
    if (!historyId) return NextResponse.json({ ok: false, error: "缺少 historyId。" }, { status: 400 });
    workspace.history = workspace.history.filter((h) => h.id !== historyId);
    writeInfoEditionV4WorkspaceSync(cwd, workspace);
    return NextResponse.json({ ok: true, workspace });
  }

  return NextResponse.json({ ok: false, error: `未知 action：${action}` }, { status: 400 });
}
