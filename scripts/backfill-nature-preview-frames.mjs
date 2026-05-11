#!/usr/bin/env node
/**
 * 为已有自然影片生成预览首帧 JPEG（与上传 API 同规则），并写回 data/nature-settings.json。
 * 需本机已安装 ffmpeg（与音乐转码相同）。
 *
 * 用法：node scripts/backfill-nature-preview-frames.mjs
 */

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cwd = path.resolve(__dirname, "..");

function extractFrame(videoPath, outPath) {
  return new Promise((resolve) => {
    const ff = spawn(
      "ffmpeg",
      ["-hide_banner", "-loglevel", "error", "-y", "-i", videoPath, "-frames:v", "1", "-q:v", "3", outPath],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    let err = "";
    ff.stderr?.on("data", (d) => {
      err += d.toString();
    });
    ff.on("error", (e) => {
      resolve({
        ok: false,
        message: e.code === "ENOENT" ? "未找到 ffmpeg，请先安装（如 brew install ffmpeg）" : e.message,
      });
    });
    ff.on("close", (code) => {
      if (code === 0) resolve({ ok: true });
      else resolve({ ok: false, message: err.trim() || `ffmpeg 退出码 ${code}` });
    });
  });
}

async function main() {
  const settingsPath = path.join(cwd, "data", "nature-settings.json");
  const rawText = await fs.readFile(settingsPath, "utf8");
  const raw = JSON.parse(rawText);
  if (raw.version !== 2 || !Array.isArray(raw.videos)) {
    console.error("nature-settings.json 须为 version:2 且含 videos 数组");
    process.exit(1);
  }

  const postersDir = path.join(cwd, "public", "nature", "preview-posters");
  await fs.mkdir(postersDir, { recursive: true });

  let changed = false;
  for (const v of raw.videos) {
    if (v.previewFrameSrc) continue;
    const src = typeof v.src === "string" ? v.src.trim() : "";
    if (!src.startsWith("/nature/uploads/")) continue;

    const videoPath = path.join(cwd, "public", src);
    try {
      await fs.access(videoPath);
    } catch {
      console.warn("[skip] 文件不存在", src);
      continue;
    }

    const base = path.parse(path.basename(src)).name;
    const outName = `${base}.jpg`;
    const outAbs = path.join(postersDir, outName);
    const r = await extractFrame(videoPath, outAbs);
    if (!r.ok) {
      console.warn("[skip] 截取失败", src, r.message);
      try {
        await fs.unlink(outAbs);
      } catch {
        /* ignore */
      }
      continue;
    }

    v.previewFrameSrc = `/nature/preview-posters/${outName}`;
    changed = true;
    console.log("[ok]", v.id, v.previewFrameSrc);
  }

  if (changed) {
    await fs.writeFile(settingsPath, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
    console.log("已写回", settingsPath);
  } else {
    console.log("无需更新（均已含 previewFrameSrc 或无可处理条目）");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
