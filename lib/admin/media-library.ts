import fs from "node:fs/promises";
import path from "node:path";

/** 仅扫描这些 `public/` 子目录（与上传 API 写入位置一致） */
export const MEDIA_LIBRARY_BUCKETS = [
  { id: "nature_video", urlPrefix: "/nature/uploads/", publicRel: ["nature", "uploads"] as const },
  { id: "nature_audio", urlPrefix: "/nature/audio-uploads/", publicRel: ["nature", "audio-uploads"] as const },
  { id: "nature_thumb", urlPrefix: "/nature/thumbs/", publicRel: ["nature", "thumbs"] as const },
  {
    id: "nature_preview",
    urlPrefix: "/nature/preview-posters/",
    publicRel: ["nature", "preview-posters"] as const,
  },
  { id: "music_audio", urlPrefix: "/music/uploads/", publicRel: ["music", "uploads"] as const },
  { id: "music_bg", urlPrefix: "/music/bg-uploads/", publicRel: ["music", "bg-uploads"] as const },
  { id: "music_analysis", urlPrefix: "/music/analysis/", publicRel: ["music", "analysis"] as const },
  {
    id: "golden_verse_bg",
    urlPrefix: "/golden-verses/bg-uploads/",
    publicRel: ["golden-verses", "bg-uploads"] as const,
  },
] as const;

export type MediaLibraryBucketId = (typeof MEDIA_LIBRARY_BUCKETS)[number]["id"];

export type MediaLibraryKind = "image" | "video" | "audio" | "document" | "other";

export type MediaLibraryListItem = {
  url: string;
  bucketId: MediaLibraryBucketId;
  filename: string;
  size: number;
  mtimeMs: number;
  kind: MediaLibraryKind;
};

const SAFE_NAME = /^[\w.-]+$/;

function classifyKind(filename: string): MediaLibraryKind {
  const lower = filename.toLowerCase();
  const ext = lower.includes(".") ? lower.slice(lower.lastIndexOf(".")) : "";
  if ([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"].includes(ext)) return "image";
  if ([".mp4", ".webm", ".mov", ".m4v"].includes(ext)) return "video";
  if ([".mp3", ".m4a", ".aac", ".wav", ".ogg", ".opus", ".flac"].includes(ext)) return "audio";
  if ([".json", ".md", ".txt", ".pdf"].includes(ext)) return "document";
  return "other";
}

function collectUrlStringsFromJson(v: unknown, out: Set<string>) {
  if (typeof v === "string") {
    const s = v.trim();
    if (s.startsWith("/nature/") || s.startsWith("/music/") || s.startsWith("/golden-verses/")) {
      out.add(s.split("?")[0] ?? s);
    }
    return;
  }
  if (Array.isArray(v)) {
    for (const x of v) collectUrlStringsFromJson(x, out);
    return;
  }
  if (v && typeof v === "object") {
    for (const x of Object.values(v)) collectUrlStringsFromJson(x, out);
  }
}

async function tryReadJson(cwd: string, rel: string): Promise<unknown | null> {
  const target = path.resolve(cwd, rel);
  try {
    const text = await fs.readFile(target, "utf-8");
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** 从 `data/nature-settings.json`、`data/music-companion.json` 等收集已出现的同源资源 URL */
export async function collectReferencedPublicUrls(cwd: string): Promise<Set<string>> {
  const out = new Set<string>();
  const nature = await tryReadJson(cwd, path.join("data", "nature-settings.json"));
  if (nature) collectUrlStringsFromJson(nature, out);
  const companion = await tryReadJson(cwd, path.join("data", "music-companion.json"));
  if (companion) collectUrlStringsFromJson(companion, out);
  const golden = await tryReadJson(cwd, path.join("data", "golden-verses-settings.json"));
  if (golden) collectUrlStringsFromJson(golden, out);
  return out;
}

export function resolveMediaLibraryFile(cwd: string, url: string): string | null {
  const clean = url.split("?")[0]?.trim() ?? "";
  if (!clean.startsWith("/")) return null;
  for (const b of MEDIA_LIBRARY_BUCKETS) {
    if (!clean.startsWith(b.urlPrefix)) continue;
    const rest = clean.slice(b.urlPrefix.length);
    if (!rest || rest.includes("/") || rest.includes("..") || !SAFE_NAME.test(rest)) return null;
    const dir = path.resolve(cwd, "public", ...b.publicRel);
    const abs = path.resolve(dir, rest);
    const rel = path.relative(dir, abs);
    if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
    return abs;
  }
  return null;
}

export async function listMediaLibraryItems(cwd: string): Promise<MediaLibraryListItem[]> {
  const items: MediaLibraryListItem[] = [];
  for (const b of MEDIA_LIBRARY_BUCKETS) {
    const dir = path.resolve(cwd, "public", ...b.publicRel);
    let names: string[] = [];
    try {
      names = await fs.readdir(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      if (name === ".gitkeep" || name.startsWith(".")) continue;
      if (!SAFE_NAME.test(name)) continue;
      const abs = path.join(dir, name);
      let st: Awaited<ReturnType<typeof fs.stat>>;
      try {
        st = await fs.stat(abs);
      } catch {
        continue;
      }
      if (!st.isFile()) continue;
      items.push({
        url: `${b.urlPrefix}${name}`,
        bucketId: b.id,
        filename: name,
        size: st.size,
        mtimeMs: st.mtimeMs,
        kind: classifyKind(name),
      });
    }
  }
  items.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return items;
}

export type MediaLibraryDeleteResult = {
  url: string;
  ok: boolean;
  error?: string;
};

export async function deleteMediaLibraryFiles(
  cwd: string,
  urls: string[],
  opts: { force: boolean },
  referenced: Set<string>,
): Promise<MediaLibraryDeleteResult[]> {
  const results: MediaLibraryDeleteResult[] = [];
  const seen = new Set<string>();
  for (const raw of urls) {
    const url = typeof raw === "string" ? raw.split("?")[0].trim() : "";
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const abs = resolveMediaLibraryFile(cwd, url);
    if (!abs) {
      results.push({ url, ok: false, error: "路径不在允许的资源库内" });
      continue;
    }
    if (referenced.has(url) && !opts.force) {
      results.push({ url, ok: false, error: "仍被 data 配置引用，勾选强制删除或先从配置中移除" });
      continue;
    }
    try {
      await fs.unlink(abs);
      results.push({ url, ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ url, ok: false, error: msg });
    }
  }
  return results;
}
