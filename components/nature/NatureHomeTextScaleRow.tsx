"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  NATURE_HOME_SUPER_LARGE_TEXT_SCALE_INDEX,
  NATURE_HOME_TEXT_SCALE_DEFAULT_STEP_INDEX,
  NATURE_HOME_TEXT_SCALE_STEPS,
  natureHomeTextScaleAtStep,
  readNatureHomeTextScaleStepIndex,
  writeNatureHomeTextScaleStepIndex,
} from "@/lib/home/nature-home-text-scale-prefs";

type Props = {
  panelOpen?: boolean;
  onPrefsChanged?: () => void;
};

/** 对齐 App `NatureHomeSettingsPanel` 字号行：T / 大T / − / + */
export function NatureHomeTextScaleRow({ panelOpen = false, onPrefsChanged }: Props) {
  const { t } = useLocale();
  const [scaleIndex, setScaleIndex] = useState(NATURE_HOME_TEXT_SCALE_DEFAULT_STEP_INDEX);

  useEffect(() => {
    setScaleIndex(readNatureHomeTextScaleStepIndex());
  }, [panelOpen]);

  const atMin = scaleIndex <= 0;
  const atMax = scaleIndex >= NATURE_HOME_TEXT_SCALE_STEPS.length - 1;
  const atDefault = scaleIndex === NATURE_HOME_TEXT_SCALE_DEFAULT_STEP_INDEX;
  const atSuperLarge = scaleIndex >= NATURE_HOME_SUPER_LARGE_TEXT_SCALE_INDEX;
  const scaleA11y = `${t("nature.homeSettings.verseSizeSection")} ${Math.round(natureHomeTextScaleAtStep(scaleIndex) * 100)}%`;

  const applyIndex = (next: number) => {
    setScaleIndex(next);
    writeNatureHomeTextScaleStepIndex(next);
    onPrefsChanged?.();
  };

  const btn =
    "flex h-[30px] w-[34px] shrink-0 items-center justify-center rounded-[5px] border-0 bg-zinc-600 text-slate-100 transition disabled:opacity-35";

  return (
    <div className="inline-flex items-center gap-1" aria-label={scaleA11y}>
      <button
        type="button"
        disabled={atDefault}
        aria-label={t("nature.textScaleDefaultAria")}
        onClick={() => applyIndex(NATURE_HOME_TEXT_SCALE_DEFAULT_STEP_INDEX)}
        className={`${btn} ${atDefault ? "border border-zinc-500 bg-zinc-500" : ""}`}
      >
        <span className="text-[15px] font-semibold leading-none">T</span>
      </button>
      <button
        type="button"
        disabled={atSuperLarge}
        aria-label={t("nature.homeSettings.textScaleSuperAria")}
        onClick={() => applyIndex(NATURE_HOME_SUPER_LARGE_TEXT_SCALE_INDEX)}
        className={`${btn} ${atSuperLarge ? "border border-zinc-500 bg-zinc-500" : ""}`}
      >
        <span className="text-[18px] font-bold leading-none tracking-wide">T</span>
      </button>
      <button
        type="button"
        disabled={atMin}
        aria-label={t("nature.textScaleSmallerAria")}
        onClick={() => applyIndex(Math.max(0, scaleIndex - 1))}
        className={btn}
      >
        <span className="text-[20px] font-semibold leading-none">−</span>
      </button>
      <button
        type="button"
        disabled={atMax}
        aria-label={t("nature.textScaleLargerAria")}
        onClick={() => applyIndex(Math.min(NATURE_HOME_TEXT_SCALE_STEPS.length - 1, scaleIndex + 1))}
        className={btn}
      >
        <span className="text-[20px] font-semibold leading-none">+</span>
      </button>
    </div>
  );
}
