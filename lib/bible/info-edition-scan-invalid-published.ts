import { loadPublishedInfoEditionChapter } from "@/lib/bible/info-edition-v1-published-store";
import { validateInfoEditionOutput } from "@/lib/bible/info-edition-v1-output-validate";
import {
  readerVariantToRoleId,
  type InfoEditionReaderVariant,
} from "@/lib/bible/info-edition-v1-publish";
import { readGenerationRolesSync } from "@/lib/admin/generation-roles-store";
import { scriptureBooks } from "@/lib/bible/scripture-books";

export type InvalidPublishedChapterTask = {
  bookId: string;
  bookName: string;
  chapter: number;
  edition: InfoEditionReaderVariant;
  roleId: string;
  issues: string[];
};

/** 扫描已发布文件，找出结构校验未通过的章×版本 */
export function scanInvalidPublishedChapters(cwd: string): InvalidPublishedChapterTask[] {
  const roles = readGenerationRolesSync(cwd).roles;
  const editions: InfoEditionReaderVariant[] = ["info", "guide"];
  const out: InvalidPublishedChapterTask[] = [];

  for (const book of scriptureBooks) {
    for (let c = 1; c <= book.chapters; c++) {
      for (const edition of editions) {
        const roleId = readerVariantToRoleId(edition, roles);
        const ch = loadPublishedInfoEditionChapter(cwd, book.bookId, c, {
          roleId,
          variant: edition,
        });
        if (!ch?.markdown?.trim()) continue;
        const check = validateInfoEditionOutput(ch.markdown, edition);
        if (!check.ok) {
          out.push({
            bookId: book.bookId,
            bookName: book.bookName,
            chapter: c,
            edition,
            roleId,
            issues: check.checks.map((x) => x.message),
          });
        }
      }
    }
  }

  return out;
}
