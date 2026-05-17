import fs from "node:fs/promises";
import path from "node:path";
import {
  deleteGoldenVerseBackgroundFile,
  goldenVerseBackgroundIdFromFilename,
  goldenVerseBackgroundUrlFromFilename,
  goldenVerseBgUploadsDir,
  isAllowedGoldenVerseBackgroundUrl,
  type GoldenVerseBackgroundItem,
} from "@/lib/golden-verses/background-uploads";

const REL = path.join("data", "golden-verses-settings.json");

export type GoldenVersesSettingsV1 = {
  v: 1;
  backgroundImageUrl: string | null;
};

export type GoldenVersesSettingsV2 = {
  v: 2;
  backgrounds: GoldenVerseBackgroundItem[];
};

export type GoldenVersesSettings = GoldenVersesSettingsV2;

const DEFAULT: GoldenVersesSettingsV2 = { v: 2, backgrounds: [] };

function parseBackgroundItem(raw: unknown): GoldenVerseBackgroundItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const url = typeof o.url === "string" ? o.url.trim() : "";
  const filename = typeof o.filename === "string" ? o.filename.trim() : "";
  if (!isAllowedGoldenVerseBackgroundUrl(url)) return null;
  const idFromUrl = goldenVerseBackgroundIdFromFilename(url.slice(url.lastIndexOf("/") + 1));
  const id =
    typeof o.id === "string" && o.id.trim() && /^[\w-]+$/.test(o.id.trim())
      ? o.id.trim()
      : idFromUrl;
  if (!id) return null;
  const fn = filename || url.slice(url.lastIndexOf("/") + 1);
  const label = typeof o.label === "string" && o.label.trim() ? o.label.trim() : undefined;
  const addedAt = typeof o.addedAt === "string" && o.addedAt.trim() ? o.addedAt.trim() : undefined;
  return { id, url, filename: fn, label, addedAt };
}

function dedupeBackgrounds(items: GoldenVerseBackgroundItem[]): GoldenVerseBackgroundItem[] {
  const seen = new Set<string>();
  const out: GoldenVerseBackgroundItem[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

export function parseGoldenVersesSettings(raw: unknown): GoldenVersesSettingsV2 {
  if (!raw || typeof raw !== "object") return { ...DEFAULT };
  const o = raw as Record<string, unknown>;
  if (o.v === 2) {
    const backgroundsRaw = o.backgrounds;
    const backgrounds = Array.isArray(backgroundsRaw)
      ? dedupeBackgrounds(
          backgroundsRaw
            .map((x) => parseBackgroundItem(x))
            .filter((x): x is GoldenVerseBackgroundItem => x !== null),
        )
      : [];
    return { v: 2, backgrounds };
  }
  if (o.v === 1) {
    const url = o.backgroundImageUrl;
    if (typeof url === "string" && isAllowedGoldenVerseBackgroundUrl(url)) {
      const filename = url.slice(url.lastIndexOf("/") + 1);
      return {
        v: 2,
        backgrounds: [
          {
            id: goldenVerseBackgroundIdFromFilename(filename),
            url: url.trim(),
            filename,
          },
        ],
      };
    }
    return { ...DEFAULT };
  }
  return { ...DEFAULT };
}

/** 扫描上传目录，把磁盘上存在但配置里缺失的文件补进目录（不删配置里已有项） */
export async function syncGoldenVerseBackgroundsFromDisk(
  cwd: string,
  settings: GoldenVersesSettingsV2,
): Promise<GoldenVersesSettingsV2> {
  const uploadsDir = goldenVerseBgUploadsDir(cwd);
  let names: string[] = [];
  try {
    names = await fs.readdir(uploadsDir);
  } catch {
    return settings;
  }
  const byId = new Map(settings.backgrounds.map((b) => [b.id, b]));
  let changed = false;
  for (const name of names) {
    if (name === ".gitkeep" || name.startsWith(".")) continue;
    if (!/^[\w.-]+$/.test(name)) continue;
    const url = goldenVerseBackgroundUrlFromFilename(name);
    if (!isAllowedGoldenVerseBackgroundUrl(url)) continue;
    const id = goldenVerseBackgroundIdFromFilename(name);
    if (byId.has(id)) continue;
    const item: GoldenVerseBackgroundItem = { id, url, filename: name };
    byId.set(id, item);
    changed = true;
  }
  if (!changed) return settings;
  return {
    v: 2,
    backgrounds: [...byId.values()],
  };
}

export async function readGoldenVersesSettings(
  cwd: string,
  opts?: { syncDisk?: boolean },
): Promise<GoldenVersesSettingsV2> {
  const p = path.resolve(cwd, REL);
  let parsed: GoldenVersesSettingsV2;
  try {
    const text = await fs.readFile(p, "utf-8");
    parsed = parseGoldenVersesSettings(JSON.parse(text) as unknown);
  } catch {
    parsed = { ...DEFAULT };
  }
  if (!opts?.syncDisk) return parsed;
  const synced = await syncGoldenVerseBackgroundsFromDisk(cwd, parsed);
  if (synced.backgrounds.length !== parsed.backgrounds.length) {
    await writeGoldenVersesSettings(cwd, synced);
  }
  return synced;
}

export async function writeGoldenVersesSettings(cwd: string, next: GoldenVersesSettingsV2): Promise<void> {
  const p = path.resolve(cwd, REL);
  const dir = path.dirname(p);
  await fs.mkdir(dir, { recursive: true });
  const normalized: GoldenVersesSettingsV2 = {
    v: 2,
    backgrounds: dedupeBackgrounds(next.backgrounds),
  };
  const body = `${JSON.stringify(normalized, null, 2)}\n`;
  await fs.writeFile(p, body, "utf-8");
}

export async function addGoldenVerseBackground(
  cwd: string,
  item: GoldenVerseBackgroundItem,
): Promise<GoldenVersesSettingsV2> {
  const current = await readGoldenVersesSettings(cwd);
  if (current.backgrounds.some((b) => b.id === item.id || b.url === item.url)) {
    return current;
  }
  const next: GoldenVersesSettingsV2 = {
    v: 2,
    backgrounds: [...current.backgrounds, item],
  };
  await writeGoldenVersesSettings(cwd, next);
  return next;
}

export async function removeGoldenVerseBackgrounds(
  cwd: string,
  ids: string[],
): Promise<GoldenVersesSettingsV2> {
  const idSet = new Set(ids.filter(Boolean));
  const current = await readGoldenVersesSettings(cwd);
  const removed = current.backgrounds.filter((b) => idSet.has(b.id));
  const next: GoldenVersesSettingsV2 = {
    v: 2,
    backgrounds: current.backgrounds.filter((b) => !idSet.has(b.id)),
  };
  await writeGoldenVersesSettings(cwd, next);
  for (const item of removed) {
    await deleteGoldenVerseBackgroundFile(cwd, item.filename);
  }
  return next;
}
