"use client";

import { AppShellModal } from "@/components/ui/AppShellModal";
import { SUPPORTED_LOCALES, type AppLocale } from "@/lib/i18n/config";
import { useLocale } from "./LocaleProvider";

type Props = {
  open: boolean;
  onDismiss: () => void;
};

export function LocalePickerModal({ open, onDismiss }: Props) {
  const { locale, setLocale, t } = useLocale();
  const titleId = "locale-picker-title";

  return (
    <AppShellModal
      open={open}
      onDismiss={onDismiss}
      labelledBy={titleId}
      scrimLabel={t("common.close")}
    >
      <div className="relative z-[1] w-full max-w-[min(100%,22rem)] rounded-2xl border border-border/50 bg-surface/95 px-4 py-4 shadow-[0_20px_50px_-24px_rgba(31,26,18,0.35)] backdrop-blur-md">
        <h2 id={titleId} className="text-[14px] font-medium tracking-tight text-ink">
          {t("localePicker.title")}
        </h2>
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted">{t("localePicker.hint")}</p>
        <ul className="mt-4 flex flex-col gap-1" role="listbox" aria-label={t("localePicker.listLabel")}>
          {SUPPORTED_LOCALES.map((id) => {
            const selected = locale === id;
            const label = t(`localeNames.${id}`);
            return (
              <li key={id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    setLocale(id as AppLocale);
                    onDismiss();
                  }}
                  className={[
                    "flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-[13px] transition",
                    selected
                      ? "border-sand/55 bg-canvas ring-1 ring-sand/25"
                      : "border-border/40 bg-canvas/60 hover:border-border/70 hover:bg-canvas",
                  ].join(" ")}
                >
                  <span className="text-ink">{label}</span>
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
