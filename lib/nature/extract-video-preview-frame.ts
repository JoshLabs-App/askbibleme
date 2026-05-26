import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

/** 预览静图最长边上限（真 4K）；不放大低于此宽度的源 */
export const NATURE_PREVIEW_FRAME_MAX_WIDTH = 3840;

export type ExtractVideoPreviewFrameOptions = {
  /** 最长边上限，默认 3840；仅缩小、不放大 */
  maxWidth?: number;
  /** ffmpeg JPEG 质量 -q:v，2 更清晰，默认 2 */
  quality?: number;
};

export type ExtractVideoSquareThumbOptions = {
  /** 正方形边长，默认 768 */
  size?: number;
  /** ffmpeg JPEG 质量 -q:v，2 更清晰，默认 3 */
  quality?: number;
};

/**
 * 用 ffmpeg 截取视频第 1 帧为 JPEG（自然首页静图 / 预览条）。
 * 部署环境需安装 ffmpeg（与音乐转码相同）；失败时由调用方吞掉并仅打日志。
 */
export async function extractVideoFirstFrameJpeg(
  videoPath: string,
  outputJpegPath: string,
  options?: ExtractVideoPreviewFrameOptions,
): Promise<{ ok: true } | { ok: false; message: string }> {
  await fs.mkdir(path.dirname(outputJpegPath), { recursive: true });

  const maxWidth = options?.maxWidth ?? NATURE_PREVIEW_FRAME_MAX_WIDTH;
  const quality = options?.quality ?? 2;

  return new Promise((resolve) => {
    const args = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      videoPath,
      "-vf",
      `scale='min(${maxWidth},iw)':-2:flags=lanczos`,
      "-frames:v",
      "1",
      "-q:v",
      String(quality),
      outputJpegPath,
    ];

    const ff = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    ff.stderr?.on("data", (d: Buffer) => {
      err += d.toString();
    });
    ff.on("error", (e: NodeJS.ErrnoException) => {
      if (e.code === "ENOENT") {
        resolve({
          ok: false,
          message:
            "未找到 ffmpeg。请安装 ffmpeg（如 macOS: brew install ffmpeg）；Vercel 等无 ffmpeg 时预览帧将跳过。",
        });
        return;
      }
      resolve({ ok: false, message: e.message });
    });
    ff.on("close", (code) => {
      if (code === 0) resolve({ ok: true });
      else resolve({ ok: false, message: err.trim() || `ffmpeg 退出码 ${code}` });
    });
  });
}

/**
 * 用 ffmpeg 截取首帧并生成 1:1 正方形封面 JPEG（左侧优先裁切，避免变形）。
 */
export async function extractVideoSquareThumbJpeg(
  videoPath: string,
  outputJpegPath: string,
  options?: ExtractVideoSquareThumbOptions,
): Promise<{ ok: true } | { ok: false; message: string }> {
  await fs.mkdir(path.dirname(outputJpegPath), { recursive: true });

  const size = Math.max(256, Math.round(options?.size ?? 768));
  const quality = options?.quality ?? 3;

  return new Promise((resolve) => {
    const args = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      videoPath,
      "-vf",
      `scale='if(gte(iw,ih),-2,${size})':'if(gte(iw,ih),${size},-2)':flags=lanczos,crop=${size}:${size}:0:(ih-oh)/2`,
      "-frames:v",
      "1",
      "-q:v",
      String(quality),
      outputJpegPath,
    ];

    const ff = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    ff.stderr?.on("data", (d: Buffer) => {
      err += d.toString();
    });
    ff.on("error", (e: NodeJS.ErrnoException) => {
      if (e.code === "ENOENT") {
        resolve({
          ok: false,
          message:
            "未找到 ffmpeg。请安装 ffmpeg（如 macOS: brew install ffmpeg）；无 ffmpeg 时 1:1 小图将跳过。",
        });
        return;
      }
      resolve({ ok: false, message: e.message });
    });
    ff.on("close", (code) => {
      if (code === 0) resolve({ ok: true });
      else resolve({ ok: false, message: err.trim() || `ffmpeg 退出码 ${code}` });
    });
  });
}
