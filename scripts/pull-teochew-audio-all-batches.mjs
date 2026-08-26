#!/usr/bin/env node
/**
 * DEPRECATED: AskBible 不再托管潮语新约音频（不落 public/、不落 DATA_ROOT）。
 * App / Web 只引用 manifest 里的 TSTSCC remoteUrl。
 * 若仍要本机镜像（例如生成 timing），设 FORCE_TEOCHEW_LOCAL_MIRROR=1。
 */
if (process.env.FORCE_TEOCHEW_LOCAL_MIRROR !== "1") {
  console.error(
    "Refusing: teochew-nt is external-only (TSTSCC). Set FORCE_TEOCHEW_LOCAL_MIRROR=1 to override.",
  );
  process.exit(1);
}

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
