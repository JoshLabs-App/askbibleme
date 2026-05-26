import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { isStudioDiskSaveAllowed } from "@/lib/studio-disk-save";

const MAX_BYTES = 80 * 1024 * 1024;
const ALLOWED_EXT = new Set([
  ".mp3",
  ".wav",
  ".ogg",
  ".m4a",
  ".aac",
  ".opus",
  ".webm",
  ".flac",
]);

function extFromName(name: string): string {
  const n = name.toLowerCase();
  const i = n.lastIndexOf(".");
  if (i < 0) return "";
  return n.slice(i);
}

/** 上传自然场景环境声原文件（不转码），用于 App 场景音效选择。 */
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

  const rawCt = req.headers.get("content-type")?.trim().toLowerCase() ?? "";
  if (!rawCt.startsWith("multipart/form-data")) {
    return NextResponse.json(
      { error: "请求体须为 multipart/form-data（请选择文件后直接上传，不要手动改 Content-Type）。" },
      { status: 400 },
    );
  }

  let form: Awaited<ReturnType<Request["formData"]>>;
  try {
    form = await req.formData();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `multipart 解析失败：${msg}。若为大文件，请确认已重启服务并生效更大的 proxyClientMaxBodySize。` },
      { status: 400 },
    );
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

  const ext = extFromName(file.name || "audio");
  if (!ALLOWED_EXT.has(ext)) {
    return NextResponse.json(
      { error: `不支持的扩展名 ${ext || "（无）"}。允许：${[...ALLOWED_EXT].join(" ")}` },
      { status: 400 },
    );
  }

  const base = randomUUID().replace(/-/g, "");
  const filename = `${base}${ext}`;
  const cwd = process.cwd();
  const uploadsDir = path.resolve(cwd, "public", "nature", "audio-uploads");
  const outPath = path.resolve(uploadsDir, filename);
  const rel = path.relative(uploadsDir, outPath);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return NextResponse.json({ error: "路径校验失败。" }, { status: 500 });
  }

  try {
    await fs.mkdir(uploadsDir, { recursive: true });
    const buf = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(outPath, buf);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `写入失败：${msg}` }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    url: `/nature/audio-uploads/${filename}`,
    filename,
  });
}
