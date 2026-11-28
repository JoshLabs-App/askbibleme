import { useEffect, useMemo, useState } from "react";
import { platformBridge } from "../bridge/platform-adapter";
import { loadPanoramaData, type PanoramaData } from "../data/content-repo";
import { SCRIPTURE_BOOKS } from "../data/books";

export interface PanoramaPageProps {
  onOpenReader: (bookId: string, chapter: number) => void;
}

export default function PanoramaPage({ onOpenReader }: PanoramaPageProps) {
  const [data, setData] = useState<PanoramaData | null>(null);
  const [expandedId, setExpandedId] = useState<string>("creation");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    void loadPanoramaData().then((res) => {
      if (active) {
        setData(res);
        if (res.acts.length > 0) {
          setExpandedId((prev) =>
            res.acts.some((a) => a.id === prev) ? prev : res.acts[0].id,
          );
        }
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !data) return [];
    return SCRIPTURE_BOOKS.filter((book) => {
      const info = data.books[book.bookId];
      return (
        book.bookName.toLowerCase().includes(q) ||
        book.bookNameEn.toLowerCase().includes(q) ||
        book.bookId.toLowerCase().includes(q) ||
        (info?.summary.toLowerCase().includes(q) ?? false) ||
        (info?.keyVerse.toLowerCase().includes(q) ?? false)
      );
    });
  }, [data, query]);

  function toggleAct(actId: string) {
    void platformBridge.call("shell.haptic", { style: "light" });
    setExpandedId((prev) => (prev === actId ? "" : actId));
  }

  function openBook(bookId: string) {
    void platformBridge.call("shell.haptic", { style: "medium" });
    onOpenReader(bookId, 1);
  }

  if (!data) {
    return <div className="ab-loading">正在展开圣经全景…</div>;
  }

  return (
    <div className="ab-stack">
      <div>
        <h1 className="ab-page-title">圣经全景</h1>
        <p className="ab-page-subtitle">
          从创造到新天新地，用六幕看清整本 66 卷圣经的救赎故事；点选任意书卷直接翻开第 1 章。
        </p>
      </div>

      <div className="ab-card">
        <input
          type="search"
          aria-label="检索 66 卷书"
          className="ab-input"
          placeholder="检索书卷名称、金句或主题（全 66 卷）…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {query.trim() ? (
        <section className="ab-card">
          <div className="ab-row-between" style={{ marginBottom: 10 }}>
            <h2 className="ab-card-title">匹配书卷</h2>
            <span className="ab-pill">{searchResults.length} 卷</span>
          </div>
          {searchResults.length === 0 ? (
            <div className="ab-muted">没有找到匹配的书卷，请尝试书名或简写（如：约翰、诗篇、ROM）。</div>
          ) : (
            <div className="ab-book-grid">
              {searchResults.map((b) => {
                const info = data.books[b.bookId];
                return (
                  <button
                    key={b.bookId}
                    type="button"
                    className="ab-book-card"
                    onClick={() => openBook(b.bookId)}
                  >
                    <div className="ab-row-between" style={{ width: "100%" }}>
                      <strong>{info?.title || b.bookName}</strong>
                      <span className="ab-card-meta">{b.bookId} · 第 1 章</span>
                    </div>
                    {info?.summary && <div className="ab-muted">{info.summary}</div>}
                    {info?.keyVerse && <div className="ab-key-verse">{info.keyVerse}</div>}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        data.acts.map((act) => {
          const isOpen = expandedId === act.id;
          return (
            <section key={act.id} className="ab-card">
              <button
                type="button"
                className="ab-btn-ghost ab-row-between"
                style={{ width: "100%", padding: 0, textAlign: "left" }}
                onClick={() => toggleAct(act.id)}
              >
                <div>
                  <div className="ab-card-title">{act.title}</div>
                  <div className="ab-card-meta">
                    {act.subtitle} · {act.books.length} 卷
                  </div>
                </div>
                <span className="ab-pill">{isOpen ? "收起" : "展开"}</span>
              </button>

              {isOpen && (
                <div className="ab-stack" style={{ marginTop: 12 }}>
                  <p style={{ margin: 0, fontSize: 14 }}>{act.summary}</p>
                  <div className="ab-book-grid">
                    {act.books.map((bookId) => {
                      const info = data.books[bookId];
                      return (
                        <button
                          key={`${act.id}-${bookId}`}
                          type="button"
                          className="ab-book-card"
                          onClick={() => openBook(bookId)}
                        >
                          <div className="ab-row-between" style={{ width: "100%" }}>
                            <strong style={{ fontSize: 14 }}>{info?.title || bookId}</strong>
                            <span className="ab-card-meta">{bookId} · 读第 1 章</span>
                          </div>
                          {info?.summary && (
                            <div className="ab-muted" style={{ fontSize: 12 }}>
                              {info.summary}
                            </div>
                          )}
                          {info?.keyVerse && <div className="ab-key-verse">{info.keyVerse}</div>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
