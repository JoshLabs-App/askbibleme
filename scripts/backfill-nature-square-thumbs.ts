#!/usr/bin/env tsx
/**
 * 为历史自然场景视频补齐 1:1 小图（左裁），写回 data/nature-settings.json。
 * 默认仅补缺（无 thumbSrc 的条目）；传 --force 可覆盖全部。
 *
 * 用法：
 *   tsx scripts/backfill-nature-square-thumbs.ts
 *   tsx scripts/backfill-nature-square-thumbs.ts --force
 */

import fs from "node:fs/promises";
import path from "node:path";
import { extractVideoSquareThumbJpeg } from "../lib/nature/extract-video-preview-frame";
import { resolveNaturePreviewFrameSourcePaths } from "../lib/nature/resolve-nature-preview-frame-source";

const cwd = process.cwd();
const force = process.argv.includes("--force");

function thumbBase(entry: { src?: string; src4k?: string }): string | null {
  const src4k = typeof entry.src4k === "string" ? entry.src4k.trim() : "";
  if (src4k.startsWith("/nature/uploads/")) {
    const name = path.basename(src4k);
    const m = name.match(/^(.+)\.master\.[^.]+$/);
    if (m) return m[1];
  }
  const src = typeof entry.src === "string" ? entry.src.trim() : "";
  if (!src.startsWith("/nature/uploads/")) return null;
  const name = path.basename(src);
  const m2 = name.match(/^(.+)-(?:720|1080)\.[^.]+$/);
  if (m2) return m2[1];
  return path.parse(name).name;
}

async function firstExistingPath(paths: string[]): Promise<string | null> {
  for (const p of paths) {
    try {
      await fs.access(p);
      return p;
    } catch {
      /* try next */
    }
  }
  return null;
}

async function main() {
  const settingsPath = path.join(cwd, "data", "nature-settings.json");
  const rawText = await fs.readFile(settingsPath, "utf8");
  const raw = JSON.parse(rawText) as {
    version?: number;
    videos?: { id?: string; src?: string; src1080?: string; src4k?: string; thumbSrc?: string }[];
  };

  if (raw.version !== 2 || !Array.isArray(raw.videos)) {
    console.error("nature-settings.json 须为 version:2 且含 videos 数组");
    process.exit(1);
  }

  const thumbsDir = path.join(cwd, "public", "nature", "thumbs");
  await fs.mkdir(thumbsDir, { recursive: true });

  let changed = false;
  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const v of raw.videos) {
    const id = typeof v.id === "string" ? v.id.trim() : "";
    if (!force && v.thumbSrc?.trim()) {
      skip += 1;
      continue;
    }

    const base = thumbBase(v);
    if (!base) {
      console.warn("[skip] 无法解析 base", id || "(no id)");
      skip += 1;
      continue;
    }

    const sourcePath = await firstExistingPath(resolveNaturePreviewFrameSourcePaths(cwd, v));
    if (!sourcePath) {
      console.warn("[skip] 无可用视频源", id, base);
      skip += 1;
      continue;
    }

    const outName = `${base}.jpg`;
    const outAbs = path.join(thumbsDir, outName);
    const ex = await extractVideoSquareThumbJpeg(sourcePath, outAbs);
    if (!ex.ok) {
      console.warn("[fail]", id, sourcePath, ex.message);
      try {
        await fs.unlink(outAbs);
      } catch {
        /* ignore */
      }
      fail += 1;
      continue;
    }

    const rel = `/nature/thumbs/${outName}`;
    if (v.thumbSrc !== rel) {
      v.thumbSrc = rel;
      changed = true;
    }
    const stat = await fs.stat(outAbs);
    console.log("[ok]", id || base, rel, `${Math.round(stat.size / 1024)} KB`);
    ok += 1;
  }

  if (changed) {
    await fs.writeFile(settingsPath, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
    console.log("已写回", settingsPath);
  }

  console.log(`\n完成：成功 ${ok}，跳过 ${skip}，失败 ${fail}${force ? "（--force）" : ""}。`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

