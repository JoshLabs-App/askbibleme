"use client";

import { useCallback, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { InfoEditionCompareMarkdown } from "@/components/admin/InfoEditionCompareMarkdown";
import type { AIConnectionProfile } from "@/lib/ai/types";
import { profileCompareDisplay } from "@/lib/ai/profile-display";
import type { InfoEditionV1Generation } from "@/lib/bible/info-edition-v1-types";

export type InfoEditionV4ResultPair = {
  compile: InfoEditionV1Generation;
  revise: InfoEditionV1Generation | null;
};

function profileLabel(g: InfoEditionV1Generation, profiles: AIConnectionProfile[]): string {
  const prof = profiles.find((p) => p.id === g.profileId);
  const display = prof ? profileCompareDisplay(prof, profiles) : null;
  if (display) return [display.chip, display.sizeGb].filter(Boolean).join(" · ");
  return g.profileName.trim() || g.profileId.slice(0, 8);
}

type Props = {
  pairs: InfoEditionV4ResultPair[];
  profiles: AIConnectionProfile[];
  compileColumnTitle: string;
  reviseColumnTitle: string;
  revisePendingLabel: string;
};

export function InfoEditionV4PairCompareGrid({
  pairs,
  profiles,
  compileColumnTitle,
  reviseColumnTitle,
  revisePendingLabel,
}: Props) {
  const { t } = useLocale();
  const ie = useCallback((key: string) => t(`admin.infoEditionV1.${key}`), [t]);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

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

  if (!pairs.length) return null;

  return (
    <section className="border-t border-adminLine/60 pt-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {copyMsg ? <span className="text-[10px] text-adminMuted">{copyMsg}</span> : null}
      </div>
      <div className="space-y-4">
        {pairs.map(({ compile, revise }) => {
          const ai = profileLabel(compile, profiles);
          const key = `${compile.generationRoleId}:${compile.profileId}`;
          return (
            <div key={key}>
              <p className="mb-1.5 text-[10px] font-medium text-adminMuted">{ai}</p>
              <div className="grid gap-3 md:grid-cols-2">
                <article className="flex min-w-0 flex-col overflow-hidden rounded-md border border-adminLine/80 bg-adminBg/40">
                  <header className="flex items-center justify-between gap-2 border-b border-adminLine/70 bg-adminFg/[0.04] px-3 py-2">
                    <div>
                      <p className="text-[12px] font-semibold text-adminFg">{compileColumnTitle}</p>
                      <p className="text-[10px] text-adminMuted tabular-nums">
                        {compile.generationRoleLabel} · {compile.charCount}字
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void copyText(compile.text)}
                      className="shrink-0 rounded border border-adminLine/70 px-1.5 py-0.5 text-[9px] text-adminMuted hover:bg-adminFg/[0.06]"
                    >
                      {ie("compareCopyOne")}
                    </button>
                  </header>
                  <div className="max-h-[min(52vh,520px)] min-h-[12rem] overflow-y-auto px-3 py-2.5">
                    {compile.error ? (
                      <p className="text-[11px] text-red-700/90 dark:text-red-300/90">{compile.error}</p>
                    ) : (
                      <InfoEditionCompareMarkdown content={compile.text} />
                    )}
                  </div>
                </article>
                <article className="flex min-w-0 flex-col overflow-hidden rounded-md border border-emerald-800/25 bg-emerald-50/30 dark:border-emerald-400/20 dark:bg-emerald-950/20">
                  <header className="flex items-center justify-between gap-2 border-b border-emerald-900/15 px-3 py-2 dark:border-emerald-400/15">
                    <div>
                      <p className="text-[12px] font-semibold text-adminFg">{reviseColumnTitle}</p>
                      {revise && !revise.error ? (
                        <p className="text-[10px] text-adminMuted tabular-nums">
                          {revise.generationRoleLabel} · {revise.charCount}字
                        </p>
                      ) : null}
                    </div>
                    {revise?.text && !revise.error ? (
                      <button
                        type="button"
                        onClick={() => void copyText(revise.text)}
                        className="shrink-0 rounded border border-adminLine/70 px-1.5 py-0.5 text-[9px] text-adminMuted hover:bg-adminFg/[0.06]"
                      >
                        {ie("compareCopyOne")}
                      </button>
                    ) : null}
                  </header>
                  <div className="max-h-[min(52vh,520px)] min-h-[12rem] overflow-y-auto px-3 py-2.5">
                    {!revise ? (
                      <p className="text-[11px] text-adminMuted">{revisePendingLabel}</p>
                    ) : revise.error ? (
                      <p className="text-[11px] text-red-700/90 dark:text-red-300/90">{revise.error}</p>
                    ) : (
                      <InfoEditionCompareMarkdown content={revise.text} />
                    )}
                  </div>
                </article>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
