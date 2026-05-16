"use client";

import { useCallback, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { InfoEditionV1Generation } from "@/lib/bible/info-edition-v1-types";
import type { AIConnectionProfile } from "@/lib/ai/types";
import { normalizeInfoEditionCompareMarkdown } from "@/lib/bible/info-edition-v1-format";
import { profileCompareDisplay } from "@/lib/ai/profile-display";
import { InfoEditionCompareMarkdown } from "@/components/admin/InfoEditionCompareMarkdown";

function generationResultKey(g: InfoEditionV1Generation): string {
  return `${g.generationRoleId}:${g.profileId}`;
}

function columnHead(g: InfoEditionV1Generation, profiles: AIConnectionProfile[]) {
  const prof = profiles.find((p) => p.id === g.profileId);
  const display = prof ? profileCompareDisplay(prof, profiles) : null;
  const ai = display
    ? [display.chip, display.sizeGb].filter(Boolean).join(" · ")
    : g.profileName.trim() || g.profileId.slice(0, 8);
  const role = g.generationRoleLabel?.trim() || g.generationRoleId.slice(0, 10);
  return { role, ai };
}

function generationPlainText(g: InfoEditionV1Generation, role: string, ai: string): string {
  const head = `【${role} · ${ai}】`;
  if (g.error) return `${head}\n${g.error}`;
  const body = normalizeInfoEditionCompareMarkdown(g.text);
  return body ? `${head}\n${body}` : head;
}

type Props = {
  generations: InfoEditionV1Generation[];
  profiles: AIConnectionProfile[];
  hint?: string;
};

export function InfoEditionCompareGrid({ generations, profiles, hint }: Props) {
  const { t } = useLocale();
  const ie = useCallback((key: string) => t(`admin.infoEditionV1.${key}`), [t]);
  const copyRootRef = useRef<HTMLDivElement>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  const allPlainText = generations
    .map((g) => {
      const { role, ai } = columnHead(g, profiles);
      return generationPlainText(g, role, ai);
    })
    .join("\n\n———\n\n");

  const selectAllText = useCallback(() => {
    const root = copyRootRef.current;
    if (!root) return;
    const range = document.createRange();
    range.selectNodeContents(root);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    setCopyMsg(null);
  }, []);

  const copyText = useCallback(
    async (text: string) => {
      setCopyMsg(null);
      try {
        await navigator.clipboard.writeText(text);
        setCopyMsg(ie("compareCopied"));
        window.setTimeout(() => setCopyMsg(null), 2000);
      } catch {
        setCopyMsg(ie("compareCopyFailed"));
      }
    },
    [ie],
  );

  if (!generations.length) return null;

  const actionClass =
    "shrink-0 rounded border border-adminLine/80 px-2 py-0.5 text-[10px] font-medium text-adminFg transition hover:bg-adminFg/[0.06]";

  return (
    <section className="border-t border-adminLine/60 pt-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {hint ? <p className="min-w-0 flex-1 text-[10px] leading-relaxed text-adminMuted">{hint}</p> : null}
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <button type="button" onClick={selectAllText} className={actionClass}>
            {ie("compareSelectAll")}
          </button>
          <button type="button" onClick={() => void copyText(allPlainText)} className={actionClass}>
            {ie("compareCopyAll")}
          </button>
          {copyMsg ? <span className="text-[10px] text-adminMuted">{copyMsg}</span> : null}
        </div>
      </div>

      <div ref={copyRootRef} className="info-edition-compare-copy select-text cursor-text">
        <div
          className="grid gap-3 overflow-x-auto pb-1"
          style={{
            gridTemplateColumns: `repeat(${generations.length}, minmax(240px, 1fr))`,
          }}
        >
          {generations.map((g) => {
            const { role, ai } = columnHead(g, profiles);
            const plain = generationPlainText(g, role, ai);
            return (
              <article
                key={generationResultKey(g)}
                className="flex min-w-0 flex-col overflow-hidden rounded-md border border-adminLine/80 bg-adminBg/40 shadow-sm"
              >
                <header className="flex shrink-0 items-start justify-between gap-2 border-b border-adminLine/70 bg-adminFg/[0.04] px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold leading-snug text-adminFg">{role}</p>
                    <p className="mt-0.5 text-[10px] text-adminMuted">
                      {ai}
                      {!g.error ? <span className="tabular-nums"> · {g.charCount}字</span> : null}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyText(plain)}
                    className="shrink-0 rounded border border-adminLine/70 px-1.5 py-0.5 text-[9px] text-adminMuted transition hover:bg-adminFg/[0.06] hover:text-adminFg"
                    title={ie("compareCopyOne")}
                  >
                    {ie("compareCopyOne")}
                  </button>
                </header>
                <div className="min-h-[8rem] flex-1 overflow-y-auto px-3 py-2.5">
                  {g.error ? (
                    <p className="text-[11px] leading-relaxed text-red-700/90 dark:text-red-300/90">{g.error}</p>
                  ) : (
                    <InfoEditionCompareMarkdown content={g.text} />
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
