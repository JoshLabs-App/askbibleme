import staticCommunityArticles from "@/data/legacy-community-articles.json";

export type LegacyCommunityArticle = {
  id: string;
  slug: string;
  columnId: string;
  columnLabel: string;
  title: string;
  summary: string;
  body: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
  order: number;
  source: string;
};

type LegacyCommunityArticlesRoot = {
  schemaVersion: number;
  items: LegacyCommunityArticle[];
};

let cache: LegacyCommunityArticle[] | null = null;

export function readLegacyCommunityArticles(_cwd = process.cwd()): LegacyCommunityArticle[] {
  if (cache) return cache;
  const raw = staticCommunityArticles as LegacyCommunityArticlesRoot;
  cache = [...(raw.items ?? [])].sort((a, b) => a.order - b.order);
  return cache;
}

export function readLegacyCommunityArticleBySlug(
  slug: string,
  cwd = process.cwd(),
): LegacyCommunityArticle | null {
  return readLegacyCommunityArticles(cwd).find((item) => item.slug === slug) ?? null;
}

export function groupLegacyCommunityArticlesByColumn(
  articles: LegacyCommunityArticle[],
): Array<{ columnId: string; columnLabel: string; items: LegacyCommunityArticle[] }> {
  const groups = new Map<string, { columnId: string; columnLabel: string; items: LegacyCommunityArticle[] }>();
  for (const article of articles) {
    const existing = groups.get(article.columnId);
    if (existing) {
      existing.items.push(article);
      continue;
    }
    groups.set(article.columnId, {
      columnId: article.columnId,
      columnLabel: article.columnLabel,
      items: [article],
    });
  }
  return [...groups.values()].map((group) => ({
    ...group,
    items: [...group.items].sort((a, b) => a.order - b.order),
  }));
}
