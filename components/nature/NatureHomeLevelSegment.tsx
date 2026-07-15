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
      className="nature-home-settings-segment flex w-full rounded-[9px] border p-[3px]"
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
              "flex min-h-[36px] flex-1 items-center justify-center rounded-[7px] border border-transparent bg-transparent p-0 transition",
              isOn ? "nature-home-settings-choice--active" : "",
            ].join(" ")}
          >
            <ShellMaterialIcon
              name={iconForLevel(level)}
              size={17}
              color={isOn ? "#1c1410" : "#6e5240"}
            />
          </button>
        );
      })}
    </div>
  );
}
