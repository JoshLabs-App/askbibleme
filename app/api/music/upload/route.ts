import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { isStudioDiskSaveAllowed } from "@/lib/studio-disk-save";
import {
  shouldSkipTranscode,
  streamingBitrateK,
  transcodeToStreamingM4a,
} from "@/lib/music/transcode-upload";
import { analyzeAudioFileToV1 } from "@/lib/music/build-track-analysis-server";

/** 大文件 + ffmpeg 转码；部署平台（如 Vercel）仍可能对请求体有套餐上限，与本应用内校验无关。 */
export const maxDuration = 120;

const ALLOWED_EXT = new Set([
  ".mp3",
  ".m4a",
  ".aac",
  ".ogg",
  ".opus",
  ".wav",
  ".webm",
  ".flac",
]);

function extFromName(name: string): string {
  const n = name.toLowerCase();
  const i = n.lastIndexOf(".");
  if (i < 0) return "";
  return n.slice(i);
}

function uploadAnalysisMaxSeconds(): number {
  const raw = process.env.MUSIC_UPLOAD_ANALYSIS_MAX_SEC?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 120;
  if (!Number.isFinite(n)) return 120;
  return Math.min(900, Math.max(30, n));
}

/** 预计算能量曲线 JSON；失败不阻断上传。`MUSIC_UPLOAD_SKIP_ANALYSIS=1` 跳过。 */
async function tryWriteTrackAnalysisJson(audioPath: string, idBase: string): Promise<string | null> {
  if (process.env.MUSIC_UPLOAD_SKIP_ANALYSIS === "1") return null;
  try {
    const v1 = await analyzeAudioFileToV1(audioPath, { maxSeconds: uploadAnalysisMaxSeconds() });
    const analysisDir = path.resolve(process.cwd(), "public", "music", "analysis");
    await fs.mkdir(analysisDir, { recursive: true });
    const name = `${idBase}.json`;
    const out = path.resolve(analysisDir, name);
    const rel = path.relative(analysisDir, out);
    if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
    await fs.writeFile(out, JSON.stringify(v1), "utf8");
    return `/music/analysis/${name}`;
  } catch {
    return null;
  }
}

/**
 * 上传音频 → 默认用 ffmpeg 转码为 **AAC .m4a**（适合流式码率 + faststart）。
 * 跳过转码：`MUSIC_UPLOAD_SKIP_TRANSCODE=1`（仅保存原文件）。
 * 跳过能量分析：`MUSIC_UPLOAD_SKIP_ANALYSIS=1`（上传时不生成 `/public/music/analysis/*.json`）。
 * 分析仅取音频前若干秒（默认 120，范围 30–900）：`MUSIC_UPLOAD_ANALYSIS_MAX_SEC`，避免长文件解码阻塞过久。
 * 码率：`MUSIC_UPLOAD_BITRATE_K`（默认 96，范围建议 32–192）。
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

  const origName = file.name || "audio";
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
  const uploadsDir = path.resolve(cwd, "public", "music", "uploads");
  const tmpIn = path.resolve(uploadsDir, `_tmp_${base}${ext}`);
  const relTmp = path.relative(uploadsDir, tmpIn);
  if (relTmp.startsWith("..") || path.isAbsolute(relTmp)) {
    return NextResponse.json({ error: "路径校验失败。" }, { status: 500 });
  }
  const buf = Buffer.from(await file.arrayBuffer());

  try {
    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.writeFile(tmpIn, buf);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `写入失败：${msg}` }, { status: 500 });
  }

  const skip = shouldSkipTranscode();
  const bitrateK = streamingBitrateK();

  if (skip) {
    const filename = `${base}${ext}`;
    const finalPath = path.resolve(uploadsDir, filename);
    try {
      await fs.rename(tmpIn, finalPath);
    } catch (e) {
      await fs.unlink(tmpIn).catch(() => {});
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
    const analysisUrl = await tryWriteTrackAnalysisJson(finalPath, base);
    return NextResponse.json({
      ok: true,
      url: `/music/uploads/${filename}`,
      filename,
      transcoded: false,
      warning:
        "已按 MUSIC_UPLOAD_SKIP_TRANSCODE=1 保存原文件，未做码率压缩。去掉该环境变量并安装 ffmpeg 可启用自动转码。",
      bitrateK: null,
      ...(analysisUrl ? { analysisUrl } : {}),
    });
  }

  const outName = `${base}.m4a`;
  const outPath = path.resolve(uploadsDir, outName);
  const tr = await transcodeToStreamingM4a(tmpIn, outPath);

  await fs.unlink(tmpIn).catch(() => {});

  if (!tr.ok) {
    try {
      const fallbackName = `${base}${ext}`;
      const fallbackPath = path.resolve(uploadsDir, fallbackName);
      await fs.writeFile(fallbackPath, buf);
      await fs.unlink(outPath).catch(() => {});
      const analysisUrl = await tryWriteTrackAnalysisJson(fallbackPath, base);
      return NextResponse.json({
        ok: true,
        url: `/music/uploads/${fallbackName}`,
        filename: fallbackName,
        transcoded: false,
        warning: `${tr.message} 已改存原格式文件，可稍后安装 ffmpeg 再重新上传以生成流式 m4a。`,
        bitrateK: null,
        ...(analysisUrl ? { analysisUrl } : {}),
      });
    } catch (e) {
      await fs.unlink(outPath).catch(() => {});
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json(
        { error: `转码失败且无法回退保存：${tr.message}；${msg}` },
        { status: 500 },
      );
    }
  }

  const analysisUrl = await tryWriteTrackAnalysisJson(outPath, base);
  return NextResponse.json({
    ok: true,
    url: `/music/uploads/${outName}`,
    filename: outName,
    transcoded: true,
    bitrateK,
    ...(analysisUrl ? { analysisUrl } : {}),
  });
}
