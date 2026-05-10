import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import type { DiscussionEnvelopeMeta } from "@/app/studio/discussion-types";
import { isStudioDiskSaveAllowed } from "@/lib/studio-disk-save";
import { STUDIO_AI_DISCUSSION_DISK_FILE } from "@/lib/studio-config";

const MAX_BODY_CHARS = 1_800_000;

function discussionPath(): string {
  const cwd = process.cwd();
  const dir = path.resolve(cwd, path.dirname(STUDIO_AI_DISCUSSION_DISK_FILE));
  const full = path.resolve(cwd, STUDIO_AI_DISCUSSION_DISK_FILE);
  if (!full.startsWith(dir + path.sep) && full !== dir) {
    throw new Error("invalid discussion path");
  }
  return full;
}

function normalizeStoredDiscussion(parsed: unknown): {
  messages: unknown[];
  meta: DiscussionEnvelopeMeta;
  version: number;
  updatedAt: string | null;
} {
  if (Array.isArray(parsed)) {
    return { messages: parsed, meta: {}, version: 1, updatedAt: null };
  }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const o = parsed as Record<string, unknown>;
    const messages = Array.isArray(o.messages) ? o.messages : [];
    const metaRaw = o.meta;
    const meta: DiscussionEnvelopeMeta =
      metaRaw && typeof metaRaw === "object" && !Array.isArray(metaRaw)
        ? (metaRaw as DiscussionEnvelopeMeta)
        : {};
    const version = typeof o.version === "number" ? o.version : 1;
    const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : null;
    return { messages, meta, version, updatedAt };
  }
  return { messages: [], meta: {}, version: 1, updatedAt: null };
}

/**
 * GET：读取仓库内讨论备份 JSON（v1 纯数组或 v2 信封）。
 * POST：写入 `{ version, updatedAt, meta?, messages }`。
 */
export async function GET(req: Request) {
  if (!isStudioDiskSaveAllowed(req)) {
    return NextResponse.json(
      {
        error:
          "未允许读/写磁盘：开发请用 `npm run dev`，或配置 STUDIO_ALLOW_DISK_SAVE 与 Bearer。",
      },
      { status: 403 },
    );
  }

  const target = discussionPath();
  try {
    const raw = await fs.readFile(target, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    const { messages, meta, version, updatedAt } = normalizeStoredDiscussion(parsed);
    return NextResponse.json({
      version: version >= 2 ? version : 2,
      updatedAt: updatedAt ?? new Date().toISOString(),
      meta,
      messages,
    });
  } catch (e) {
    const code = (e as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") {
      return NextResponse.json({
        version: 2,
        updatedAt: new Date().toISOString(),
        meta: {},
        messages: [],
      });
    }
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `读取失败：${msg}` }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!isStudioDiskSaveAllowed(req)) {
    return NextResponse.json(
      {
        error:
          "未允许写磁盘：请使用 `npm run dev`，或在环境中设置 STUDIO_ALLOW_DISK_SAVE=1 与 STUDIO_WRITE_SECRET，并在请求头携带 Authorization: Bearer …",
      },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体需为 JSON。" }, { status: 400 });
  }

  const messages = (body as { messages?: unknown }).messages;
  if (!Array.isArray(messages)) {
    return NextResponse.json({ error: "缺少 messages 数组。" }, { status: 400 });
  }

  const incomingMeta = (body as { meta?: unknown }).meta;
  const meta: DiscussionEnvelopeMeta =
    incomingMeta &&
    typeof incomingMeta === "object" &&
    !Array.isArray(incomingMeta)
      ? (incomingMeta as DiscussionEnvelopeMeta)
      : {};

  const json = JSON.stringify({
    version: 2,
    updatedAt: new Date().toISOString(),
    meta,
    messages,
  });
  if (json.length > MAX_BODY_CHARS) {
    return NextResponse.json(
      { error: `讨论记录过长（上限 ${MAX_BODY_CHARS} 字符）。` },
      { status: 400 },
    );
  }

  const target = discussionPath();
  const dir = path.dirname(target);
  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(target, json, "utf-8");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `写入失败：${msg}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
