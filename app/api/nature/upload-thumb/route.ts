import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { isStudioDiskSaveAllowed } from "@/lib/studio-disk-save";

const MAX_BYTES = 3 * 1024 * 1024;

const EXT_BY_MIME = new Map<string, string>([
  ["image/jpeg", ".jpg"],
  ["image/jpg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

function extFromName(name: string): string {
  const n = name.toLowerCase();
  const i = n.lastIndexOf(".");
  if (i < 0) return "";
  return n.slice(i);
}

/** 自然页影片正方形封面 → `public/nature/thumbs/` */
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

  let form: FormData;
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

  const mime = (file.type || "").toLowerCase();
  const origName = file.name || "thumb";
  const extFromMime = EXT_BY_MIME.get(mime);
  const extFromFile = extFromName(origName);
  const allowedFileExt = new Set([".jpg", ".jpeg", ".png", ".webp"]);
  const ext =
    extFromMime ??
    (allowedFileExt.has(extFromFile) ? (extFromFile === ".jpeg" ? ".jpg" : extFromFile) : "");

  if (!ext) {
    return NextResponse.json(
      { error: "请上传 jpg / png / webp 图片（或由画布导出的 jpeg）。" },
      { status: 400 },
    );
  }

  const base = randomUUID().replace(/-/g, "");
  const cwd = process.cwd();
  const thumbsDir = path.resolve(cwd, "public", "nature", "thumbs");
  const filename = `${base}${ext}`;
  const finalPath = path.resolve(thumbsDir, filename);
  const rel = path.relative(thumbsDir, finalPath);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return NextResponse.json({ error: "路径校验失败。" }, { status: 500 });
  }

  try {
    await fs.mkdir(thumbsDir, { recursive: true });
    const buf = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(finalPath, buf);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `写入失败：${msg}` }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    url: `/nature/thumbs/${filename}`,
    filename,
  });
}
