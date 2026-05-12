import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { isStudioDiskSaveAllowed } from "@/lib/studio-disk-save";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

function extFromName(name: string): string {
  const n = name.toLowerCase();
  const i = n.lastIndexOf(".");
  if (i < 0) return "";
  return n.slice(i);
}

/**
 * 上传背景图 → 保存到 public/music/bg-uploads/，返回同源 URL。
 */
export async function POST(req: Request) {
  if (!isStudioDiskSaveAllowed(req)) {
    return NextResponse.json(
      {
        error:
          "未允许写磁盘：开发环境默认可写；生产请设置 STUDIO_ALLOW_DISK_SAVE=1、STUDIO_WRITE_SECRET，并携带 Authorization: Bearer …",
      },
      { status: 403 },
    );
  }

  let form: Awaited<ReturnType<Request["formData"]>>;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "请求体须为 multipart/form-data。" }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "缺少 file 字段。" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `文件过大（上限 ${Math.round(MAX_BYTES / 1024 / 1024)} MB）。` },
      { status: 400 },
    );
  }

  const origName = file.name || "image";
  const ext = extFromName(origName);
  if (!ALLOWED_EXT.has(ext)) {
    return NextResponse.json(
      {
        error: `不支持的扩展名 ${ext || "（无）"}。允许：${[...ALLOWED_EXT].join(" ")}`,
      },
      { status: 400 },
    );
  }

  const base = randomUUID().replace(/-/g, "");
  const cwd = process.cwd();
  const uploadsDir = path.resolve(cwd, "public", "music", "bg-uploads");
  const outName = `${base}${ext}`;
  const outPath = path.resolve(uploadsDir, outName);
  const rel = path.relative(uploadsDir, outPath);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return NextResponse.json({ error: "路径校验失败。" }, { status: 500 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  try {
    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.writeFile(outPath, buf);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `写入失败：${msg}` }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    url: `/music/bg-uploads/${outName}`,
    filename: outName,
  });
}
