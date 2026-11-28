import { useState } from "react";
import { PANORAMA_ACTS } from "../data/sample-content";

export interface PanoramaPageProps {
  onOpenReader: (bookId: string, chapter: number) => void;
}

export default function PanoramaPage({ onOpenReader }: PanoramaPageProps) {
  const [expandedId, setExpandedId] = useState<string>("creation");

  return (
    <div className="ab-stack">
      <div>
        <h1 className="ab-page-title">圣经全景</h1>
        <p className="ab-page-subtitle">从创造到新天新地，用六幕看清整本圣经的故事。</p>
      </div>

      {PANORAMA_ACTS.map((act) => {
        const isOpen = expandedId === act.id;
        return (
          <section key={act.id} className="ab-card">
            <button
              type="button"
              className="ab-btn-ghost ab-row-between"
              style={{ width: "100%", padding: 0, textAlign: "left" }}
              onClick={() => setExpandedId(isOpen ? "" : act.id)}
            >
              <div>
                <div className="ab-card-title">{act.title}</div>
                <div className="ab-card-meta">{act.subtitle}</div>
              </div>
              <span className="ab-pill">{isOpen ? "收起" : "展开"}</span>
            </button>

            {isOpen && (
              <div style={{ marginTop: 12 }}>
                <p style={{ margin: "0 0 12px", fontSize: 14 }}>{act.summary}</p>
                <div className="ab-row">
                  {act.readings.map((r) => (
                    <button
                      key={`${r.bookId}-${r.chapter}`}
                      type="button"
                      className="ab-btn ab-btn-primary"
                      onClick={() => onOpenReader(r.bookId, r.chapter)}
                    >
                      读 {r.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
