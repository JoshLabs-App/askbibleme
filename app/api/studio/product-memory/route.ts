import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { STUDIO_PRODUCT_MEMORY_FILE } from "@/lib/studio-config";
import { isStudioDiskSaveAllowed } from "@/lib/studio-disk-save";

const MAX_APPEND = 120_000;

function productPath(): string {
  const cwd = process.cwd();
  const dir = path.resolve(cwd, path.dirname(STUDIO_PRODUCT_MEMORY_FILE));
  const full = path.resolve(cwd, STUDIO_PRODUCT_MEMORY_FILE);
  if (!full.startsWith(dir + path.sep) && full !== dir) {
    throw new Error("invalid product-memory path");
  }
  return full;
}

/**
 * GET：读取 `studio/product-memory.md`。
 * POST：在文件末尾**追加**用户已确认的内容（不覆盖全文）。
 */
export async function GET(req: Request) {
  if (!isStudioDiskSaveAllowed(req)) {
    return NextResponse.json(
      {
        error:
          "未允许读磁盘：开发请用 `npm run dev`，或配置 STUDIO_ALLOW_DISK_SAVE 与 Bearer。",
      },
      { status: 403 },
    );
  }

  const target = productPath();
  try {
    const content = await fs.readFile(target, "utf-8");
    return NextResponse.json({ content });
  } catch (e) {
    const code = (e as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") {
      return NextResponse.json({ content: "" });
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

  const appendMarkdown =
    body &&
    typeof body === "object" &&
    typeof (body as { appendMarkdown?: unknown }).appendMarkdown === "string"
      ? (body as { appendMarkdown: string }).appendMarkdown.trim()
      : "";

  if (!appendMarkdown) {
    return NextResponse.json({ error: "缺少 appendMarkdown。" }, { status: 400 });
  }
  if (appendMarkdown.length > MAX_APPEND) {
    return NextResponse.json(
      { error: `追加内容过长（上限 ${MAX_APPEND} 字符）。` },
      { status: 400 },
    );
  }

  const target = productPath();
  const dir = path.dirname(target);
  const stamp = new Date().toISOString();
  const block = [
    "",
    "---",
    "",
    `### Manual append · ${stamp}`,
    "",
    appendMarkdown,
    "",
  ].join("\n");

  try {
    await fs.mkdir(dir, { recursive: true });
    let prev = "";
    try {
      prev = await fs.readFile(target, "utf-8");
    } catch (e) {
      const code = (e as NodeJS.ErrnoException)?.code;
      if (code !== "ENOENT") throw e;
    }
    const next = `${prev.replace(/\s+$/, "")}${block}\n`;
    await fs.writeFile(target, next, "utf-8");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `写入失败：${msg}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
