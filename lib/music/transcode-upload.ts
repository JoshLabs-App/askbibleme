import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

function parseBitrateK(): number {
  const raw = process.env.MUSIC_UPLOAD_BITRATE_K?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 96;
  if (!Number.isFinite(n) || n < 32 || n > 320) return 96;
  return n;
}

/**
 * 用 ffmpeg 将任意常见音频转为适合 `<audio>` 流式播放的 AAC（.m4a）。
 * - `-movflags +faststart`：moov 前置，利于边下边播
 * - 码率默认 96kbps，可用环境变量 `MUSIC_UPLOAD_BITRATE_K` 覆盖（32–320）
 */
export async function transcodeToStreamingM4a(
  inputPath: string,
  outputPath: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const bitrateK = parseBitrateK();
  const outDir = path.dirname(outputPath);
  await fs.mkdir(outDir, { recursive: true });

  return new Promise((resolve) => {
    const args = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      inputPath,
      "-vn",
      "-c:a",
      "aac",
      "-b:a",
      `${bitrateK}k`,
      "-ac",
      "2",
      "-ar",
      "44100",
      "-movflags",
      "+faststart",
      outputPath,
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
            "未找到 ffmpeg 可执行文件。请安装 ffmpeg（例如 macOS: brew install ffmpeg），或设置 MUSIC_UPLOAD_SKIP_TRANSCODE=1 跳过转码。",
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

export function shouldSkipTranscode(): boolean {
  return process.env.MUSIC_UPLOAD_SKIP_TRANSCODE === "1";
}

export function streamingBitrateK(): number {
  return parseBitrateK();
}
