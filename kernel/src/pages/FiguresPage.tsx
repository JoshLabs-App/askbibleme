import { useEffect, useMemo, useState } from "react";
import { platformBridge } from "../bridge/platform-adapter";
import { loadFiguresData, type FiguresData } from "../data/content-repo";

export interface FiguresPageProps {
  onOpenReader: (bookId: string, chapter: number) => void;
}

export default function FiguresPage({ onOpenReader }: FiguresPageProps) {
  const [data, setData] = useState<FiguresData | null>(null);
  const [selectedEra, setSelectedEra] = useState<string>("全部");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string>("");

  useEffect(() => {
    let active = true;
    void loadFiguresData().then((res) => {
      if (active) {
        setData(res);
        if (res.figures.length > 0) {
          setExpandedId((prev) => prev || res.figures[0].id);
        }
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const list = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.figures.filter((f) => {
      if (selectedEra !== "全部" && f.era !== selectedEra) return false;
      if (!q) return true;
      return (
        f.name.toLowerCase().includes(q) ||
        f.nameEn.toLowerCase().includes(q) ||
        f.role.toLowerCase().includes(q) ||
        f.summary.toLowerCase().includes(q) ||
        f.era.toLowerCase().includes(q) ||
        f.verses.some(
          (v) => v.ref.toLowerCase().includes(q) || v.note.toLowerCase().includes(q),
        )
      );
    });
  }, [data, selectedEra, query]);

  function selectEra(era: string) {
    void platformBridge.call("shell.haptic", { style: "light" });
    setSelectedEra(era);
  }

  function toggleFigure(id: string) {
    void platformBridge.call("shell.haptic", { style: "light" });
    setExpandedId((prev) => (prev === id ? "" : id));
  }

  function openVerseRef(book: string, chapter: number) {
    void platformBridge.call("shell.haptic", { style: "medium" });
    onOpenReader(book, chapter);
  }

  if (!data) {
    return <div className="ab-loading">正在整理圣经人物索引…</div>;
  }

  const eras = ["全部", ...data.eras];

  return (
    <div className="ab-stack">
      <div>
        <h1 className="ab-page-title">人物馆</h1>
        <p className="ab-page-subtitle">
          经文分类索引与简短说明，点击人物展开经文坐标并直达圣经章节。
        </p>
      </div>

      <div className="ab-card">
        <div className="ab-row" style={{ marginBottom: 10 }}>
          {eras.map((era) => (
            <button
              key={era}
              type="button"
              className={selectedEra === era ? "ab-btn ab-btn-primary" : "ab-btn"}
              onClick={() => selectEra(era)}
            >
              {era}
            </button>
          ))}
        </div>
        <input
          type="search"
          aria-label="搜索人物"
          className="ab-input"
          placeholder="搜索人物、时期或经文线索（如：大卫、旷野、约 21）…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {list.length === 0 ? (
        <div className="ab-card">
          <div className="ab-muted">当前筛选下没有匹配人物，请切换时代或清空关键词。</div>
        </div>
      ) : (
        list.map((fig) => {
          const isOpen = expandedId === fig.id;
          return (
            <section key={fig.id} className="ab-card">
              <button
                type="button"
                className="ab-btn-ghost ab-row-between"
                style={{ width: "100%", padding: 0, textAlign: "left" }}
                onClick={() => toggleFigure(fig.id)}
              >
                <div>
                  <div className="ab-card-title">
                    {fig.name}
                    {fig.nameEn ? (
                      <span className="ab-card-meta" style={{ marginLeft: 8, fontWeight: 400 }}>
                        {fig.nameEn}
                      </span>
                    ) : null}
                  </div>
                  <div className="ab-card-meta">
                    {fig.era} · {fig.role} · {fig.verses.length} 处经文索引
                  </div>
                </div>
                <span className="ab-pill">{isOpen ? "收起" : "经文索引"}</span>
              </button>

              <p style={{ margin: "10px 0 0", fontSize: 14 }}>{fig.summary}</p>

              {isOpen && (
                <div className="ab-stack" style={{ marginTop: 12 }}>
                  {fig.verses.map((v) => (
                    <button
                      key={`${fig.id}-${v.book}-${v.chapter}-${v.ref}`}
                      type="button"
                      className="ab-list-row ab-card-btn"
                      onClick={() => openVerseRef(v.book, v.chapter)}
                    >
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{v.ref}</div>
                        <div className="ab-muted" style={{ fontSize: 12 }}>{v.note}</div>
                      </div>
                      <span className="ab-pill ab-pill-ok">翻开阅读</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
