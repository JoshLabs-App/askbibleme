import path from "node:path";

export function contentCorrectionsStorePath(cwd = process.cwd()): string | null {
  const external = process.env.FEEDBACK_DATA_DIR?.trim() || process.env.DATA_ROOT?.trim();
  if (external) {
    return path.join(path.resolve(external), "content-corrections", "content-corrections.jsonl");
  }
  if (process.env.NODE_ENV === "production") return null;
  return path.join(cwd, "data", "content-corrections", "content-corrections.jsonl");
}
