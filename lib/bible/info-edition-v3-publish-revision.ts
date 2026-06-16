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
  file.chapters[key] = entry;
  if (file.pending?.[key]) {
    const pending = { ...file.pending };
    delete pending[key];
    file.pending = pending;
  }
  if (file.failed?.[key]) {
    const failed = { ...file.failed };
    delete failed[key];
    file.failed = failed;
  }
  writeInfoEditionV1PublishedSync(cwd, file);
  return entry;
}
