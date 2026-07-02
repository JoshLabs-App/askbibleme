import "server-only";

import { normalizeInfoEditionCompareMarkdown } from "@/lib/bible/info-edition-v1-format";
import {
  infoEditionReaderChapterKey,
  type InfoEditionReaderVariant,
} from "@/lib/bible/info-edition-v1-publish";
import {
  readInfoEditionV1PublishedSync,
  writeInfoEditionV1PublishedSync,
} from "@/lib/bible/info-edition-v1-published-store";
import type { InfoEditionV1PublishedChapter } from "@/lib/bible/info-edition-v1-published-types";

export type PublishV3RevisionOpts = {
  variant: InfoEditionReaderVariant;
  markdown: string;
  profileId: string;
  profileName: string;
  roleId: string;
  roleLabel: string;
};

/** 将 V3 修订稿写入发布缓存，保留正确的读经页 roleId。 */
export function publishInfoEditionV3Revision(
  cwd: string,
  bookId: string,
  chapter: number,
  opts: PublishV3RevisionOpts,
): InfoEditionV1PublishedChapter {
  const markdown = normalizeInfoEditionCompareMarkdown(opts.markdown);
  const now = new Date().toISOString();
  const entry: InfoEditionV1PublishedChapter = {
    bookId: bookId.trim().toUpperCase(),
    chapter,
    roleId: opts.roleId,
    roleLabel: opts.roleLabel.trim() || (opts.variant === "guide" ? "发现版V2" : "基础版"),
    profileId: opts.profileId,
    profileName: opts.profileName.trim() || opts.profileId,
    markdown,
    charCount: markdown.length,
    publishedAt: now,
  };

  const file = readInfoEditionV1PublishedSync(cwd);
  const key = infoEditionReaderChapterKey(bookId, chapter, opts.roleId);
  // 不要就地修改 readInfoEditionV1PublishedSync 返回的对象（进程内缓存可能共享）。
  const chapters = { ...file.chapters, [key]: entry };
  let pending = file.pending;
  if (pending?.[key]) {
    pending = { ...pending };
    delete pending[key];
  }
  let failed = file.failed;
  if (failed?.[key]) {
    failed = { ...failed };
    delete failed[key];
  }
  writeInfoEditionV1PublishedSync(cwd, { ...file, chapters, pending, failed });
  return entry;
}
