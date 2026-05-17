#!/usr/bin/env node
/** 顺序跑完所有潮语 batch（Render Shell；约 692MB，可分批重试） */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const script = path.join(cwd, "scripts", "pull-teochew-audio-batch-to-disk.mjs");
const manifest = JSON.parse(
  fs.readFileSync(path.join(cwd, "data", "bible", "teochew-nt-audio-manifest.json"), "utf8"),
);
const batchSize = Math.max(1, Number(process.env.TEOCHEW_AUDIO_BATCH_SIZE || 40));
const entries = Array.isArray(manifest.entries) ? manifest.entries : [];
const total = Math.ceil(entries.length / batchSize);
const startAt = Math.max(0, Number(process.env.TEOCHEW_AUDIO_BATCH_START || 0));

for (let i = startAt; i < total; i++) {
  console.log(`\n=== teochew batch ${i + 1}/${total} ===`);
  const r = spawnSync(process.execPath, [script], {
    stdio: "inherit",
    env: {
      ...process.env,
      TEOCHEW_AUDIO_BATCH_INDEX: String(i),
      TEOCHEW_AUDIO_BATCH_SIZE: String(batchSize),
    },
  });
  if (r.status !== 0) {
    console.error(`Stopped at batch index ${i}. Resume with TEOCHEW_AUDIO_BATCH_START=${i}`);
    process.exit(r.status ?? 1);
  }
}

console.log(`\nAll ${total} batches finished (${entries.length} files).`);
