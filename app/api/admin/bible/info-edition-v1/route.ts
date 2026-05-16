import { NextResponse } from "next/server";
import {
  newHistoryEntryId,
  readInfoEditionV1WorkspaceSync,
  writeInfoEditionV1WorkspaceSync,
} from "@/lib/bible/info-edition-v1-store";
import type {
  InfoEditionV1Draft,
  InfoEditionV1Generation,
  InfoEditionV1HistoryEntry,
} from "@/lib/bible/info-edition-v1-types";
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

function parseDraft(body: Record<string, unknown>): InfoEditionV1Draft | { error: string } {
  const bookId = typeof body.bookId === "string" ? body.bookId.trim().toUpperCase() : "";
  const chapter = Number(body.chapter);
  if (!bookId) return { error: "缺少 bookId。" };
  if (!Number.isInteger(chapter) || chapter < 1) return { error: "chapter 须为正整数。" };
  const descriptionRules = typeof body.descriptionRules === "string" ? body.descriptionRules : "";
  const rawIds = body.selectedProfileIds;
  if (!Array.isArray(rawIds)) return { error: "缺少 selectedProfileIds 数组。" };
  const selectedProfileIds = rawIds
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean);
  const legacyRoleId =
    typeof body.generationRoleId === "string" ? body.generationRoleId.trim() : "";
  const rawRoleIds = body.selectedGenerationRoleIds;
  const selectedGenerationRoleIds = Array.isArray(rawRoleIds)
    ? rawRoleIds.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean)
    : legacyRoleId
      ? [legacyRoleId]
      : [];
  return {
    bookId,
    chapter,
    descriptionRules,
    selectedProfileIds: [...new Set(selectedProfileIds)],
    selectedGenerationRoleIds: [...new Set(selectedGenerationRoleIds)],
  };
}

function parseGenerations(raw: unknown): InfoEditionV1Generation[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: InfoEditionV1Generation[] = [];
  for (const g of raw) {
    if (!g || typeof g !== "object") continue;
    const row = g as Record<string, unknown>;
    const profileId = typeof row.profileId === "string" ? row.profileId : "";
    if (!profileId) continue;
    const profileName = typeof row.profileName === "string" ? row.profileName : "";
    const generationRoleId = typeof row.generationRoleId === "string" ? row.generationRoleId : "";
    const generationRoleLabel =
      typeof row.generationRoleLabel === "string" ? row.generationRoleLabel : "";
    const text = typeof row.text === "string" ? row.text : "";
    const charCount = typeof row.charCount === "number" ? row.charCount : text.length;
    const error = typeof row.error === "string" ? row.error : undefined;
    out.push({
      profileId,
      profileName,
      generationRoleId: generationRoleId || "unknown",
      generationRoleLabel: generationRoleLabel || generationRoleId || "—",
      text,
      charCount,
      error,
    });
  }
  return out.length ? out : undefined;
}

