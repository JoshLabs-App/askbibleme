"use client";

import type { InfoEditionV1Generation } from "@/lib/bible/info-edition-v1-types";
import type { AIConnectionProfile } from "@/lib/ai/types";
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

type Props = {
  generations: InfoEditionV1Generation[];
  profiles: AIConnectionProfile[];
  hint?: string;
};

export function InfoEditionCompareGrid({ generations, profiles, hint }: Props) {
  if (!generations.length) return null;

  return (
    <section className="border-t border-adminLine/60 pt-3">
      {hint ? <p className="mb-2 text-[10px] leading-relaxed text-adminMuted">{hint}</p> : null}
      <div
        className="grid gap-3 overflow-x-auto pb-1"
        style={{
          gridTemplateColumns: `repeat(${generations.length}, minmax(240px, 1fr))`,
        }}
      >
        {generations.map((g) => {
          const { role, ai } = columnHead(g, profiles);
          return (
            <article
              key={generationResultKey(g)}
              className="flex min-w-0 flex-col overflow-hidden rounded-md border border-adminLine/80 bg-adminBg/40 shadow-sm"
            >
              <header className="shrink-0 border-b border-adminLine/70 bg-adminFg/[0.04] px-3 py-2">
                <p className="text-[12px] font-semibold leading-snug text-adminFg">{role}</p>
                <p className="mt-0.5 text-[10px] text-adminMuted">
                  {ai}
                  {!g.error ? <span className="tabular-nums"> · {g.charCount}字</span> : null}
                </p>
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
    </section>
  );
}
