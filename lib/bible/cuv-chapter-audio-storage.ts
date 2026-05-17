import fs from "node:fs";
import path from "node:path";

const FILENAME_RE = /^[A-Z0-9]{2,8}-\d+\.mp3$/i;

/** Render 磁盘等：`{DATA_ROOT}/audio` 或 `CUV_AUDIO_DATA_DIR` */
export function cuvChapterAudioDataDir(): string | null {
  const root =
    process.env.CUV_AUDIO_DATA_DIR?.trim() || process.env.DATA_ROOT?.trim();
  if (!root) return null;
  return path.join(root, "audio");
}

export function isSafeCuvChapterAudioFilename(filename: string): boolean {
  const base = path.basename(String(filename || "").trim());
  return Boolean(base) && FILENAME_RE.test(base);
}

/** 解析磁盘上的 MP3 路径：`public/audio` 优先，其次 `{DATA_ROOT}/audio` */
export function resolveCuvChapterAudioFilePath(filename: string): string | null {
  const safe = path.basename(String(filename || "").trim());
  if (!isSafeCuvChapterAudioFilename(safe)) return null;

  const candidates: string[] = [
    path.join(process.cwd(), "public", "audio", safe),
  ];
  const dataDir = cuvChapterAudioDataDir();
  if (dataDir) candidates.push(path.join(dataDir, safe));

  for (const p of candidates) {
    try {
      if (fs.statSync(p).isFile()) return p;
    } catch {
      /* try next */
    }
  }
  return null;
}
