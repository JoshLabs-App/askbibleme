import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { extractVideoFirstFrameJpeg } from "@/lib/nature/extract-video-preview-frame";
import { isStudioDiskSaveAllowed } from "@/lib/studio-disk-save";

const MAX_BYTES = 220 * 1024 * 1024;

const ALLOWED_EXT = new Set([".mp4", ".webm", ".mov", ".m4v"]);

function extFromName(name: string): string {
  const n = name.toLowerCase();
  const i = n.lastIndexOf(".");
  if (i < 0) return "";
  return n.slice(i);
}

/** 自然页背景视频 → `public/nature/uploads/` */
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

  const origName = file.name || "video";
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
  const uploadsDir = path.resolve(cwd, "public", "nature", "uploads");
  const filename = `${base}${ext}`;
  const finalPath = path.resolve(uploadsDir, filename);
  const rel = path.relative(uploadsDir, finalPath);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return NextResponse.json({ error: "路径校验失败。" }, { status: 500 });
  }

  try {
    await fs.mkdir(uploadsDir, { recursive: true });
    const buf = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(finalPath, buf);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `写入失败：${msg}` }, { status: 500 });
  }

  const previewPostersDir = path.resolve(cwd, "public", "nature", "preview-posters");
  const previewFilename = `${base}.jpg`;
  const previewPath = path.resolve(previewPostersDir, previewFilename);
  const previewRel = path.relative(previewPostersDir, previewPath);
  let previewFrameUrl: string | null = null;
  let previewFrameWarning: string | undefined;
  if (!previewRel.startsWith("..") && !path.isAbsolute(previewRel)) {
    const ex = await extractVideoFirstFrameJpeg(finalPath, previewPath);
    if (ex.ok) {
      previewFrameUrl = `/nature/preview-posters/${previewFilename}`;
    } else {
      previewFrameWarning = ex.message;
      try {
        await fs.unlink(previewPath);
      } catch {
        /* ignore */
      }
    }
  }

  return NextResponse.json({
    ok: true,
    url: `/nature/uploads/${filename}`,
    filename,
    previewFrameUrl,
    ...(previewFrameWarning ? { previewFrameWarning } : {}),
  });
}
