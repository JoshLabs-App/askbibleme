import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  extractVideoFirstFrameJpeg,
  extractVideoSquareThumbJpeg,
} from "@/lib/nature/extract-video-preview-frame";
import { transcodeNatureVideoRenditions } from "@/lib/nature/transcode-nature-video-renditions";
import { isStudioDiskSaveAllowed } from "@/lib/studio-disk-save";

/** 允许上传 4K 母片；转码后为两路 H.264 */
const MAX_BYTES = 450 * 1024 * 1024;

const ALLOWED_EXT = new Set([".mp4", ".webm", ".mov", ".m4v"]);

function extFromName(name: string): string {
  const n = name.toLowerCase();
  const i = n.lastIndexOf(".");
  if (i < 0) return "";
  return n.slice(i);
}

function skipNatureTranscode(): boolean {
  return process.env.NATURE_UPLOAD_SKIP_TRANSCODE === "1";
}

/** 自然页背景视频 → `public/nature/uploads/`；默认 ffmpeg 生成 720 / 1080 并保留母片 */
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
  const rel = (name: string) => {
    const p = path.resolve(uploadsDir, name);
    const r = path.relative(uploadsDir, p);
    if (r.startsWith("..") || path.isAbsolute(r)) throw new Error("路径校验失败");
    return p;
  };

  const skip = skipNatureTranscode();
  const masterFilename = `${base}.master${ext}`;
  const path720 = rel(`${base}-720.mp4`);
  const path1080 = rel(`${base}-1080.mp4`);
  const masterPath = rel(masterFilename);

  let singleFilename: string | null = null;
  let singleFinalPath: string | null = null;

  try {
    await fs.mkdir(uploadsDir, { recursive: true });
    const buf = Buffer.from(await file.arrayBuffer());

    if (skip) {
      singleFilename = `${base}${ext}`;
      singleFinalPath = rel(singleFilename);
      await fs.writeFile(singleFinalPath, buf);
    } else {
      await fs.writeFile(masterPath, buf);
      const tr = await transcodeNatureVideoRenditions({
        inputPath: masterPath,
        out720Path: path720,
        out1080Path: path1080,
      });
      if (!tr.ok) {
        await fs.unlink(masterPath).catch(() => {});
        await fs.unlink(path720).catch(() => {});
        await fs.unlink(path1080).catch(() => {});
        return NextResponse.json({ error: `转码失败：${tr.message}` }, { status: 500 });
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("路径校验")) {
      return NextResponse.json({ error: msg }, { status: 500 });
    }
    return NextResponse.json({ error: `写入失败：${msg}` }, { status: 500 });
  }

  const previewPostersDir = path.resolve(cwd, "public", "nature", "preview-posters");
  const previewFilename = `${base}.jpg`;
  const previewPath = path.resolve(previewPostersDir, previewFilename);
  const previewRel = path.relative(previewPostersDir, previewPath);
  let previewFrameUrl: string | null = null;
  let previewFrameWarning: string | undefined;
  const thumbsDir = path.resolve(cwd, "public", "nature", "thumbs");
  const thumbFilename = `${base}.jpg`;
  const thumbPath = path.resolve(thumbsDir, thumbFilename);
  const thumbRel = path.relative(thumbsDir, thumbPath);
  let thumbUrl: string | null = null;
  let thumbWarning: string | undefined;

  const frameSource = skip ? (singleFinalPath as string) : masterPath;
  if (!previewRel.startsWith("..") && !path.isAbsolute(previewRel)) {
    const ex = await extractVideoFirstFrameJpeg(frameSource, previewPath);
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
  if (!thumbRel.startsWith("..") && !path.isAbsolute(thumbRel)) {
    const ex = await extractVideoSquareThumbJpeg(frameSource, thumbPath);
    if (ex.ok) {
      thumbUrl = `/nature/thumbs/${thumbFilename}`;
    } else {
      thumbWarning = ex.message;
      try {
        await fs.unlink(thumbPath);
      } catch {
        /* ignore */
      }
    }
  }

  if (skip) {
    const fn = singleFilename as string;
    const url = `/nature/uploads/${fn}`;
    return NextResponse.json({
      ok: true,
      url,
      src: url,
      filename: fn,
      previewFrameUrl,
      thumbUrl,
      ...(previewFrameWarning ? { previewFrameWarning } : {}),
      ...(thumbWarning ? { thumbWarning } : {}),
      renditions: false,
    });
  }

  const src720 = `/nature/uploads/${base}-720.mp4`;
  const src1080 = `/nature/uploads/${base}-1080.mp4`;
  const src4k = `/nature/uploads/${masterFilename}`;
  return NextResponse.json({
    ok: true,
    url: src720,
    src: src720,
    src1080,
    src4k,
    filename: `${base}-720.mp4`,
    masterFilename,
    previewFrameUrl,
    thumbUrl,
    renditions: true,
    ...(previewFrameWarning ? { previewFrameWarning } : {}),
    ...(thumbWarning ? { thumbWarning } : {}),
  });
}
