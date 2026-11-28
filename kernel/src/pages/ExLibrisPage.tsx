import { useEffect, useMemo, useState } from "react";
import { platformBridge } from "../bridge/platform-adapter";
import { loadMedalsData, type MedalItem, type MedalsData } from "../data/content-repo";

const UNLOCKED_SEALS_KEY = "askbible-exlibris-unlocked-v1";

function loadUnlockedSeals(): Set<string> {
  try {
    const raw = localStorage.getItem(UNLOCKED_SEALS_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    // Ignore
  }
  return new Set(["m01_first_play", "m02_first_lesson"]);
}

export default function ExLibrisPage() {
  const [data, setData] = useState<MedalsData | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("全部");
  const [selectedMedal, setSelectedMedal] = useState<MedalItem | null>(null);
  const [unlocked] = useState<Set<string>>(() => loadUnlockedSeals());

  useEffect(() => {
    let active = true;
    void loadMedalsData().then((res) => {
      if (active) {
        setData(res);
        if (res.medals.length > 0) {
          setSelectedMedal((prev) => prev || res.medals[0]);
        }
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const categories = useMemo(() => {
    if (!data) return ["全部"];
    return ["全部", ...Array.from(new Set(data.medals.map((m) => m.category)))];
  }, [data]);

  const visibleMedals = useMemo(() => {
    if (!data) return [];
    if (selectedCategory === "全部") return data.medals;
    return data.medals.filter((m) => m.category === selectedCategory);
  }, [data, selectedCategory]);

  function handleSelectCategory(cat: string) {
    void platformBridge.call("shell.haptic", { style: "light" });
    setSelectedCategory(cat);
  }

  function handleSelectMedal(medal: MedalItem) {
    void platformBridge.call("shell.haptic", { style: "light" });
    setSelectedMedal(medal);
  }

  if (!data) {
    return <div className="ab-loading">正在翻开藏书票图鉴…</div>;
  }

  const unlockedCount = data.medals.filter((m) => unlocked.has(m.id)).length;

  return (
    <div className="ab-stack">
      <div>
        <h1 className="ab-page-title">藏书票</h1>
        <p className="ab-page-subtitle">
          安静留存的阅读印记，不设榜单也不催促打卡，只记录话语同行的时刻。
        </p>
      </div>

      <section className="ab-card-agarwood">
        <div className="ab-row-between">
          <div>
            <div style={{ fontSize: 12, opacity: 0.78 }}>读经印记</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>
              已启封 {unlockedCount} / {data.medals.length} 枚藏书票
            </div>
          </div>
          <span className="ab-pill">安静同行</span>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
          点选下方任意藏书票，查看它的由来与启封条件。
        </div>
      </section>

      {selectedMedal && (
        <section className="ab-detail-panel">
          <div className="ab-row-between" style={{ marginBottom: 6 }}>
            <div>
              <h2 className="ab-card-title">{selectedMedal.name}</h2>
              <div className="ab-card-meta">
                {selectedMedal.nameEn} · 分类：{selectedMedal.category}
              </div>
            </div>
            <span
              className={
                unlocked.has(selectedMedal.id) ? "ab-pill ab-pill-ok" : "ab-pill"
              }
            >
              {unlocked.has(selectedMedal.id) ? "已启封" : "待启封"}
            </span>
          </div>
          <p style={{ margin: "8px 0", fontSize: 14 }}>{selectedMedal.description}</p>
          {selectedMedal.descriptionEn && (
            <div className="ab-card-meta" style={{ marginBottom: 10 }}>
              {selectedMedal.descriptionEn}
            </div>
          )}
          <div className="ab-list-row">
            <span className="ab-card-meta">启封条件</span>
            <strong style={{ fontSize: 13 }}>{selectedMedal.requirement}</strong>
          </div>
        </section>
      )}

      <div className="ab-row">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            className={selectedCategory === cat ? "ab-btn ab-btn-primary" : "ab-btn"}
            onClick={() => handleSelectCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <section className="ab-grid-2">
        {visibleMedals.map((medal) => {
          const isUnlocked = unlocked.has(medal.id);
          const isSelected = selectedMedal?.id === medal.id;
          const classes = [
            isUnlocked ? "ab-card-elevated" : "ab-card ab-seal-card--locked",
            "ab-card-btn",
            isSelected ? "ab-seal-card--selected" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={medal.id}
              type="button"
              className={classes}
              onClick={() => handleSelectMedal(medal)}
            >
              <div className="ab-row-between" style={{ marginBottom: 6, width: "100%" }}>
                <span className="ab-card-title">{medal.name}</span>
                <span className={isUnlocked ? "ab-pill ab-pill-ok" : "ab-pill"}>
                  {isUnlocked ? "已印记" : medal.category}
                </span>
              </div>
              <div className="ab-muted" style={{ fontSize: 12 }}>{medal.description}</div>
            </button>
          );
        })}
      </section>
    </div>
  );
}
