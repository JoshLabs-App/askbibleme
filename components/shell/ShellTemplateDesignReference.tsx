"use client";

import type { RefObject } from "react";
import { useLayoutEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useAppSkin } from "@/components/theme/AppSkinProvider";
import { DEFAULT_BRAND_COLOR_ROWS, TAILWIND_SANS_STACK } from "@/lib/shell/default-brand-fallbacks";
import { ShellTemplateThemeStrip } from "@/components/shell/ShellTemplateThemeStrip";
import type { ShellTemplatePreviewThemeId } from "@/lib/shell/template-preview-themes";
import { SITE_METADATA_DEFAULT_TITLE, SITE_METADATA_TITLE_TEMPLATE } from "@/lib/site-metadata-defaults";

type ColorRowLive = (typeof DEFAULT_BRAND_COLOR_ROWS)[number] & {
  cssResolved: string;
  rgbResolved: string;
};

type TypoLive = {
  fontFamily: string;
  fontSize: string;
  lineHeight: string;
  fontWeight: string;
};

type Props = {
  /** 承载 `--brand-*` 预览的根节点；颜色表从此节点读取计算样式 */
  sampleRootRef: RefObject<HTMLDivElement | null>;
  previewThemeId: ShellTemplatePreviewThemeId;
  onPreviewThemeId: (id: ShellTemplatePreviewThemeId) => void;
  /** 为 true 时隐藏四条预览主题卡（仅 `/template` 用）；其余区块仍读站点真实 CSS 变量 */
  hidePreviewThemePicker?: boolean;
};

function rgbTripletToCss(rgb: string): string {
  const t = rgb.trim();
  if (/^\d/.test(t)) return `rgb(${t})`;
  return "";
}

function Swatch({ cssVar, rgbVar }: { cssVar: string; rgbVar: string }) {
  const fromRgb = rgbTripletToCss(rgbVar);
  const bg = cssVar.trim() || fromRgb || "transparent";
  return (
    <span
      className="inline-block h-5 w-5 shrink-0 rounded-sm shadow-sm"
      style={{ backgroundColor: bg }}
      aria-hidden
    />
  );
}

