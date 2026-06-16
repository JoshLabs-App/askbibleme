import { NextResponse } from "next/server";
import {
  newV3HistoryEntryId,
  readInfoEditionV3WorkspaceSync,
  writeInfoEditionV3WorkspaceSync,
} from "@/lib/bible/info-edition-v3-correction-store";
import type {
  InfoEditionV3Draft,
  InfoEditionV3HistoryEntry,
} from "@/lib/bible/info-edition-v3-correction-types";
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

function parseDraft(body: Record<string, unknown>): InfoEditionV3Draft | { error: string } {
  const bookId = typeof body.bookId === "string" ? body.bookId.trim().toUpperCase() : "";
  const chapter = Number(body.chapter);
  if (!bookId) return { error: "缺少 bookId。" };
  if (!Number.isInteger(chapter) || chapter < 1) return { error: "chapter 须为正整数。" };
  const editorNotes = typeof body.editorNotes === "string" ? body.editorNotes : "";
  const critiqueText = typeof body.critiqueText === "string" ? body.critiqueText : "";
  const rawIds = body.selectedProfileIds;
  if (!Array.isArray(rawIds)) return { error: "缺少 selectedProfileIds 数组。" };
  const selectedProfileIds = rawIds
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean);
  const rawRoleIds = body.selectedGenerationRoleIds;
  const selectedGenerationRoleIds = Array.isArray(rawRoleIds)
    ? rawRoleIds.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean)
    : [];
  return {
    bookId,
    chapter,
    editorNotes,
    critiqueText,
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
    const text = typeof row.text === "string" ? row.text : "";
    out.push({
      profileId,
      profileName: typeof row.profileName === "string" ? row.profileName : "",
      generationRoleId: typeof row.generationRoleId === "string" ? row.generationRoleId : "unknown",
      generationRoleLabel:
        typeof row.generationRoleLabel === "string" ? row.generationRoleLabel : "",
      text,
      charCount: typeof row.charCount === "number" ? row.charCount : text.length,
      error: typeof row.error === "string" ? row.error : undefined,
    });
  }
  return out.length ? out : undefined;
}

export async function GET(req: Request) {
  if (!isStudioDiskSaveAllowed(req)) return disk403();
  const workspace = readInfoEditionV3WorkspaceSync(process.cwd());
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
  const workspace = readInfoEditionV3WorkspaceSync(cwd);

  if (action === "save_current") {
    const draft = parseDraft(o);
    if ("error" in draft) return NextResponse.json({ ok: false, error: draft.error }, { status: 400 });
    workspace.current = draft;
    writeInfoEditionV3WorkspaceSync(cwd, workspace);
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
    let entry: InfoEditionV3HistoryEntry;
    if (action === "update_compare") {
      const historyId = typeof o.historyId === "string" ? o.historyId.trim() : "";
      const idx = workspace.history.findIndex((h) => h.id === historyId);
      if (idx < 0) return NextResponse.json({ ok: false, error: "未找到该历史条目。" }, { status: 404 });
      entry = {
        ...workspace.history[idx],
        ...draft,
        generations,
        generatedAt: now,
        editorNotesCharCount: draft.editorNotes.length,
        critiqueCharCount: draft.critiqueText.length,
        entryKind: "compare",
      };
      workspace.history[idx] = entry;
    } else {
      entry = {
        ...draft,
        id: newV3HistoryEntryId(),
        savedAt: now,
        generatedAt: now,
        editorNotesCharCount: draft.editorNotes.length,
        critiqueCharCount: draft.critiqueText.length,
        entryKind: "compare",
        generations,
      };
      workspace.history = [entry, ...workspace.history];
    }
    workspace.current = draft;
    writeInfoEditionV3WorkspaceSync(cwd, workspace);
    return NextResponse.json({ ok: true, workspace, compareId: entry.id });
  }

  if (action === "restore_history") {
    const historyId = typeof o.historyId === "string" ? o.historyId.trim() : "";
    if (!historyId) return NextResponse.json({ ok: false, error: "缺少 historyId。" }, { status: 400 });
    const entry = workspace.history.find((h) => h.id === historyId);
    if (!entry) return NextResponse.json({ ok: false, error: "未找到该历史条目。" }, { status: 404 });
    workspace.current = {
      bookId: entry.bookId,
      chapter: entry.chapter,
      editorNotes: entry.editorNotes,
      critiqueText: entry.critiqueText,
      selectedProfileIds: [...entry.selectedProfileIds],
      selectedGenerationRoleIds: [...entry.selectedGenerationRoleIds],
    };
    writeInfoEditionV3WorkspaceSync(cwd, workspace);
    return NextResponse.json({ ok: true, workspace, entry });
  }

  if (action === "delete_history") {
    const historyId = typeof o.historyId === "string" ? o.historyId.trim() : "";
    if (!historyId) return NextResponse.json({ ok: false, error: "缺少 historyId。" }, { status: 400 });
    workspace.history = workspace.history.filter((h) => h.id !== historyId);
    writeInfoEditionV3WorkspaceSync(cwd, workspace);
    return NextResponse.json({ ok: true, workspace });
  }

  return NextResponse.json({ ok: false, error: `未知 action：${action}` }, { status: 400 });
}
