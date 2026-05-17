/**
 * 从主题库收录次数生成静态 home-prayer-pool（和合本正文，按次数降序）。
 *
 * 用法（仓库根目录）：
 *   npm run build:theme-repeat-pool -- --min=5
 *   npm run build:theme-repeat-pool -- --min=10 --cap=1500
 */
import { writeThemeRepeatPrayerPool } from "../lib/home-prayer-pools/build-theme-repeat-pool";

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  for (const a of process.argv.slice(2)) {
    if (a.startsWith(prefix)) return a.slice(prefix.length).trim();
  }
  return undefined;
}

function readNumArg(name: string): number | undefined {
  const v = readArg(name);
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

const cwd = process.cwd();
const minCount = readNumArg("min") ?? 5;
const maxCount = readNumArg("max");
const cap = readNumArg("cap");

void writeThemeRepeatPrayerPool(cwd, { minCount, maxCount, cap })
  .then((r) => {
    console.log(
      `[theme-repeat-pool] ${r.scopeId}: ${r.verseCount} verses, ${r.chunkCount} chunks` +
        (r.skippedResolve ? ` (skipped ${r.skippedResolve} unresolved)` : ""),
    );
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
