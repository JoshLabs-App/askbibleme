"use client";

import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  NATURE_SCENE_CATEGORIES,
  natureSceneCategoryLabelKey,
  type NatureSceneCategory,
} from "@/lib/nature/scene-categories";

type Props = {
  value: NatureSceneCategory;
  onChange: (value: NatureSceneCategory) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
};

export function NatureSceneCategorySelect({
  value,
  onChange,
  disabled,
  className = "rounded border border-border bg-adminPanel px-2 py-1 text-[12px] text-adminFg",
  "aria-label": ariaLabel,
}: Props) {
  const { t } = useLocale();
  return (
    <select
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      className={className}
      onChange={(e) => onChange(e.target.value as NatureSceneCategory)}
    >
      {NATURE_SCENE_CATEGORIES.map((id) => (
        <option key={id} value={id}>
          {t(natureSceneCategoryLabelKey(id))}
        </option>
      ))}
    </select>
  );
}