export async function GET(req: Request) {
  if (!isStudioDiskSaveAllowed(req)) return disk403();
  const workspace = readInfoEditionV1WorkspaceSync(process.cwd());
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
  const workspace = readInfoEditionV1WorkspaceSync(cwd);

  if (action === "save_current") {
    const draft = parseDraft(o);
    if ("error" in draft) return NextResponse.json({ ok: false, error: draft.error }, { status: 400 });
    workspace.current = draft;
    writeInfoEditionV1WorkspaceSync(cwd, workspace);
    return NextResponse.json({ ok: true, workspace });
  }

  if (action === "save_compare" || action === "update_compare") {
    const draft = parseDraft(o);
    if ("error" in draft) return NextResponse.json({ ok: false, error: draft.error }, { status: 400 });
    const generations = parseGenerations(o.generations);
    if (!generations?.length) {
      return NextResponse.json({ ok: false, error: "缺少对比结果。" }, { status: 400 });
    }
    const now = new Date().toISOString();
    workspace.current = draft;

    if (action === "update_compare") {
      const historyId = typeof o.historyId === "string" ? o.historyId.trim() : "";
      if (!historyId) return NextResponse.json({ ok: false, error: "缺少 historyId。" }, { status: 400 });
      const idx = workspace.history.findIndex((h) => h.id === historyId);
      if (idx < 0) return NextResponse.json({ ok: false, error: "未找到该对比记录。" }, { status: 404 });
      const prev = workspace.history[idx];
      workspace.history[idx] = {
        ...prev,
        ...draft,
        generations,
        generatedAt: now,
        entryKind: "compare",
        descriptionCharCount: draft.descriptionRules.length,
      };
      writeInfoEditionV1WorkspaceSync(cwd, workspace);
      return NextResponse.json({ ok: true, workspace, compareId: historyId });
    }

    const entry: InfoEditionV1HistoryEntry = {
      ...draft,
      id: newHistoryEntryId(),
      savedAt: now,
      generatedAt: now,
      descriptionCharCount: draft.descriptionRules.length,
      entryKind: "compare",
      generations,
    };
    workspace.history = [entry, ...workspace.history].slice(0, 48);
    writeInfoEditionV1WorkspaceSync(cwd, workspace);
    return NextResponse.json({ ok: true, workspace, compareId: entry.id });
  }

  if (action === "archive") {
    const draft = parseDraft(o);
    if ("error" in draft) return NextResponse.json({ ok: false, error: draft.error }, { status: 400 });
    workspace.current = draft;
    const generations = parseGenerations(o.generations);
    const entry: InfoEditionV1HistoryEntry = {
      ...draft,
      id: newHistoryEntryId(),
      savedAt: new Date().toISOString(),
      descriptionCharCount: draft.descriptionRules.length,
      entryKind: "draft",
      ...(generations ? { generations, generatedAt: new Date().toISOString() } : {}),
    };
    workspace.history = [entry, ...workspace.history].slice(0, 48);
    writeInfoEditionV1WorkspaceSync(cwd, workspace);
    return NextResponse.json({ ok: true, workspace, archivedId: entry.id });
  }

  if (action === "update_history_generations") {
    const historyId = typeof o.historyId === "string" ? o.historyId.trim() : "";
    if (!historyId) return NextResponse.json({ ok: false, error: "缺少 historyId。" }, { status: 400 });
    const generations = parseGenerations(o.generations);
    if (!generations?.length) {
      return NextResponse.json({ ok: false, error: "缺少 generations。" }, { status: 400 });
    }
    const idx = workspace.history.findIndex((h) => h.id === historyId);
    if (idx < 0) return NextResponse.json({ ok: false, error: "未找到该历史条目。" }, { status: 404 });
    workspace.history[idx] = {
      ...workspace.history[idx],
      generations,
      generatedAt: new Date().toISOString(),
    };
    writeInfoEditionV1WorkspaceSync(cwd, workspace);
    return NextResponse.json({ ok: true, workspace });
  }

  if (action === "delete_history") {
    const historyId = typeof o.historyId === "string" ? o.historyId.trim() : "";
    if (!historyId) return NextResponse.json({ ok: false, error: "缺少 historyId。" }, { status: 400 });
    workspace.history = workspace.history.filter((h) => h.id !== historyId);
    writeInfoEditionV1WorkspaceSync(cwd, workspace);
    return NextResponse.json({ ok: true, workspace });
  }

  if (action === "restore_history") {
    const historyId = typeof o.historyId === "string" ? o.historyId.trim() : "";
    if (!historyId) return NextResponse.json({ ok: false, error: "缺少 historyId。" }, { status: 400 });
    const entry = workspace.history.find((h) => h.id === historyId);
    if (!entry) return NextResponse.json({ ok: false, error: "未找到该历史条目。" }, { status: 404 });
    workspace.current = {
      bookId: entry.bookId,
      chapter: entry.chapter,
      descriptionRules: entry.descriptionRules,
      selectedProfileIds: [...entry.selectedProfileIds],
      selectedGenerationRoleIds: [...(entry.selectedGenerationRoleIds ?? [])],
    };
    writeInfoEditionV1WorkspaceSync(cwd, workspace);
    return NextResponse.json({ ok: true, workspace, entry });
  }

  return NextResponse.json({ ok: false, error: `未知 action：${action}` }, { status: 400 });
}
