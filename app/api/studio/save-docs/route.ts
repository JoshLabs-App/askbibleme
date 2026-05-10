import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  isStudioDiskSaveAllowed,
  isStudioDocId,
} from "@/lib/studio-disk-save";

const MAX_DOC_CHARS = 900_000;

/**
 * 将 Studio 中的文档正文写回仓库 `docs/{id}.md`。
 * 权限见 `lib/studio-disk-save.ts`（开发默认可写；生产需显式开关 + Bearer）。
 */
export async function POST(req: Request) {
  if (!isStudioDiskSaveAllowed(req)) {
    return NextResponse.json(
      {
        error:
          "未允许写磁盘：请使用 `npm run dev`（开发模式），或在环境中设置 STUDIO_ALLOW_DISK_SAVE=1 与 STUDIO_WRITE_SECRET，并在请求头携带 Authorization: Bearer …",
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

  const raw = (body as { documents?: unknown }).documents;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return NextResponse.json({ error: "缺少 documents 对象。" }, { status: 400 });
  }

  const documents = raw as Record<string, unknown>;
  const ids = Object.keys(documents);
  if (ids.length === 0) {
    return NextResponse.json({ error: "documents 为空。" }, { status: 400 });
  }

  for (const id of ids) {
    if (!isStudioDocId(id)) {
      return NextResponse.json({ error: `非法文档 id: ${id}` }, { status: 400 });
    }
    const v = documents[id];
    if (typeof v !== "string") {
      return NextResponse.json(
        { error: `文档「${id}」正文须为字符串。` },
        { status: 400 },
      );
    }
    if (v.length > MAX_DOC_CHARS) {
      return NextResponse.json(
        { error: `文档「${id}」过长（上限 ${MAX_DOC_CHARS} 字符）。` },
        { status: 400 },
      );
    }
  }

  const cwd = process.cwd();
  try {
    const docsRoot = path.resolve(cwd, "docs");
    for (const id of ids) {
      const content = documents[id] as string;
      const target = path.resolve(docsRoot, `${id}.md`);
      if (!target.startsWith(docsRoot + path.sep)) {
        return NextResponse.json({ error: "路径校验失败。" }, { status: 500 });
      }
      await fs.writeFile(target, content, "utf-8");
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `写入文件失败：${msg}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, written: ids.length });
}