export function ShellTemplateDesignReference({
  sampleRootRef,
  previewThemeId,
  onPreviewThemeId,
  hidePreviewThemePicker = false,
}: Props) {
  const { t } = useLocale();
  const { skin } = useAppSkin();
  const pathname = usePathname() ?? "";
  const [colorRows, setColorRows] = useState<ColorRowLive[]>(() =>
    DEFAULT_BRAND_COLOR_ROWS.map((r) => ({ ...r, cssResolved: "—", rgbResolved: "—" })),
  );
  const [typo, setTypo] = useState<TypoLive>({
    fontFamily: "—",
    fontSize: "—",
    lineHeight: "—",
    fontWeight: "—",
  });
  const [docTitle, setDocTitle] = useState("—");

  const sansStackText = useMemo(() => TAILWIND_SANS_STACK.join(", "), []);

  useLayoutEffect(() => {
    function sample() {
      const colorEl = sampleRootRef.current ?? document.body;
      const cs = getComputedStyle(colorEl);
      setColorRows(
        DEFAULT_BRAND_COLOR_ROWS.map((r) => ({
          ...r,
          cssResolved: cs.getPropertyValue(r.cssVar).trim() || "—",
          rgbResolved: cs.getPropertyValue(r.rgbVar).trim() || "—",
        })),
      );
      const bodyCs = getComputedStyle(document.body);
      setTypo({
        fontFamily: bodyCs.fontFamily,
        fontSize: bodyCs.fontSize,
        lineHeight: bodyCs.lineHeight,
        fontWeight: bodyCs.fontWeight,
      });
      setDocTitle(document.title || "—");
    }

    sample();
    const root = document.documentElement;
    const body = document.body;
    const previewRoot = sampleRootRef.current;
    const mo = new MutationObserver(sample);
    mo.observe(root, { attributes: true, attributeFilter: ["style", "class"] });
    mo.observe(body, { attributes: true, attributeFilter: ["style", "class"] });
    if (previewRoot) {
      mo.observe(previewRoot, { attributes: true, attributeFilter: ["style", "class"] });
    }
    const titleEl = document.querySelector("title");
    const titleMo =
      titleEl &&
      new MutationObserver(() => {
        queueMicrotask(sample);
      });
    if (titleEl && titleMo) {
      titleMo.observe(titleEl, { childList: true, subtree: true, characterData: true });
    }
    window.addEventListener("resize", sample);
    return () => {
      mo.disconnect();
      titleMo?.disconnect();
      window.removeEventListener("resize", sample);
    };
  }, [skin, pathname, previewThemeId, sampleRootRef]);

  return (
    <div className="flex min-h-0 flex-col gap-8 text-[13px] leading-relaxed text-ink sm:text-[14px]">
      {!hidePreviewThemePicker ? (
      <section className="space-y-3" aria-labelledby="shell-template-preview-heading">
        <div className="space-y-1">
          <h2
            id="shell-template-preview-heading"
            className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted"
          >
            {t("shellTemplatePage.previewThemesHeading")}
          </h2>
        </div>
        <div className="min-w-0">
          <ShellTemplateThemeStrip
            variant="page"
            pageRadiogroupLabelledBy="shell-template-preview-heading"
            selectedId={previewThemeId}
            onPick={onPreviewThemeId}
          />
        </div>
      </section>
      ) : null}

      <header className="space-y-1.5">
        <h1 className="text-[17px] font-semibold tracking-tight text-ink sm:text-lg">
          {t("shellTemplatePage.tokensHeading")}
        </h1>
        <p className="max-w-prose text-[12px] text-muted">{t("shellTemplatePage.templateHintsFootnote")}</p>
      </header>

      <section className="space-y-2">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
          {t("shellTemplatePage.sectionMetadata")}
        </h2>
        <dl className="grid gap-3 rounded-xl bg-surface/55 px-3 py-3 sm:px-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <dt className="shrink-0 font-mono text-[11px] font-medium text-muted">{t("shellTemplatePage.metaKeyDefault")}</dt>
            <dd className="min-w-0 font-mono text-[12px] text-ink">{SITE_METADATA_DEFAULT_TITLE}</dd>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <dt className="shrink-0 font-mono text-[11px] font-medium text-muted">{t("shellTemplatePage.metaKeyTemplate")}</dt>
            <dd className="min-w-0 font-mono text-[12px] text-ink">{SITE_METADATA_TITLE_TEMPLATE}</dd>
          </div>
          <p className="text-[11px] text-muted">{t("shellTemplatePage.metaCodeNote")}</p>
          <div className="mt-1 space-y-1 pt-1">
            <p className="text-[11px] font-medium text-muted">{t("shellTemplatePage.liveDocTitleLabel")}</p>
            <p className="mt-1 break-words font-mono text-[12px] text-ink">{docTitle}</p>
            <p className="mt-1 text-[11px] text-muted">{t("shellTemplatePage.liveDocTitleNote")}</p>
          </div>
        </dl>
      </section>

      <section className="space-y-2">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
          {t("shellTemplatePage.sectionTypography")}
        </h2>
        <div className="space-y-3 rounded-xl bg-surface/55 px-3 py-3 sm:px-4">
          <div>
            <p className="text-[11px] font-medium text-muted">{t("shellTemplatePage.liveTypoComputed")}</p>
            <dl className="mt-2 grid gap-2 text-[12px]">
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                <dt className="shrink-0 font-mono text-[11px] text-muted">font-family</dt>
                <dd className="min-w-0 break-words font-mono text-ink">{typo.fontFamily}</dd>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                <dt className="shrink-0 font-mono text-[11px] text-muted">font-size</dt>
                <dd className="font-mono text-ink">{typo.fontSize}</dd>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                <dt className="shrink-0 font-mono text-[11px] text-muted">line-height</dt>
                <dd className="font-mono text-ink">{typo.lineHeight}</dd>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                <dt className="shrink-0 font-mono text-[11px] text-muted">font-weight</dt>
                <dd className="font-mono text-ink">{typo.fontWeight}</dd>
              </div>
            </dl>
            <p className="mt-2 text-[11px] text-muted">{t("shellTemplatePage.liveTypoNote")}</p>
          </div>
          <div className="mt-1 space-y-1 pt-1">
            <p className="text-[12px] font-medium text-ink">{t("shellTemplatePage.fontStackHeading")}</p>
            <p className="mt-1 text-[11px] text-muted">{t("shellTemplatePage.fontStackSource")}</p>
            <p className="mt-2 break-words font-mono text-[11px] leading-snug text-ink/90">{sansStackText}</p>
            <p className="mt-1 text-[11px] text-muted">{t("shellTemplatePage.fontStackStaticNote")}</p>
          </div>
          <p className="text-[11px] text-muted/80">{t("shellTemplatePage.bodySource")}</p>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
          {t("shellTemplatePage.sectionColors")}
        </h2>
        <div className="overflow-x-auto rounded-xl bg-surface/55">
          <table className="w-full min-w-[320px] border-collapse text-left text-[12px]">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                <th className="px-3 py-2 sm:px-4">{t("shellTemplatePage.tableClass")}</th>
                <th className="px-3 py-2 sm:px-4">{t("shellTemplatePage.tableVar")}</th>
                <th className="px-3 py-2 sm:px-4">{t("shellTemplatePage.tableComputed")}</th>
                <th className="px-3 py-2 sm:px-4">{t("shellTemplatePage.tableRole")}</th>
              </tr>
            </thead>
            <tbody>
              {colorRows.map((row) => (
                <tr key={row.key} className="align-top">
                  <td className="px-3 py-2 font-mono text-sand sm:px-4">{row.twToken}</td>
                  <td className="px-3 py-2 font-mono text-[11px] text-ink/90 sm:px-4">
                    {row.cssVar}
                    <span className="mt-0.5 block text-[10px] text-muted">{row.rgbVar}</span>
                  </td>
                  <td className="px-3 py-2 sm:px-4">
                    <span className="inline-flex items-center gap-2">
                      <Swatch cssVar={row.cssResolved} rgbVar={row.rgbResolved} />
                      <span className="flex min-w-0 flex-col gap-0.5 font-mono text-[11px]">
                        <span className="text-ink">{row.cssResolved}</span>
                        <span className="text-muted">{row.rgbResolved}</span>
                      </span>
                    </span>
                  </td>
                  <td className="max-w-[12rem] px-3 py-2 text-ink/90 sm:px-4">
                    {t(`shellTemplatePage.roles.${row.key}`)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted">{t("shellTemplatePage.liveColorNote")}</p>
      </section>
    </div>
  );
}
