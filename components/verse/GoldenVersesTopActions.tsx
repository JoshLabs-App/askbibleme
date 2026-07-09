"use client";

import { useAppImmersive } from "@/components/app-shell/AppImmersiveProvider";
import { useGoldenVersesChromeless } from "@/components/verse/GoldenVersesChromelessContext";
import { GoldenVerseTextScaleControls } from "@/components/verse/GoldenVerseTextScaleControls";
import { GoldenVersesPageTemplatePicker } from "@/components/verse/GoldenVersesPageTemplatePicker";
import type { GoldenVerseBackgroundItem } from "@/lib/golden-verses/background-uploads";
import { GoldenVersesSettingsTopBar } from "@/components/verse/GoldenVersesSettingsTopBar";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { exitFullscreenCompat } from "@/lib/dom/fullscreen";

function IconEnterFullscreen(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path
        d="M9 4H4v5M15 4h5v5M15 20h5v-5M9 20H4v-5"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconExitFullscreen(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path
        d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const BTN_LIGHT =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink/85 transition hover:bg-ink/[0.06] active:scale-[0.97]";
const BTN_DARK =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/90 transition hover:bg-white/12 active:scale-[0.97]";

type Props = {
  /** `inline`：壳层右上槽内；`floating`：沉浸态固定角标 */
  layout: "inline" | "floating";
  /** 与 `GoldenVersesSettingsTopBar` 一致 */
  settingsVariant?: "light" | "dark";
  /** 后台实际上传的金句页背景目录 */
  uploadedBackgrounds?: readonly GoldenVerseBackgroundItem[];
  refreshPageBackgrounds?: () => Promise<GoldenVerseBackgroundItem[]>;
};

/**
 * 全屏（沉浸壳）+ 设置齿轮。沉浸时壳层角标收起，仅 `floating` 这一条可见。
 */
export function GoldenVersesTopActions({
  layout,
  settingsVariant,
  uploadedBackgrounds = [],
  refreshPageBackgrounds,
}: Props) {
  const { t } = useLocale();
  const { chromeless, manualChromeless, landscapeNarrow, setManualChromeless } = useGoldenVersesChromeless();
  const { immersive, setImmersive } = useAppImmersive();

  const floating = layout === "floating";
  const onDark = settingsVariant === "dark" || floating;

  const showExitIcon = immersive || manualChromeless || landscapeNarrow;

  const onFullscreenClick = () => {
    if (immersive) {
      setImmersive(false);
      void exitFullscreenCompat();
      return;
    }
    if (landscapeNarrow) {
      setManualChromeless(false);
      void exitFullscreenCompat();
      return;
    }
    if (manualChromeless) {
      setManualChromeless(false);
      void exitFullscreenCompat();
      return;
      }
      setManualChromeless(true);
  };

  const wrapClass = floating
    ? "pointer-events-auto fixed right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.5rem,env(safe-area-inset-top))] z-[60] flex items-center gap-1 rounded-full border border-white/22 bg-black/40 px-1.5 py-1 shadow-lg backdrop-blur-md"
    : "pointer-events-auto flex items-center gap-1";

  return (
    <div className={wrapClass}>
      {floating ? (
        <button
          type="button"
          onClick={onFullscreenClick}
          aria-label={
            showExitIcon ? t("pages.goldenVerses.fullscreenExit") : t("pages.goldenVerses.fullscreenEnter")
          }
          aria-pressed={showExitIcon}
          className={onDark ? BTN_DARK : BTN_LIGHT}
        >
          {showExitIcon ? (
            <IconExitFullscreen className="h-[15px] w-[15px] opacity-90" />
          ) : (
            <IconEnterFullscreen className="h-[15px] w-[15px] opacity-88" />
          )}
        </button>
      ) : null}
      <GoldenVerseTextScaleControls variant={settingsVariant ?? (floating ? "dark" : "light")} />
      {uploadedBackgrounds.length > 0 ? (
        <GoldenVersesPageTemplatePicker
          uploadedBackgrounds={uploadedBackgrounds}
          refreshPageBackgrounds={refreshPageBackgrounds}
          variant={settingsVariant ?? (floating ? "dark" : "light")}
        />
      ) : null}
      <GoldenVersesSettingsTopBar variant={settingsVariant ?? (floating ? "dark" : "light")} />
    </div>
  );
}
