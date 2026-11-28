import { useMemo, useState } from "react";
import { BIBLE_FIGURES } from "../data/sample-content";

export interface FiguresPageProps {
  onOpenReader: (bookId: string, chapter: number) => void;
}

export default function FiguresPage({ onOpenReader }: FiguresPageProps) {
  const [filter, setFilter] = useState<"all" | "old" | "new">("all");
  const [query, setQuery] = useState("");

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return BIBLE_FIGURES.filter((f) => {
      if (filter !== "all" && f.testament !== filter) return false;
      if (!q) return true;
      return f.name.toLowerCase().includes(q) || f.summary.toLowerCase().includes(q);
    });
  }, [filter, query]);

  return (
    <div className="ab-stack">
      <div>
        <h1 className="ab-page-title">人物馆</h1>
        <p className="ab-page-subtitle">经文分类索引与简短说明，点击直接翻到对应章节。</p>
      </div>

      <div className="ab-card">
        <div className="ab-row" style={{ marginBottom: 10 }}>
          {(["all", "old", "new"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              className={filter === tab ? "ab-btn ab-btn-primary" : "ab-btn"}
              onClick={() => setFilter(tab)}
            >
              {tab === "all" ? "全部" : tab === "old" ? "旧约" : "新约"}
            </button>
          ))}
        </div>
        <input
          type="search"
          className="ab-input"
          placeholder="搜索人物名称或时期…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {list.map((fig) => (
        <section key={fig.id} className="ab-card">
          <div className="ab-row-between" style={{ marginBottom: 4 }}>
            <h2 className="ab-card-title">{fig.name}</h2>
            <span className="ab-pill">{fig.era}</span>
          </div>
          <p style={{ margin: "0 0 12px", fontSize: 14 }}>{fig.summary}</p>
          <div className="ab-row">
            {fig.refs.map((r) => (
              <button
                key={`${fig.id}-${r.bookId}-${r.chapter}`}
                type="button"
                className="ab-btn"
                onClick={() => onOpenReader(r.bookId, r.chapter)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
