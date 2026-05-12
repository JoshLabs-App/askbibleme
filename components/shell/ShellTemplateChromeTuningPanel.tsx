"use client";

import type { ReactNode } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  type ShellTemplateChromeTune,
} from "@/lib/shell/template-preview-themes";

type Props = {
  value: ShellTemplateChromeTune;
  onChange: (next: ShellTemplateChromeTune) => void;
  onSave: () => void;
  /** 恢复内置默认并写入本机存储，首页压边等会同步 */
  onResetToDefaults: () => void;
  /** 保存成功后短暂为 true，用于提示 */
  saveFlash?: boolean;
};

function Row({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="shrink-0 text-[11px] font-medium text-muted">{label}</span>
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-[min(100%,20rem)] sm:justify-end">{children}</div>
    </div>
  );
}

export function ShellTemplateChromeTuningPanel({
  value,
  onChange,
  onSave,
  onResetToDefaults,
  saveFlash = false,
}: Props) {
  const { t } = useLocale();
  const patch = (p: Partial<ShellTemplateChromeTune>) => onChange({ ...value, ...p });

  return (
    <section className="space-y-2 rounded-xl border border-border/30 bg-surface/50 px-3 py-3 sm:px-4">
      <div className="space-y-0.5">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
          {t("shellTemplatePage.chromeTuningHeading")}
        </h2>
        <p className="text-[11px] text-muted">{t("shellTemplatePage.chromeTuningHint")}</p>
      </div>

      <div className="mt-3 space-y-3 border-t border-border/30 pt-3">
        <p className="text-[11px] font-medium text-ink">{t("shellTemplatePage.chromeTuningGroupTop")}</p>
        <div className="space-y-2.5">
          <Row label={t("shellTemplatePage.chromeTuningTopHeightRem")}>
            <input
              type="range"
              className="h-1.5 w-full max-w-[14rem] accent-sand"
              min={2}
              max={18}
              step={0.25}
              value={value.topHeightRem}
              onChange={(e) => patch({ topHeightRem: Number(e.target.value) })}
            />
            <span className="w-12 shrink-0 text-right font-mono text-[11px] text-ink">{value.topHeightRem.toFixed(2)}</span>
          </Row>
          <Row label={t("shellTemplatePage.chromeTuningTopHeightMinPx")}>
            <input
              type="range"
              className="h-1.5 w-full max-w-[14rem] accent-sand"
              min={48}
              max={200}
              step={1}
              value={value.topHeightMinPx}
              onChange={(e) => patch({ topHeightMinPx: Number(e.target.value) })}
            />
            <span className="w-12 shrink-0 text-right font-mono text-[11px] text-ink">{value.topHeightMinPx}px</span>
          </Row>
          <Row label={t("shellTemplatePage.chromeTuningTopSolidPct")}>
            <input
              type="range"
              className="h-1.5 w-full max-w-[14rem] accent-sand"
              min={0.25}
              max={22}
              step={0.25}
              value={value.topSolidEndPct}
              onChange={(e) => patch({ topSolidEndPct: Number(e.target.value) })}
            />
            <span className="w-12 shrink-0 text-right font-mono text-[11px] text-ink">{value.topSolidEndPct}%</span>
          </Row>
          <Row label={t("shellTemplatePage.chromeTuningTopStop1")}>
            <input
              type="range"
              className="h-1.5 w-full max-w-[14rem] accent-sand"
              min={value.topSolidEndPct + 0.5}
              max={94}
              step={0.5}
              value={value.topStop1Pct}
              onChange={(e) => patch({ topStop1Pct: Number(e.target.value) })}
            />
            <span className="w-14 shrink-0 text-right font-mono text-[10px] text-ink">
              {value.topStop1Pct}% · α{value.topStop1Alpha.toFixed(2)}
            </span>
          </Row>
          <Row label={t("shellTemplatePage.chromeTuningTopStop1Alpha")}>
            <input
              type="range"
              className="h-1.5 w-full max-w-[14rem] accent-sand"
              min={0}
              max={1}
              step={0.02}
              value={value.topStop1Alpha}
              onChange={(e) => patch({ topStop1Alpha: Number(e.target.value) })}
            />
            <span className="w-12 shrink-0 text-right font-mono text-[11px] text-ink">{value.topStop1Alpha.toFixed(2)}</span>
          </Row>
          <Row label={t("shellTemplatePage.chromeTuningTopStop2")}>
            <input
              type="range"
              className="h-1.5 w-full max-w-[14rem] accent-sand"
              min={value.topStop1Pct + 0.5}
              max={99.5}
              step={0.5}
              value={value.topStop2Pct}
              onChange={(e) => patch({ topStop2Pct: Number(e.target.value) })}
            />
            <span className="w-14 shrink-0 text-right font-mono text-[10px] text-ink">
              {value.topStop2Pct}% · α{value.topStop2Alpha.toFixed(2)}
            </span>
          </Row>
          <Row label={t("shellTemplatePage.chromeTuningTopStop2Alpha")}>
            <input
              type="range"
              className="h-1.5 w-full max-w-[14rem] accent-sand"
              min={0}
              max={1}
              step={0.02}
              value={value.topStop2Alpha}
              onChange={(e) => patch({ topStop2Alpha: Number(e.target.value) })}
            />
            <span className="w-12 shrink-0 text-right font-mono text-[11px] text-ink">{value.topStop2Alpha.toFixed(2)}</span>
          </Row>
        </div>
      </div>

      <div className="space-y-3 border-t border-border/30 pt-3">
        <p className="text-[11px] font-medium text-ink">{t("shellTemplatePage.chromeTuningGroupBottom")}</p>
        <div className="space-y-2.5">
          <Row label={t("shellTemplatePage.chromeTuningBottomHeightRem")}>
            <input
              type="range"
              className="h-1.5 w-full max-w-[14rem] accent-sand"
              min={4}
              max={28}
              step={0.25}
              value={value.bottomHeightRem}
              onChange={(e) => patch({ bottomHeightRem: Number(e.target.value) })}
            />
            <span className="w-12 shrink-0 text-right font-mono text-[11px] text-ink">{value.bottomHeightRem.toFixed(2)}</span>
          </Row>
          <Row label={t("shellTemplatePage.chromeTuningBottomHeightMinPx")}>
            <input
              type="range"
              className="h-1.5 w-full max-w-[14rem] accent-sand"
              min={120}
              max={360}
              step={4}
              value={value.bottomHeightMinPx}
              onChange={(e) => patch({ bottomHeightMinPx: Number(e.target.value) })}
            />
            <span className="w-12 shrink-0 text-right font-mono text-[11px] text-ink">{value.bottomHeightMinPx}px</span>
          </Row>
          <Row label={t("shellTemplatePage.chromeTuningBottomSolidPct")}>
            <input
              type="range"
              className="h-1.5 w-full max-w-[14rem] accent-sand"
              min={0.25}
              max={24}
              step={0.25}
              value={value.bottomSolidEndPct}
              onChange={(e) => patch({ bottomSolidEndPct: Number(e.target.value) })}
            />
            <span className="w-12 shrink-0 text-right font-mono text-[11px] text-ink">{value.bottomSolidEndPct}%</span>
          </Row>
          <Row label={t("shellTemplatePage.chromeTuningBottomStop1")}>
            <input
              type="range"
              className="h-1.5 w-full max-w-[14rem] accent-sand"
              min={value.bottomSolidEndPct + 0.5}
              max={94}
              step={0.5}
              value={value.bottomStop1Pct}
              onChange={(e) => patch({ bottomStop1Pct: Number(e.target.value) })}
            />
            <span className="w-14 shrink-0 text-right font-mono text-[10px] text-ink">
              {value.bottomStop1Pct}% · α{value.bottomStop1Alpha.toFixed(2)}
            </span>
          </Row>
          <Row label={t("shellTemplatePage.chromeTuningBottomStop1Alpha")}>
            <input
              type="range"
              className="h-1.5 w-full max-w-[14rem] accent-sand"
              min={0}
              max={1}
              step={0.02}
              value={value.bottomStop1Alpha}
              onChange={(e) => patch({ bottomStop1Alpha: Number(e.target.value) })}
            />
            <span className="w-12 shrink-0 text-right font-mono text-[11px] text-ink">{value.bottomStop1Alpha.toFixed(2)}</span>
          </Row>
          <Row label={t("shellTemplatePage.chromeTuningBottomStop2")}>
            <input
              type="range"
              className="h-1.5 w-full max-w-[14rem] accent-sand"
              min={value.bottomStop1Pct + 0.5}
              max={99.5}
              step={0.5}
              value={value.bottomStop2Pct}
              onChange={(e) => patch({ bottomStop2Pct: Number(e.target.value) })}
            />
            <span className="w-14 shrink-0 text-right font-mono text-[10px] text-ink">
              {value.bottomStop2Pct}% · α{value.bottomStop2Alpha.toFixed(2)}
            </span>
          </Row>
          <Row label={t("shellTemplatePage.chromeTuningBottomStop2Alpha")}>
            <input
              type="range"
              className="h-1.5 w-full max-w-[14rem] accent-sand"
              min={0}
              max={1}
              step={0.02}
              value={value.bottomStop2Alpha}
              onChange={(e) => patch({ bottomStop2Alpha: Number(e.target.value) })}
            />
            <span className="w-12 shrink-0 text-right font-mono text-[11px] text-ink">{value.bottomStop2Alpha.toFixed(2)}</span>
          </Row>
        </div>
      </div>

      <div className="border-t border-border/30 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-border/50 bg-sand/25 px-3 py-1.5 text-[12px] font-medium text-ink transition hover:bg-sand/35 active:scale-[0.99]"
            onClick={() => onSave()}
          >
            {t("shellTemplatePage.chromeTuningSave")}
          </button>
          <button
            type="button"
            className="rounded-lg border border-border/40 bg-canvas/30 px-3 py-1.5 text-[12px] font-medium text-ink transition hover:bg-canvas/50 active:scale-[0.99]"
            onClick={() => onResetToDefaults()}
          >
            {t("shellTemplatePage.chromeTuningReset")}
          </button>
        </div>
        {saveFlash ? (
          <p className="mt-2 text-[11px] font-medium text-sand" role="status">
            {t("shellTemplatePage.chromeTuningSaved")}
          </p>
        ) : null}
      </div>
    </section>
  );
}
