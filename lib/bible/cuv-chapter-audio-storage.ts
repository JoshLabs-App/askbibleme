import fs from "node:fs";
import path from "node:path";

const MANDARIN_FILENAME_RE = /^[A-Z0-9]{2,8}-\d+\.mp3$/i;
const MANDARIN_V20_REL_RE = /^cuv-v20\/[A-Z0-9]{2,8}-\d+\.mp3$/i;
const TEOCHEW_REL_RE = /^teochew-nt\/[A-Z0-9]{2,8}-\d+\.mp3$/i;
const GOLDEN_VERSE_REL_RE =
  /^golden-verses(?:-web-en)?\/[A-Z0-9]{2,8}-\d+-\d+-32kbps\.mp3$/i;

/** Render 磁盘等：`{DATA_ROOT}/audio` 或 `CUV_AUDIO_DATA_DIR` */
export function cuvChapterAudioDataDir(): string | null {
  const root =
    process.env.CUV_AUDIO_DATA_DIR?.trim() || process.env.DATA_ROOT?.trim();
  if (!root) return null;
  return path.join(root, "audio");
}

/** 相对路径：`GEN-1.mp3` / `cuv-v20/GEN-1.mp3` / `teochew-nt/MAT-1.mp3` */
export function isSafeChapterAudioRelativePath(relativePath: string): boolean {
  const norm = String(relativePath || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
  if (!norm || norm.includes("..")) return false;
  return (
    MANDARIN_FILENAME_RE.test(norm) ||
    MANDARIN_V20_REL_RE.test(norm) ||
    TEOCHEW_REL_RE.test(norm) ||
    GOLDEN_VERSE_REL_RE.test(norm)
  );
}

/** @deprecated use isSafeChapterAudioRelativePath */
export function isSafeCuvChapterAudioFilename(filename: string): boolean {
  return isSafeChapterAudioRelativePath(filename);
}

/** 解析磁盘上的 MP3 路径：`public/audio` 优先，其次 `{DATA_ROOT}/audio` */
export function resolveCuvChapterAudioFilePath(relativePath: string): string | null {
  const norm = String(relativePath || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
  if (!isSafeChapterAudioRelativePath(norm)) return null;

  const candidates: string[] = [path.join(process.cwd(), "public", "audio", norm)];
  const dataDir = cuvChapterAudioDataDir();
  if (dataDir) candidates.push(path.join(dataDir, norm));

  for (const p of candidates) {
    try {
      if (fs.statSync(p).isFile()) return p;
    } catch {
      /* try next */
    }
  }
  return null;
}
