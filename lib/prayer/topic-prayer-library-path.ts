import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** 仓库内优先；否则 AskBible 2 `admin_data`（与 `ASKBIBLE_REPO` / 桌面默认路径一致）。 */
export function resolveTopicPrayerLibraryJsonPath(cwd: string): string | null {
  const local = path.join(cwd, "data", "prayer", "topic_prayer_library.json");
  if (fs.existsSync(local)) return local;
  const repo = process.env.ASKBIBLE_REPO?.trim();
  if (repo) {
    const p = path.join(path.resolve(repo), "admin_data", "topic_prayer_library.json");
    if (fs.existsSync(p)) return p;
  }
  const def = path.join(os.homedir(), "Desktop", "APP", "01 AskBible 2", "admin_data", "topic_prayer_library.json");
  if (fs.existsSync(def)) return def;
  return null;
}
