import { GENERATION_ROLE_BUILTIN_INFO_V1 } from "@/lib/admin/generation-roles-types";
import { normalizeInfoEditionCompareMarkdown } from "@/lib/bible/info-edition-v1-format";
import type { InfoEditionV1Generation } from "@/lib/bible/info-edition-v1-types";
import type { InfoEditionV1PublishedChapter } from "@/lib/bible/info-edition-v1-published-types";

/** 前台读经页默认：基础版 × DeepSeek */
export const INFO_EDITION_V1_PUBLISH_ROLE_ID = GENERATION_ROLE_BUILTIN_INFO_V1;
export const INFO_EDITION_V1_PUBLISH_PROFILE_ID = "slot:deepseek";

export function infoEditionChapterKey(bookId: string, chapter: number): string {
  return `${bookId.trim().toUpperCase()}:${chapter}`;
}

function generationOk(g: InfoEditionV1Generation): boolean {
  return !g.error && g.text.trim().length > 0;
}

/** 从一次对比结果中选出要发布到读经页的一路（基础版 + DeepSeek 优先） */
export function pickPublishedGeneration(
  generations: InfoEditionV1Generation[],
): InfoEditionV1Generation | null {
  const list = generations.filter(generationOk);
  if (!list.length) return null;

  const score = (g: InfoEditionV1Generation): number => {
    let s = 0;
    if (g.generationRoleId === INFO_EDITION_V1_PUBLISH_ROLE_ID) s += 100;
    if (g.generationRoleLabel.trim() === "基础版") s += 80;
    if (g.profileId === INFO_EDITION_V1_PUBLISH_PROFILE_ID) s += 50;
    if (/deepseek/i.test(g.profileName)) s += 40;
    return s;
  };

  return [...list].sort((a, b) => score(b) - score(a))[0] ?? null;
}

/** 展示用：把默认发布项排在最前 */
export function sortGenerationsWithPublishedFirst(
  generations: InfoEditionV1Generation[],
): InfoEditionV1Generation[] {
  const picked = pickPublishedGeneration(generations);
  if (!picked) return generations;
  const rest = generations.filter((g) => g !== picked);
  return [picked, ...rest];
}

export function generationToPublishedChapter(
  bookId: string,
  chapter: number,
  g: InfoEditionV1Generation,
  publishedAt: string,
): InfoEditionV1PublishedChapter {
  const markdown = normalizeInfoEditionCompareMarkdown(g.text);
  return {
    bookId: bookId.trim().toUpperCase(),
    chapter,
    roleId: g.generationRoleId,
    roleLabel: g.generationRoleLabel.trim() || "基础版",
    profileId: g.profileId,
    profileName: g.profileName.trim() || g.profileId,
    markdown,
    charCount: markdown.length,
    publishedAt,
  };
}
