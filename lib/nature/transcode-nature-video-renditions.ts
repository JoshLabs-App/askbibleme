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

/** 首页背景短片：统一 30fps、固定 GOP，利于硬解与循环 */
const NATURE_VIDEO_FPS = 30;
/** 1s 关键帧间隔（@30fps），短循环 seek / 重缓冲更稳 */
const NATURE_VIDEO_GOP = 30;

function scaleFpsFilter(maxHeight: number): string {
  return `scale=-2:${maxHeight}:flags=lanczos,fps=${NATURE_VIDEO_FPS}`;
}

/** H.264 成片共用编码参数（720 / 1080 仅分辨率不同） */
const NATURE_VIDEO_ENCODE_TAIL = [
  "-an",
  "-sn",
  "-c:v",
  "libx264",
  "-preset",
  "medium",
  "-tune",
  "fastdecode",
  "-crf",
  "22",
  "-g",
  String(NATURE_VIDEO_GOP),
  "-keyint_min",
  String(NATURE_VIDEO_GOP),
  "-sc_threshold",
  "0",
  "-profile:v",
  "high",
  "-level",
  "4.0",
  "-pix_fmt",
  "yuv420p",
  "-color_range",
  "tv",
  "-colorspace",
  "bt709",
  "-color_primaries",
  "bt709",
  "-color_trc",
  "bt709",
  "-movflags",
  "+faststart",
] as const;

async function transcodeOneRendition(
  inputPath: string,
  maxHeight: number,
  outputPath: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  return runFfmpeg([
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    inputPath,
    "-vf",
    scaleFpsFilter(maxHeight),
    ...NATURE_VIDEO_ENCODE_TAIL,
    outputPath,
  ]);
}

/**
 * 自母片生成 720p、1080p H.264（yuv420p limited、bt709、+faststart），无音轨。
 * 固定帧率与 GOP，配合前台「整段缓冲后再播」；新上传生效，旧文件需重传或另行批量重转。
 */
export async function transcodeNatureVideoRenditions(params: {
  inputPath: string;
  out720Path: string;
  out1080Path: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const r1080 = await transcodeOneRendition(params.inputPath, 1080, params.out1080Path);
  if (!r1080.ok) return r1080;

  const r720 = await transcodeOneRendition(params.inputPath, 720, params.out720Path);
  if (!r720.ok) return r720;

  return { ok: true };
}
