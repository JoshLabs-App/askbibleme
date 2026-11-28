import { useState } from "react";
import { platformBridge } from "../bridge/platform-adapter";
import { READING_PLANS } from "../data/sample-content";

export interface PlanPageProps {
  onOpenReader: (bookId: string, chapter: number) => void;
}

const PLAN_DONE_KEY = "askbible-plan-completed-v1";

function loadCompleted(): Set<string> {
  try {
    const raw = localStorage.getItem(PLAN_DONE_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    // Ignore
  }
  return new Set();
}

export default function PlanPage({ onOpenReader }: PlanPageProps) {
  const [completed, setCompleted] = useState<Set<string>>(() => loadCompleted());

  function toggleEntry(id: string) {
    void platformBridge.call("shell.haptic", { style: "success" });
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(PLAN_DONE_KEY, JSON.stringify(Array.from(next)));
      } catch {
        // Ignore
      }
      return next;
    });
  }

  return (
    <div className="ab-stack">
      <div>
        <h1 className="ab-page-title">今日读经计划</h1>
        <p className="ab-page-subtitle">没有打卡焦虑，只为陪伴每天安静阅读的一小步。</p>
      </div>

      {READING_PLANS.map((plan) => {
        const doneCount = plan.todayEntries.filter((e) => completed.has(e.id)).length;
        const pct = Math.round((doneCount / plan.todayEntries.length) * 100);
        return (
          <section key={plan.id} className="ab-card">
            <div className="ab-row-between" style={{ marginBottom: 6 }}>
              <h2 className="ab-card-title">{plan.title}</h2>
              <span className="ab-pill ab-pill-ok">{doneCount}/{plan.todayEntries.length}</span>
            </div>
            <p className="ab-muted" style={{ margin: "0 0 10px" }}>{plan.summary}</p>
            <div className="ab-progress-track" style={{ marginBottom: 14 }}>
              <div className="ab-progress-fill" style={{ width: `${pct}%` }} />
            </div>

            <div className="ab-stack">
              {plan.todayEntries.map((entry) => {
                const isDone = completed.has(entry.id);
                return (
                  <div key={entry.id} className="ab-row-between">
                    <button
                      type="button"
                      className={isDone ? "ab-btn ab-btn-ok" : "ab-btn"}
                      onClick={() => toggleEntry(entry.id)}
                    >
                      {isDone ? "已完成" : "记为已读"}
                    </button>
                    <button
                      type="button"
                      className="ab-btn-ghost"
                      style={{ flex: 1, textAlign: "left" }}
                      onClick={() => onOpenReader(entry.bookId, entry.chapter)}
                    >
                      {entry.label}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
