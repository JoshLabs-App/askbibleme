import Link from "next/link";
import { ScriptureChrome } from "@/components/scripture/ScriptureChrome";
import {
  groupLegacyCommunityArticlesByColumn,
  readLegacyCommunityArticles,
} from "@/lib/legacy-community-articles";
import { sitePageTitle } from "@/lib/site-metadata-defaults";
import "./legacy-articles.css";

export const metadata = {
  title: sitePageTitle("旧站文章预览"),
  robots: { index: false, follow: false },
};

export default function LegacyArticlesIndexPage() {
  const articles = readLegacyCommunityArticles();
  const groups = groupLegacyCommunityArticlesByColumn(articles);

  return (
    <ScriptureChrome scrollHome>
      <div className="legacy-articles-page">
        <header className="legacy-articles-header">
          <p className="legacy-articles-eyebrow">临时预览 · 非公开</p>
          <h1 className="legacy-articles-title">AskOLD 文章迁移预览</h1>
          <p className="legacy-articles-lead">
            从旧站导入的 9 篇文章，供你审阅正文后再决定如何纳入新站。此页不会出现在导航中，也不会被搜索引擎索引。
          </p>
        </header>

        <div className="legacy-articles-groups">
          {groups.map((group) => (
            <section key={group.columnId} className="legacy-articles-group">
              <h2 className="legacy-articles-group-title">
                {group.columnLabel}
                <span className="legacy-articles-group-count">{group.items.length} 篇</span>
              </h2>
              <ul className="legacy-articles-list">
                {group.items.map((article) => (
                  <li key={article.slug}>
                    <Link href={`/dev/legacy-articles/${article.slug}`} className="legacy-articles-link">
                      <span className="legacy-articles-link-title">{article.title}</span>
                      {article.summary ? (
                        <span className="legacy-articles-link-summary">{article.summary}</span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </ScriptureChrome>
  );
}
