import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * 用 ffmpeg 截取视频第 1 帧为 JPEG（自然预览条用）。
 * 部署环境需安装 ffmpeg（与音乐转码相同）；失败时由调用方吞掉并仅打日志。
 */
export async function extractVideoFirstFrameJpeg(
  videoPath: string,
  outputJpegPath: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  await fs.mkdir(path.dirname(outputJpegPath), { recursive: true });

  return new Promise((resolve) => {
    const args = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      videoPath,
      "-frames:v",
      "1",
      "-q:v",
      "3",
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
