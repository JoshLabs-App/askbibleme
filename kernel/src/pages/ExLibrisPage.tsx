import { EX_LIBRIS_SEALS } from "../data/sample-content";

export default function ExLibrisPage() {
  const unlockedCount = EX_LIBRIS_SEALS.filter((s) => s.unlocked).length;
  const currentXp = 740;
  const nextThreshold = 900;
  const pct = Math.min(100, Math.round((currentXp / nextThreshold) * 100));

  return (
    <div className="ab-stack">
      <div>
        <h1 className="ab-page-title">藏书票</h1>
        <p className="ab-page-subtitle">安静留存的阅读印记，而非喧闹的排行与打卡竞赛。</p>
      </div>

      <section className="ab-card-agarwood">
        <div className="ab-row-between" style={{ marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.78 }}>当前阶段</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>第 2 阶 · 初读</div>
          </div>
          <span className="ab-pill">
            {currentXp} / {nextThreshold} XP
          </span>
        </div>
        <div className="ab-progress-track">
          <div className="ab-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
          已点亮 {unlockedCount} / {EX_LIBRIS_SEALS.length} 枚藏书票
        </div>
      </section>

      <section className="ab-grid-2">
        {EX_LIBRIS_SEALS.map((seal) => (
          <div
            key={seal.key}
            className={seal.unlocked ? "ab-card-elevated" : "ab-card"}
            style={{ opacity: seal.unlocked ? 1 : 0.72 }}
          >
            <div className="ab-row-between" style={{ marginBottom: 6 }}>
              <span className="ab-card-title">{seal.name}</span>
              <span className={seal.unlocked ? "ab-pill ab-pill-ok" : "ab-pill"}>
                {seal.unlocked ? "已印记" : "未启封"}
              </span>
            </div>
            <div className="ab-muted">{seal.condition}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
