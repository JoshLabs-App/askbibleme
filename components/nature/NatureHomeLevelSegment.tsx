"use client";

import { ShellMaterialIcon } from "@/components/shell/ShellMaterialIcon";
import {
  NATURE_VISUAL_EFFECT_LEVELS,
  NATURE_VISUAL_LEVELS,
  type NatureVisualLevel,
} from "@/lib/nature/nature-visual-level-prefs";

type Props = {
  selected: NatureVisualLevel;
  onSelect: (level: NatureVisualLevel) => void;
  iconForLevel: (level: NatureVisualLevel) => string;
  ariaLabel: string;
  /** 再点已选档回调 `onSelect(0)` */
  allowToggleOff?: boolean;
};

/** 对齐 App：四档（关=不选 + 三钮）；`allowToggleOff` 时再点已选档关闭 */
export function NatureHomeLevelSegment({
  selected,
  onSelect,
  iconForLevel,
  ariaLabel,
  allowToggleOff = false,
}: Props) {
  const visibleLevels = allowToggleOff ? NATURE_VISUAL_EFFECT_LEVELS : NATURE_VISUAL_LEVELS;

  return (
    <div
      className="inline-flex rounded-[7px] bg-zinc-800 p-0.5"
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {visibleLevels.map((level) => {
        const isOn = selected === level;
        return (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={isOn}
            aria-label={`${ariaLabel} ${level}`}
            onClick={() => onSelect(allowToggleOff && isOn ? 0 : level)}
            className={[
              "flex h-[30px] w-[34px] shrink-0 items-center justify-center rounded-[5px] border-0 bg-transparent p-0 transition",
              isOn ? "bg-zinc-600" : "hover:bg-zinc-700/60",
            ].join(" ")}
          >
            <ShellMaterialIcon
              name={iconForLevel(level)}
              size={17}
              color={isOn ? "#fff" : "rgba(255,255,255,0.5)"}
            />
          </button>
        );
      })}
    </div>
  );
}
