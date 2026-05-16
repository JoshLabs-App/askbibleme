import type { VerseRef } from "@/lib/bible/verse-ref";

/** 与 `public/data/home-prayer-pools` chunk 内 `verseKey` 一致。 */
export function verseKeyFromVerseRef(ref: VerseRef): string {
  const b = String(ref.bookId || "").trim().toUpperCase();
  const ch = ref.chapter;
  const vs = ref.verseStart;
  const ve = ref.verseEnd;
  if (vs === ve) return `${b}.${ch}.${vs}`;
  return `${b}.${ch}.${vs}-${b}.${ch}.${ve}`;
}
