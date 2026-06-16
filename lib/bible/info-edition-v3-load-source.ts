import "server-only";

import {
  INFO_EDITION_GUIDE_V2_ROLE_ID,
  INFO_EDITION_V1_PUBLISH_ROLE_ID,
} from "@/lib/bible/info-edition-v1-publish";
import { loadPublishedInfoEditionChapter } from "@/lib/bible/info-edition-v1-published-store";
import type { InfoEditionV3ChapterSource, InfoEditionV3PublishedSource } from "@/lib/bible/info-edition-v3-correction-types";
import { loadChapterFromDefaultTranslation } from "@/lib/bible/load-chapter-from-default-translation";
import { scriptureBooks } from "@/lib/bible/scripture-books";

function toSource(
  ch: ReturnType<typeof loadPublishedInfoEditionChapter>,
): InfoEditionV3PublishedSource | null {
  if (!ch?.markdown?.trim()) return null;
  return {
    roleId: ch.roleId,
    roleLabel: ch.roleLabel,
    markdown: ch.markdown,
    charCount: ch.charCount ?? ch.markdown.length,
    publishedAt: ch.publishedAt ?? null,
  };
}

export async function loadInfoEditionV3ChapterSource(
  cwd: string,
  bookId: string,
  chapter: number,
): Promise<{ ok: true; source: InfoEditionV3ChapterSource } | { ok: false; error: string }> {
  const bookMeta = scriptureBooks.find((b) => b.bookId === bookId);
  if (!bookMeta) return { ok: false, error: "无效书卷。" };
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > bookMeta.chapters) {
    return { ok: false, error: "无效章号。" };
  }

  const loaded = await loadChapterFromDefaultTranslation(bookId, chapter);
  if (!loaded) {
    return {
      ok: false,
      error: "无法读取本章经文。请先在「译本与上传」登记默认译本。",
    };
  }

  const scripture = loaded.verses.map((v) => `${v.verse} ${v.text}`).join("\n");
  const infoV1 = toSource(
    loadPublishedInfoEditionChapter(cwd, bookId, chapter, {
      roleId: INFO_EDITION_V1_PUBLISH_ROLE_ID,
      variant: "info",
    }),
  );
  const guideV2 = toSource(
    loadPublishedInfoEditionChapter(cwd, bookId, chapter, {
      roleId: INFO_EDITION_GUIDE_V2_ROLE_ID,
      variant: "guide",
    }),
  );

  return {
    ok: true,
    source: {
      bookId: loaded.bookId,
      bookName: loaded.bookName,
      chapter: loaded.chapter,
      translationId: loaded.translationId,
      labelZh: loaded.labelZh || loaded.translationId,
      verseCount: loaded.verses.length,
      scripture,
      infoV1,
      guideV2,
    },
  };
}
