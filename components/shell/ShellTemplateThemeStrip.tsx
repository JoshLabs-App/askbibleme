"use client";

import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  SHELL_TEMPLATE_PREVIEW_THEMES,
  type ShellTemplatePreviewThemeId,
} from "@/lib/shell/template-preview-themes";

type Props = {
  selectedId: ShellTemplatePreviewThemeId | null;
  onPick: (id: ShellTemplatePreviewThemeId) => void;
  /** `drawer`：左抽屉；`page`：壳模板页 */
  variant: "drawer" | "page";
  /** `variant="page"` 时可选：与可见标题 `id` 对应，供 radiogroup 使用 */
  pageRadiogroupLabelledBy?: string;
};

/**
 * 主题配色：单行横向滑动，胶囊形色块（非方格），触控区 ≥44px。
 */
export function ShellTemplateThemeStrip({
  selectedId,
  onPick,
  variant,
  pageRadiogroupLabelledBy,
}: Props) {
  const { t } = useLocale();

  return (
    <div
      className={[
        "flex min-w-0 flex-nowrap gap-2.5 overflow-x-auto overflow-y-hidden overscroll-x-contain",
        "scroll-smooth scroll-pl-1 scroll-pr-1 snap-x snap-mandatory py-1",
        "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        variant === "page" ? "w-full max-w-full" : "w-full max-w-full",
      ].join(" ")}
      role={variant === "page" ? "radiogroup" : "group"}
      aria-labelledby={variant === "page" && pageRadiogroupLabelledBy ? pageRadiogroupLabelledBy : undefined}
      aria-label={
        variant === "page" && pageRadiogroupLabelledBy
          ? undefined
          : variant === "page"
            ? t("shellTemplatePage.previewThemesHeading")
            : t("nav.themeColorsHeading")
      }
    >
      {SHELL_TEMPLATE_PREVIEW_THEMES.map((th) => {
        const selected = selectedId === th.id;
        const gradient = `linear-gradient(155deg, ${th.colors.surface} 0%, ${th.colors.canvas} 58%, ${th.colors.canvas} 100%)`;
        return (
          <button
            key={th.id}
            type="button"
            role={variant === "page" ? "radio" : undefined}
            aria-checked={variant === "page" ? selected : undefined}
            aria-pressed={variant === "drawer" ? selected : undefined}
            aria-label={t(`shellTemplatePage.previewThemes.${th.id}`)}
            title={t(`shellTemplatePage.previewThemes.${th.id}`)}
            onClick={() => onPick(th.id)}
            className="flex min-h-[44px] min-w-[44px] snap-center shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-1 transition active:scale-[0.96]"
            style={
              selected
                ? { boxShadow: `0 0 0 2px ${th.colors.sand}` }
                : undefined
            }
          >
            <span
              aria-hidden
              className="block h-8 w-[2.75rem] shrink-0 rounded-full sm:h-9 sm:w-[3.1rem]"
              style={{ background: gradient }}
            />
          </button>
        );
      })}
    </div>
  );
}
