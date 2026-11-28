import { useEffect, useState } from "react";
import { platformBridge } from "../bridge/platform-adapter";
import { SimpleMarkdown } from "../components/SimpleMarkdown";
import {
  loadExploreData,
  loadSiblingAppsData,
  type ExploreArticle,
  type SiblingAppItem,
} from "../data/content-repo";

export interface ExplorePageProps {
  selectedSlug?: string;
  onNavigate: (path: string) => void;
  onOpenReader: (bookId: string, chapter: number) => void;
}

export default function ExplorePage({
  selectedSlug,
  onNavigate,
  onOpenReader,
}: ExplorePageProps) {
  const [articles, setArticles] = useState<ExploreArticle[] | null>(null);
  const [siblingApps, setSiblingApps] = useState<SiblingAppItem[]>([]);

  useEffect(() => {
    let active = true;
    void loadExploreData().then((res) => {
      if (active) setArticles(res.articles);
    });
    void loadSiblingAppsData().then((res) => {
      if (active) {
        // 遵守 D-42：每个 App 显示时去掉自己（askbible）
        setSiblingApps(res.apps.filter((app) => app.id !== "askbible"));
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const currentArticle = selectedSlug && articles
    ? articles.find((a) => a.slug === selectedSlug) ?? null
    : null;

  function openArticle(slug: string) {
    void platformBridge.call("shell.haptic", { style: "light" });
    onNavigate(`/explore/${encodeURIComponent(slug)}`);
  }

  function backToExplore() {
    void platformBridge.call("shell.haptic", { style: "light" });
    onNavigate("/explore");
  }

  function resolveAppPrimaryLink(app: SiblingAppItem): { href: string; label: string } {
    const plat = platformBridge.getPlatform();
    if (plat === "ios" && app.iosUrl) return { href: app.iosUrl, label: "App Store" };
    if (plat === "android" && app.androidUrl) return { href: app.androidUrl, label: "下载 / 官网" };
    return { href: app.url, label: "网页版" };
  }

  if (selectedSlug && !articles) {
    return <div className="ab-loading">正在翻开导读文章…</div>;
  }

  if (currentArticle) {
    return (
      <div className="ab-stack">
        <div className="ab-row-between">
          <button type="button" className="ab-btn" onClick={backToExplore}>
            ← 返回书房
          </button>
          <div className="ab-row">
            <span className="ab-pill">{currentArticle.category}</span>
            <span className="ab-card-meta">约 {currentArticle.readingMinutes} 分钟</span>
          </div>
        </div>

        <article
          className="ab-card"
          style={{ backgroundColor: "var(--ab-read-open-book-paper)" }}
        >
          <h1 className="ab-page-title" style={{ marginBottom: 6 }}>
            {currentArticle.title}
          </h1>
          <p className="ab-page-subtitle" style={{ marginBottom: 14 }}>
            {currentArticle.subtitle}
          </p>
          <hr className="ab-divider" />
          <SimpleMarkdown
            markdown={currentArticle.bodyMarkdown}
            onOpenReader={(b, c) => {
              void platformBridge.call("shell.haptic", { style: "light" });
              onOpenReader(b, c);
            }}
          />
          <hr className="ab-divider" />
          <div className="ab-row-between">
            <button type="button" className="ab-btn" onClick={backToExplore}>
              浏览其他导读
            </button>
            <button
              type="button"
              className="ab-btn ab-btn-primary"
              onClick={() => {
                void platformBridge.call("shell.haptic", { style: "light" });
                onOpenReader("JHN", 1);
              }}
            >
              回到圣经经文
            </button>
          </div>
        </article>
      </div>
    );
  }

  return (
    <div className="ab-stack">
      <div>
        <h1 className="ab-page-title">书房与探索</h1>
        <p className="ab-page-subtitle">安静进入圣经的线索、导读文章与人物索引。</p>
      </div>

      <section className="ab-grid-2">
        <button
          type="button"
          className="ab-card ab-card-btn"
          onClick={() => {
            void platformBridge.call("shell.haptic", { style: "light" });
            onNavigate("/figures");
          }}
        >
          <span className="ab-pill">人物馆</span>
          <div className="ab-card-title" style={{ marginTop: 8 }}>圣经人物索引</div>
          <div className="ab-muted">按时代与关键词直达人物所在经文，不堆砌百科。</div>
        </button>

        <button
          type="button"
          className="ab-card ab-card-btn"
          onClick={() => {
            void platformBridge.call("shell.haptic", { style: "light" });
            onNavigate("/ex-libris");
          }}
        >
          <span className="ab-pill ab-pill-ok">藏书票</span>
          <div className="ab-card-title" style={{ marginTop: 8 }}>读经印记图鉴</div>
          <div className="ab-muted">安静留存翻开经卷与每日同行的时间刻痕。</div>
        </button>

        <button
          type="button"
          className="ab-card ab-card-btn"
          onClick={() => {
            void platformBridge.call("shell.haptic", { style: "light" });
            onNavigate("/panorama");
          }}
        >
          <span className="ab-pill">全景</span>
          <div className="ab-card-title" style={{ marginTop: 8 }}>六幕救赎历史</div>
          <div className="ab-muted">从创造到新天新地，直达全本 66 卷简介。</div>
        </button>

        <button
          type="button"
          className="ab-card ab-card-btn"
          onClick={() => {
            void platformBridge.call("shell.haptic", { style: "light" });
            onOpenReader("PSA", 23);
          }}
        >
          <span className="ab-pill">静读</span>
          <div className="ab-card-title" style={{ marginTop: 8 }}>安静时刻 · 诗篇 23</div>
          <div className="ab-muted">在忙碌之中停下来，重温牧者之诗。</div>
        </button>
      </section>

      <section className="ab-stack">
        <div className="ab-row-between">
          <h2 className="ab-card-title">精选导读</h2>
          <span className="ab-card-meta">
            {articles ? `${articles.length} 篇` : "加载中…"}
          </span>
        </div>

        {(articles ?? []).map((article) => (
          <button
            key={article.slug}
            type="button"
            className="ab-card-elevated ab-card-btn"
            onClick={() => openArticle(article.slug)}
          >
            <div className="ab-row-between" style={{ marginBottom: 6 }}>
              <span className="ab-pill">{article.category}</span>
              <span className="ab-card-meta">约 {article.readingMinutes} 分钟</span>
            </div>
            <div className="ab-card-title">{article.title}</div>
            <div className="ab-card-meta" style={{ marginBottom: 6 }}>{article.subtitle}</div>
            <div className="ab-muted">{article.summary}</div>
          </button>
        ))}
      </section>

      {siblingApps.length > 0 && (
        <section className="ab-card">
          <div style={{ marginBottom: 10 }}>
            <h2 className="ab-card-title">更多 App</h2>
            <div className="ab-card-meta">我们做的另外几样，也都围着圣经。</div>
          </div>

          <div className="ab-stack">
            {siblingApps.map((app) => {
              const primary = resolveAppPrimaryLink(app);
              return (
                <div key={app.id} className="ab-list-row">
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{app.name}</div>
                    <div className="ab-muted" style={{ fontSize: 12 }}>{app.tagline}</div>
                  </div>
                  <div className="ab-row" style={{ flexShrink: 0 }}>
                    <a
                      href={primary.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ab-btn ab-btn-primary"
                      onClick={() => void platformBridge.call("shell.haptic", { style: "light" })}
                    >
                      {primary.label}
                    </a>
                    {app.url !== primary.href && (
                      <a
                        href={app.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ab-btn"
                        onClick={() => void platformBridge.call("shell.haptic", { style: "light" })}
                      >
                        网页版
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
