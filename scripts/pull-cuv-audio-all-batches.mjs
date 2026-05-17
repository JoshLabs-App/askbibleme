#!/usr/bin/env node
/** 顺序跑完所有 batch（Render Shell；约 1GB 总量，可分批重试） */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const script = path.join(cwd, "scripts", "pull-cuv-audio-batch-to-disk.mjs");
const manifest = JSON.parse(
  fs.readFileSync(path.join(cwd, "data", "bible", "cuv-chapter-audio-manifest.json"), "utf8"),
);
const batchSize = Math.max(1, Number(process.env.CUV_AUDIO_BATCH_SIZE || 80));
const total = Math.ceil(manifest.files.length / batchSize);
const startAt = Math.max(0, Number(process.env.CUV_AUDIO_BATCH_START || 0));

for (let i = startAt; i < total; i++) {
  console.log(`\n=== batch ${i + 1}/${total} ===`);
  const r = spawnSync(process.execPath, [script], {
    stdio: "inherit",
    env: { ...process.env, CUV_AUDIO_BATCH_INDEX: String(i), CUV_AUDIO_BATCH_SIZE: String(batchSize) },
  });
  if (r.status !== 0) {
    console.error(`Stopped at batch index ${i}. Resume with CUV_AUDIO_BATCH_START=${i}`);
    process.exit(r.status ?? 1);
  }
}

console.log(`\nAll ${total} batches finished (${manifest.files.length} files).`);
