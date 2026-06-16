/**
 * 为已构建的读经计划 bundle 写入 planChapterTotal（一次性预计算，供运行时直接读取）。
 *
 * Run: npx tsx scripts/enrich-reading-plan-chapter-totals.ts
 */
import fs from "node:fs/promises";
import path from "node:path";

import { withBundledReadingPlanChapterTotal } from "@/lib/bible/reading-plans/plan-chapter-total";
import type { ReadingPlanBundle } from "@/lib/bible/reading-plans/types";

const ROOT = process.cwd();
const BUILT_DIR = path.join(ROOT, "data", "bible-reading-plans", "built");

async function enrichBundleFile(absPath: string): Promise<void> {
  const raw = await fs.readFile(absPath, "utf-8");
  const bundle = JSON.parse(raw) as ReadingPlanBundle;
  if (bundle?.schemaVersion !== 1 || !Array.isArray(bundle.days)) {
    throw new Error(`invalid bundle: ${absPath}`);
  }

  let changed = false;
  for (const day of bundle.days) {
    day.readings = day.readings.map((reading) => {
      const next = withBundledReadingPlanChapterTotal(reading);
      if (reading.planChapterTotal !== next.planChapterTotal) changed = true;
      return next;
    });
  }

  if (!changed) {
    console.log(`skip (unchanged): ${path.basename(absPath)}`);
    return;
  }

  await fs.writeFile(absPath, `${JSON.stringify(bundle, null, 2)}\n`, "utf-8");
  console.log(`updated: ${path.basename(absPath)}`);
}

async function main() {
  const files = (await fs.readdir(BUILT_DIR)).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    await enrichBundleFile(path.join(BUILT_DIR, file));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
