import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const GOLDEN_VERSE_BG_UPLOAD_URL_PREFIX = "/golden-verses/bg-uploads/";

export const GOLDEN_VERSE_BG_ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

export const GOLDEN_VERSE_BG_MAX_BYTES = 25 * 1024 * 1024;

export function goldenVerseBgUploadsDir(cwd: string): string {
  return path.resolve(cwd, "public", "golden-verses", "bg-uploads");
}

export function extFromUploadName(name: string): string {
  const n = name.toLowerCase();
  const i = n.lastIndexOf(".");
  if (i < 0) return "";
  return n.slice(i);
}

export function isAllowedGoldenVerseBackgroundUrl(s: string): boolean {
  const t = s.trim();
  if (!t.startsWith(GOLDEN_VERSE_BG_UPLOAD_URL_PREFIX)) return false;
  const rest = t.slice(GOLDEN_VERSE_BG_UPLOAD_URL_PREFIX.length);
  if (!rest || rest.includes("/") || rest.includes("..")) return false;
  return /^[\w.-]+$/.test(rest);
}

export function goldenVerseBackgroundIdFromFilename(filename: string): string {
  const base = path.basename(filename);
  const i = base.lastIndexOf(".");
  return i > 0 ? base.slice(0, i) : base;
}

export function goldenVerseBackgroundUrlFromFilename(filename: string): string {
  return `${GOLDEN_VERSE_BG_UPLOAD_URL_PREFIX}${filename}`;
}

export type GoldenVerseBackgroundItem = {
  id: string;
  url: string;
  filename: string;
  label?: string;
  addedAt?: string;
};

export type SaveGoldenVerseBackgroundFileResult = {
  id: string;
  url: string;
  filename: string;
};

/** 写入 `public/golden-verses/bg-uploads/` 并返回同源 URL 元数据 */
export async function saveGoldenVerseBackgroundFile(
  cwd: string,
  file: File,
): Promise<SaveGoldenVerseBackgroundFileResult> {
  if (file.size > GOLDEN_VERSE_BG_MAX_BYTES) {
    throw new Error(`文件过大（上限 ${Math.round(GOLDEN_VERSE_BG_MAX_BYTES / 1024 / 1024)} MB）。`);
  }
  const origName = file.name || "image";
  const ext = extFromUploadName(origName);
  if (!GOLDEN_VERSE_BG_ALLOWED_EXT.has(ext)) {
    throw new Error(`不支持的扩展名 ${ext || "（无）"}。允许：${[...GOLDEN_VERSE_BG_ALLOWED_EXT].join(" ")}`);
  }
  const base = randomUUID().replace(/-/g, "");
  const uploadsDir = goldenVerseBgUploadsDir(cwd);
  const outName = `${base}${ext}`;
  const outPath = path.resolve(uploadsDir, outName);
  const rel = path.relative(uploadsDir, outPath);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("路径校验失败。");
  }
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.writeFile(outPath, buf);
  return {
    id: goldenVerseBackgroundIdFromFilename(outName),
    url: goldenVerseBackgroundUrlFromFilename(outName),
    filename: outName,
  };
}

export async function deleteGoldenVerseBackgroundFile(cwd: string, filename: string): Promise<void> {
  const uploadsDir = goldenVerseBgUploadsDir(cwd);
  const abs = path.resolve(uploadsDir, filename);
  const rel = path.relative(uploadsDir, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("路径校验失败。");
  }
  try {
    await fs.unlink(abs);
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? (e as { code: string }).code : "";
    if (code !== "ENOENT") throw e;
  }
}
