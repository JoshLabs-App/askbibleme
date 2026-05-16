#!/usr/bin/env tsx
/**
 * 用当前转码参数，自 `*.master.*` 重新生成 `-720.mp4` / `-1080.mp4`，并刷新预览首帧。
 * 需本机 ffmpeg。用法：npm run nature:retranscode
 */

import fs from "node:fs/promises";
import path from "node:path";
import { extractVideoFirstFrameJpeg } from "../lib/nature/extract-video-preview-frame";
import { transcodeNatureVideoRenditions } from "../lib/nature/transcode-nature-video-renditions";

const cwd = process.cwd();
const uploadsDir = path.join(cwd, "public", "nature", "uploads");
const postersDir = path.join(cwd, "public", "nature", "preview-posters");

const MASTER_RE = /^(.+)\.master\.[^.]+$/;

async function listMasters(): Promise<{ base: string; masterPath: string }[]> {
  const names = await fs.readdir(uploadsDir);
  const out: { base: string; masterPath: string }[] = [];
  for (const name of names) {
    const m = name.match(MASTER_RE);
    if (!m) continue;
    out.push({ base: m[1], masterPath: path.join(uploadsDir, name) });
  }
  out.sort((a, b) => a.base.localeCompare(b.base));
  return out;
}

async function main() {
  const masters = await listMasters();
  if (!masters.length) {
    console.log("未找到 public/nature/uploads/*.master.*，无需处理。");
    return;
  }

  await fs.mkdir(postersDir, { recursive: true });
  console.log(`将重转码 ${masters.length} 条母片…\n`);

  let ok = 0;
  let fail = 0;

  for (const { base, masterPath } of masters) {
    const out720 = path.join(uploadsDir, `${base}-720.mp4`);
    const out1080 = path.join(uploadsDir, `${base}-1080.mp4`);
    const tmp720 = path.join(uploadsDir, `${base}-720.retranscode.tmp.mp4`);
    const tmp1080 = path.join(uploadsDir, `${base}-1080.retranscode.tmp.mp4`);

    process.stdout.write(`[${base}] 转码中… `);

    try {
      await fs.unlink(tmp720).catch(() => {});
      await fs.unlink(tmp1080).catch(() => {});

      const tr = await transcodeNatureVideoRenditions({
        inputPath: masterPath,
        out720Path: tmp720,
        out1080Path: tmp1080,
      });
      if (!tr.ok) {
        fail += 1;
        console.log(`失败：${tr.message}`);
        await fs.unlink(tmp720).catch(() => {});
        await fs.unlink(tmp1080).catch(() => {});
        continue;
      }

      await fs.rename(tmp720, out720);
      await fs.rename(tmp1080, out1080);

      const previewPath = path.join(postersDir, `${base}.jpg`);
      const frame = await extractVideoFirstFrameJpeg(out720, previewPath);
      if (!frame.ok) {
        console.log(`成片 OK，预览帧跳过：${frame.message}`);
      } else {
        const s720 = (await fs.stat(out720)).size;
        const s1080 = (await fs.stat(out1080)).size;
        console.log(`OK（720 ${Math.round(s720 / 1024)} KB，1080 ${Math.round(s1080 / 1024)} KB）`);
      }
      ok += 1;
    } catch (e) {
      fail += 1;
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`异常：${msg}`);
      await fs.unlink(tmp720).catch(() => {});
      await fs.unlink(tmp1080).catch(() => {});
    }
  }

  console.log(`\n完成：成功 ${ok}，失败 ${fail}。`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
