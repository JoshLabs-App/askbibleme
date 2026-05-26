import fs from "node:fs";
import path from "node:path";
import type { InvalidPublishedChapterTask } from "@/lib/bible/info-edition-scan-invalid-published";
import type { InfoEditionReaderVariant } from "@/lib/bible/info-edition-v1-publish";

export type InvalidPublishedScanSummary = {
  at: string;
  count: number;
  sample: {
    bookId: string;
    bookName: string;
    chapter: number;
    edition: InfoEditionReaderVariant;
    issues: string[];
  }[];
};

const CACHE_TTL_MS = 5 * 60 * 1000;

export function infoEditionInvalidScanCachePath(cwd: string): string {
  return path.join(cwd, "data", "bible", "info-edition-v1-batch-invalid-scan.json");
}

export function invalidTasksToSummary(
  tasks: InvalidPublishedChapterTask[],
): InvalidPublishedScanSummary {
  return {
    at: new Date().toISOString(),
    count: tasks.length,
    sample: tasks.slice(0, 8).map((t) => ({
      bookId: t.bookId,
      bookName: t.bookName,
      chapter: t.chapter,
      edition: t.edition,
      issues: t.issues.slice(0, 2),
    })),
  };
}

export function writeInvalidPublishedScanCache(
  cwd: string,
  tasks: InvalidPublishedChapterTask[],
): void {
  const p = infoEditionInvalidScanCachePath(cwd);
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(invalidTasksToSummary(tasks), null, 2)}\n`, "utf8");
}

export function readInvalidPublishedScanCache(
  cwd: string,
): InvalidPublishedScanSummary | null {
  const p = infoEditionInvalidScanCachePath(cwd);
  if (!fs.existsSync(p)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf8")) as InvalidPublishedScanSummary;
    if (typeof raw.count !== "number" || !Array.isArray(raw.sample)) return null;
    return raw;
  } catch {
    return null;
  }
}

/** GET 状态用：读缓存，过期则返回 null（避免每次全量扫描 published） */
export function readInvalidPublishedScanCacheFresh(
  cwd: string,
  maxAgeMs = CACHE_TTL_MS,
): InvalidPublishedScanSummary | null {
  const cached = readInvalidPublishedScanCache(cwd);
  if (!cached?.at) return null;
  const age = Date.now() - new Date(cached.at).getTime();
  if (!Number.isFinite(age) || age > maxAgeMs) return null;
  return cached;
}
