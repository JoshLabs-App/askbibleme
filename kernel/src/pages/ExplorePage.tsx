export interface ExplorePageProps {
  onNavigate: (path: string) => void;
  onOpenReader: (bookId: string, chapter: number) => void;
}

export default function ExplorePage({ onNavigate, onOpenReader }: ExplorePageProps) {
  return (
    <div className="ab-stack">
      <div>
        <h1 className="ab-page-title">书房与探索</h1>
        <p className="ab-page-subtitle">安静进入圣经的线索、人物与历史信条。</p>
      </div>

      <section className="ab-grid-2">
        <button
          type="button"
          className="ab-card"
          style={{ textAlign: "left", cursor: "pointer" }}
          onClick={() => onNavigate("/figures")}
        >
          <span className="ab-pill">人物馆</span>
          <div className="ab-card-title" style={{ marginTop: 8 }}>圣经人物索引</div>
          <div className="ab-muted">按旧约与新约脉络直达人物所在经文，不堆砌百科。</div>
        </button>

        <button
          type="button"
          className="ab-card"
          style={{ textAlign: "left", cursor: "pointer" }}
          onClick={() => onNavigate("/ex-libris")}
        >
          <span className="ab-pill ab-pill-ok">藏书票</span>
          <div className="ab-card-title" style={{ marginTop: 8 }}>读经印记与徽章</div>
          <div className="ab-muted">记录翻开经卷与安静同行的时间刻痕。</div>
        </button>

        <button
          type="button"
          className="ab-card"
          style={{ textAlign: "left", cursor: "pointer" }}
          onClick={() => onNavigate("/panorama")}
        >
          <span className="ab-pill">全景</span>
          <div className="ab-card-title" style={{ marginTop: 8 }}>六幕救赎历史</div>
          <div className="ab-muted">从创造到新天新地的完整叙事脉络。</div>
        </button>

        <button
          type="button"
          className="ab-card"
          style={{ textAlign: "left", cursor: "pointer" }}
          onClick={() => onOpenReader("PSA", 23)}
        >
          <span className="ab-pill">导读</span>
          <div className="ab-card-title" style={{ marginTop: 8 }}>安静时刻 · 诗篇 23</div>
          <div className="ab-muted">在忙碌之中停下来，重温牧者之诗。</div>
        </button>
      </section>
    </div>
  );
}
