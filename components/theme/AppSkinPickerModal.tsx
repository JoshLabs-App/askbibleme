"use client";

import { useLocale } from "@/components/i18n/LocaleProvider";
import { AppShellModal } from "@/components/ui/AppShellModal";
import { USER_SKIN_ORDER } from "@/lib/app-user-skin";
import { useAppSkin } from "./AppSkinProvider";

type Props = {
  open: boolean;
  onDismiss: () => void;
};

/**
 * 界面风格模板：与后台品牌预设同源，仅写本机 localStorage + body CSS 变量覆盖。
 */
export function AppSkinPickerModal({ open, onDismiss }: Props) {
  const { skin, setSkin, shellTemplateBrand } = useAppSkin();
  const { t } = useLocale();
  const titleId = "app-skin-picker-title";

  return (
    <AppShellModal
      open={open}
      onDismiss={onDismiss}
      labelledBy={titleId}
      scrimLabel={t("common.close")}
    >
      <div className="relative z-[1] w-full max-w-[min(100%,22rem)] rounded-2xl border border-border/50 bg-surface/95 px-4 py-4 shadow-[0_20px_50px_-24px_rgba(31,26,18,0.35)] backdrop-blur-md">
        <h2 id={titleId} className="text-[14px] font-medium tracking-tight text-ink">
          {t("skin.title")}
        </h2>
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted">{t("skin.hint")}</p>
        {shellTemplateBrand ? (
          <p className="mt-2 rounded-lg border border-sand/25 bg-canvas/80 px-2.5 py-2 text-[11px] leading-relaxed text-muted">
            {t("skin.themeOverrideHint")}
          </p>
        ) : null}
        <ul className="mt-4 flex flex-col gap-1" role="listbox" aria-label={t("skin.listLabel")}>
          {USER_SKIN_ORDER.map((id) => {
            const selected = skin === id;
            return (
              <li key={id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    setSkin(id);
                    onDismiss();
                  }}
                  className={[
                    "flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-[13px] transition",
                    selected
                      ? "border-sand/55 bg-canvas ring-1 ring-sand/25"
                      : "border-border/40 bg-canvas/60 hover:border-border/70 hover:bg-canvas",
                  ].join(" ")}
                >
                  <span className="text-ink">{t(`skin.presets.${id}`)}</span>
                  {selected ? (
                    <span className="text-[11px] font-medium text-sand" aria-hidden>
                      {t("common.current")}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </AppShellModal>
  );
}
