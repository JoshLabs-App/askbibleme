const MANDARIN_FILENAME_RE = /^[A-Z0-9]{2,8}-\d+\.mp3$/i;
const MANDARIN_V20_REL_RE = /^cuv-v20\/[A-Z0-9]{2,8}-\d+\.mp3$/i;
const TEOCHEW_REL_RE = /^teochew-nt\/[A-Z0-9]{2,8}-\d+\.mp3$/i;
const GOLDEN_VERSE_REL_RE =
  /^golden-verses(?:-web-en)?\/[A-Z0-9]{2,8}-\d+-\d+-32kbps\.mp3$/i;

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
