"use client";

import Link from "next/link";
import type { StudioDocId } from "@/lib/studio-config";
import { studioDocCharCount } from "@/lib/studio-doc-history";
import {
  formatStudioDocOrdinal,
  resolveStudioDocRow,
  type StudioExtraDocMeta,
} from "@/lib/studio-doc-manifest";
import { SITE_METADATA_DEFAULT_TITLE } from "@/lib/site-metadata-defaults";

type StudioContextSidebarProps = {
  embedInAdmin: boolean;
  leftColPx: number;
  saveMessage: string | null;
  docOrder: string[];
  extraDocMeta: Record<string, StudioExtraDocMeta>;
  activeId: StudioDocId;
  documents: Record<string, string>;
  onSelectDoc: (id: StudioDocId) => void;
  onAddDocument: () => void;
  assistantHint: string;
  aiError: string | null;
};

export function StudioContextSidebar({
  embedInAdmin,
  leftColPx,
  saveMessage,
  docOrder,
  extraDocMeta,
  activeId,
  documents,
  onSelectDoc,
  onAddDocument,
  assistantHint,
  aiError,
}: StudioContextSidebarProps) {
  return (
    <aside
      className="flex min-h-0 shrink-0 flex-col border-r border-border bg-surface/60 py-2 pl-2 pr-1"
      style={{ width: leftColPx, minWidth: Math.min(leftColPx, 220) }}
    >
      <div className="shrink-0 px-1 pb-3">
        <Link
          href={embedInAdmin ? "/admin" : "/"}
          className="text-[11px] text-muted transition hover:text-ink"
        >
          {embedInAdmin ? "← 管理概览" : "← 返回"}
        </Link>
        <div className="mt-1.5 text-[12px] font-medium leading-tight tracking-tight text-ink">
          {`${SITE_METADATA_DEFAULT_TITLE} Studio`}
        </div>
        <p className="mt-0.5 text-[9px] leading-snug text-muted/90">
          产品大脑 · 内部
        </p>
        {saveMessage ? (
          <p className="mt-1.5 text-[9px] leading-snug text-muted">
            {saveMessage}
          </p>
        ) : null}
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-0.5">
        {docOrder.map((id) => {
          const doc = resolveStudioDocRow(id, extraDocMeta);
          if (!doc) return null;
          const active = id === activeId;
          const len = studioDocCharCount(documents[id] ?? "");
          const ord = formatStudioDocOrdinal(docOrder.indexOf(id) + 1);
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectDoc(id)}
              title={`${ord} · ${doc.labelEn} · ${doc.labelZh} — ${doc.remark}`}
              className={`rounded-md px-2 py-1.5 text-left transition ${
                active
                  ? "bg-canvas text-ink ring-1 ring-border"
                  : "text-muted hover:bg-canvas/70 hover:text-ink"
              }`}
            >
              <div className="flex min-w-0 items-baseline justify-between gap-2">
                <div className="min-w-0 flex-1 truncate leading-snug">
                  <span className="select-none font-mono text-[10px] tabular-nums text-muted/90">
                    {ord}
                  </span>
                  <span className="text-[11px] font-semibold tracking-tight text-ink">
                    {" "}
                    {doc.labelEn}
                  </span>
                  <span className="text-[10px] font-normal text-muted/75">
                    {" "}
                    · {doc.labelZh}
                  </span>
                </div>
                <span
                  className="shrink-0 font-mono text-[9px] tabular-nums text-muted/70"
                  aria-label={`${len} 字符`}
                >
                  {len}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 border-l border-border/60 pl-1.5 text-[9px] leading-snug text-muted/90">
                {doc.remark}
              </p>
            </button>
          );
        })}
      </nav>
      <button
        type="button"
        onClick={onAddDocument}
        className="mt-1.5 shrink-0 rounded-md border border-dashed border-border/80 bg-canvas/50 px-2 py-1.5 text-left text-[10px] font-medium text-muted transition hover:border-sand hover:text-ink"
      >
        + 新建文档
      </button>
      {(assistantHint || aiError) && (
        <div
          className="mt-2 shrink-0 px-1 pt-2 text-[10px] leading-snug"
          role="status"
        >
          {assistantHint ? (
            <p className="text-muted">{assistantHint}</p>
          ) : null}
          {aiError ? (
            <p className="mt-1 text-ink/90">错误：{aiError}</p>
          ) : null}
        </div>
      )}
    </aside>
  );
}
