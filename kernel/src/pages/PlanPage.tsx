import { useEffect, useMemo, useState } from "react";
import { platformBridge } from "../bridge/platform-adapter";
import {
  loadPlansData,
  parseReadingRef,
  type PlanItem,
  type PlansData,
} from "../data/content-repo";

export interface PlanPageProps {
  onOpenReader: (bookId: string, chapter: number) => void;
}

const PLAN_DONE_KEY = "askbible-plan-completed-v1";

const CATEGORY_LABELS: Record<string, string> = {
  featured: "精选计划",
  classic: "经典日课",
};

function formatCategoryLabel(cat: string): string {
  return CATEGORY_LABELS[cat] || cat;
}

function loadCompleted(): Set<string> {
  try {
    const raw = localStorage.getItem(PLAN_DONE_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    // Ignore storage errors
  }
  return new Set();
}

export default function PlanPage({ onOpenReader }: PlanPageProps) {
  const [data, setData] = useState<PlansData | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("全部");
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [completed, setCompleted] = useState<Set<string>>(() => loadCompleted());
  const [audioMsg, setAudioMsg] = useState<string>("");

  useEffect(() => {
    let active = true;
    void loadPlansData().then((res) => {
      if (active) {
        setData(res);
        if (res.plans.length > 0) {
          setSelectedPlanId((prev) => prev || res.plans[0].id);
        }
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const categories = useMemo(() => {
    if (!data) return ["全部"];
    return ["全部", ...Array.from(new Set(data.plans.map((p) => p.category)))];
  }, [data]);

  const filteredPlans = useMemo(() => {
    if (!data) return [];
    if (selectedCategory === "全部") return data.plans;
    return data.plans.filter((p) => p.category === selectedCategory);
  }, [data, selectedCategory]);

  const activePlan: PlanItem | null = useMemo(() => {
    if (!filteredPlans.length) return null;
    return filteredPlans.find((p) => p.id === selectedPlanId) ?? filteredPlans[0];
  }, [filteredPlans, selectedPlanId]);

  function toggleEntry(entryKey: string) {
    void platformBridge.call("shell.haptic", { style: "success" });
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(entryKey)) next.delete(entryKey);
      else next.add(entryKey);
      try {
        localStorage.setItem(PLAN_DONE_KEY, JSON.stringify(Array.from(next)));
      } catch {
        // Ignore
      }
      return next;
    });
  }

  async function playReadingAudio(rawReading: string) {
    const parsed = parseReadingRef(rawReading);
    await platformBridge.call("shell.haptic", { style: "medium" });
    await platformBridge.call("audio.intent", {
      stream: "scripture",
      action: "play",
      payload: {
        title: `${parsed.bookName} 第 ${parsed.chapter} 章`,
        bookId: parsed.bookId,
        chapter: parsed.chapter,
      },
      origin: "kernel-plan-audio",
    });
    setAudioMsg(`已开始朗读：${parsed.bookName} 第 ${parsed.chapter} 章`);
  }

  function openReading(rawReading: string) {
    const parsed = parseReadingRef(rawReading);
    void platformBridge.call("shell.haptic", { style: "light" });
    onOpenReader(parsed.bookId, parsed.chapter);
  }

  if (!data) {
    return <div className="ab-loading">正在展开读经计划…</div>;
  }

  return (
    <div className="ab-stack">
      <div>
        <h1 className="ab-page-title">今日读经计划</h1>
        <p className="ab-page-subtitle">没有打卡焦虑，停了再回来也不用补读，只陪你安静走过每一段。</p>
      </div>

      <div className="ab-row">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            className={selectedCategory === cat ? "ab-btn ab-btn-primary" : "ab-btn"}
            onClick={() => {
              void platformBridge.call("shell.haptic", { style: "light" });
              setSelectedCategory(cat);
            }}
          >
            {formatCategoryLabel(cat)}
          </button>
        ))}
      </div>

      <section className="ab-grid-2">
        {filteredPlans.map((plan) => {
          const isActive = activePlan?.id === plan.id;
          const doneCount = plan.sampleReadings.filter((_, idx) =>
            completed.has(`${plan.id}:${idx}`),
          ).length;
          const total = Math.max(1, plan.sampleReadings.length);
          const pct = Math.round((doneCount / total) * 100);

          return (
            <button
              key={plan.id}
              type="button"
              className={isActive ? "ab-detail-panel ab-card-btn" : "ab-card ab-card-btn"}
              onClick={() => {
                void platformBridge.call("shell.haptic", { style: "light" });
                setSelectedPlanId(plan.id);
              }}
            >
              <div className="ab-row-between" style={{ marginBottom: 6, width: "100%" }}>
                <span className="ab-pill">{formatCategoryLabel(plan.category)}</span>
                <span className="ab-card-meta">
                  {plan.days} 天 · {doneCount}/{plan.sampleReadings.length}
                </span>
              </div>
              <div className="ab-card-title">{plan.title}</div>
              <div className="ab-muted" style={{ marginBottom: 10 }}>{plan.subtitle}</div>
              <div className="ab-progress-track">
                <div className="ab-progress-fill" style={{ width: `${pct}%` }} />
              </div>
            </button>
          );
        })}
      </section>

      {activePlan && (
        <section className="ab-detail-panel ab-stack">
          <div className="ab-row-between">
            <div>
              <h2 className="ab-card-title">{activePlan.title}</h2>
              <div className="ab-card-meta">
                {activePlan.titleEn} · 共 {activePlan.days} 天
              </div>
            </div>
            {activePlan.sampleReadings[0] && (
              <button
                type="button"
                className="ab-btn ab-btn-primary"
                onClick={() => void playReadingAudio(activePlan.sampleReadings[0])}
              >
                朗读今日首段
              </button>
            )}
          </div>

          <p style={{ margin: 0, fontSize: 14 }}>{activePlan.description}</p>

          {audioMsg && <div className="ab-pill ab-pill-ok">{audioMsg}</div>}

          <div className="ab-stack">
            {activePlan.sampleReadings.map((raw, idx) => {
              const entryKey = `${activePlan.id}:${idx}`;
              const isDone = completed.has(entryKey);
              const parsed = parseReadingRef(raw);
              return (
                <div key={entryKey} className="ab-list-row">
                  <button
                    type="button"
                    className={isDone ? "ab-btn ab-btn-ok" : "ab-btn"}
                    onClick={() => toggleEntry(entryKey)}
                  >
                    {isDone ? "已读" : "记为已读"}
                  </button>

                  <button
                    type="button"
                    className="ab-btn-ghost"
                    style={{ flex: 1, textAlign: "left" }}
                    onClick={() => openReading(raw)}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      第 {idx + 1} 段 · {raw}
                    </div>
                    <div className="ab-card-meta">
                      点击翻开 {parsed.bookName} 第 {parsed.chapter} 章
                    </div>
                  </button>

                  <button
                    type="button"
                    className="ab-btn"
                    onClick={() => void playReadingAudio(raw)}
                  >
                    朗读
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
