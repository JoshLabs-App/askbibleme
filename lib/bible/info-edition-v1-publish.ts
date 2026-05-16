import { GENERATION_ROLE_BUILTIN_INFO_V1 } from "@/lib/admin/generation-roles-types";
import type { GenerationRole } from "@/lib/admin/generation-roles-types";
import type { AIConnectionProfile } from "@/lib/ai/types";
import { normalizeInfoEditionCompareMarkdown } from "@/lib/bible/info-edition-v1-format";
import type { InfoEditionV1Generation } from "@/lib/bible/info-edition-v1-types";
import type { InfoEditionV1PublishedChapter } from "@/lib/bible/info-edition-v1-published-types";

/** 前台读经页 / 后台生产流程默认：基础版 × DeepSeek */
export const INFO_EDITION_V1_PUBLISH_ROLE_ID = GENERATION_ROLE_BUILTIN_INFO_V1;
export const INFO_EDITION_V1_PUBLISH_PROFILE_ID = "slot:deepseek";

function productionProfileScore(p: Pick<AIConnectionProfile, "id" | "model" | "name">): number {
  if (p.id === INFO_EDITION_V1_PUBLISH_PROFILE_ID) return 100;
  const model = p.model.trim().toLowerCase();
  if (model === "deepseek-chat" || model.endsWith("/deepseek-chat")) return 90;
  if (/deepseek/i.test(model) || /deepseek/i.test(p.name)) return 80;
  return 0;
}

function productionRoleScore(r: Pick<GenerationRole, "id" | "label">): number {
  if (r.id === INFO_EDITION_V1_PUBLISH_ROLE_ID) return 100;
  if (r.label.trim() === "基础版") return 90;
  return 0;
}

/** V1 后台：DeepSeek 等生产默认连接排在最前 */
export function sortProfilesForInfoEditionProduction<T extends AIConnectionProfile>(profiles: T[]): T[] {
  return [...profiles].sort((a, b) => productionProfileScore(b) - productionProfileScore(a));
}

/** V1 后台：基础版排在最前 */
export function sortRolesForInfoEditionProduction<T extends GenerationRole>(roles: T[]): T[] {
  return [...roles].sort((a, b) => productionRoleScore(b) - productionRoleScore(a));
}

/** 无已选连接时：默认 deepseek-chat（网关 slot:deepseek） */
export function pickDefaultInfoEditionProfileIds(
  profiles: Pick<AIConnectionProfile, "id" | "model" | "name">[],
): string[] {
  const sorted = sortProfilesForInfoEditionProduction([...profiles] as AIConnectionProfile[]);
  const top = sorted[0];
  if (!top || productionProfileScore(top) === 0) return [];
  return [top.id];
}

/** 无已选角色时：默认基础版 */
export function pickDefaultInfoEditionRoleIds(roles: Pick<GenerationRole, "id" | "label">[]): string[] {
  const sorted = sortRolesForInfoEditionProduction([...roles] as GenerationRole[]);
  const top = sorted[0];
  if (!top || productionRoleScore(top) === 0) return [];
  return [top.id];
}

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
