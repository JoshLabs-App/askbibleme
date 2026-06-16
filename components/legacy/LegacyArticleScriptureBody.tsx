import { LegacyArticleMarkdown } from "@/components/legacy/LegacyArticleMarkdown";
import { enrichArticleMarkdownWithScriptureContent } from "@/lib/explore/enrich-article-scripture-content";
import type { AppLocale } from "@/lib/i18n/config";

type Props = {
  content: string;
  locale?: AppLocale;
  variant?: "default" | "explore";
};

export async function LegacyArticleScriptureBody({
  content,
  locale = "zh-CN",
  variant = "explore",
}: Props) {
  const enriched = await enrichArticleMarkdownWithScriptureContent({
    markdown: content,
    locale,
  });

  return (
    <LegacyArticleMarkdown
      content={enriched}
      linkScriptureRefs
      variant={variant}
    />
  );
}
