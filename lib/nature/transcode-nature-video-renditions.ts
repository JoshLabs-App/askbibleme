import { spawn } from "node:child_process";

function runFfmpeg(args: string[]): Promise<{ ok: true } | { ok: false; message: string }> {
  return new Promise((resolve) => {
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
            "未找到 ffmpeg。请安装 ffmpeg（如 macOS: brew install ffmpeg）后再上传；或临时设置 NATURE_UPLOAD_SKIP_TRANSCODE=1 仅保存原文件。",
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
 * 自母片生成 720p、1080p H.264（yuv420p、+faststart），无音轨。
 * 适合由本机后台上传 4K 母片后写入 `public/nature/uploads/`。
 */
export async function transcodeNatureVideoRenditions(params: {
  inputPath: string;
  out720Path: string;
  out1080Path: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const commonTail = [
    "-an",
    "-sn",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "22",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
  ] as const;

  const r1080 = await runFfmpeg([
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    params.inputPath,
    "-vf",
    "scale=-2:1080",
    ...commonTail,
    params.out1080Path,
  ]);
  if (!r1080.ok) return r1080;

  const r720 = await runFfmpeg([
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    params.inputPath,
    "-vf",
    "scale=-2:720",
    ...commonTail,
    params.out720Path,
  ]);
  if (!r720.ok) return r720;

  return { ok: true };
}
