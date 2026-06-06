"use client";

import { useMemo } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { ShellMaterialCommunityIcon } from "@/components/shell/ShellMaterialCommunityIcon";
import {
  NATURE_AMBIENT_SCENE_SLOTS,
  type NatureAmbientSceneSlotId,
} from "@/lib/nature/ambient-scene-slots";
import { ambientIconColor, ambientStripContentWidth } from "@/lib/shell/ambient-icon-color";
import { SHELL_AMBIENT_ICON_GLYPH_PX } from "@/lib/shell/shell-chrome-icons";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";
import type { NatureSettingsV2 } from "@/lib/nature/types";

type Props = {
  settings: NatureSettingsV2;
  activeSlotId: NatureAmbientSceneSlotId | "";
  onToggleSlot: (slotId: NatureAmbientSceneSlotId) => void;
};

export function NatureHomeAmbientIconStrip({ settings, activeSlotId, onToggleSlot }: Props) {
  const { locale } = useLocale();
  const enabledIds = useMemo(
    () => new Set((settings.ambientClips ?? []).map((clip) => clip.id.trim()).filter(Boolean)),
    [settings.ambientClips],
  );

  const rowMinWidth = ambientStripContentWidth(NATURE_AMBIENT_SCENE_SLOTS.length);

  return (
    <div className="nature-home-ambient-scroll-wrap" data-shell-swipe-nav-exclude>
      <div
        className="nature-home-ambient-row"
        style={{ minWidth: `max(${rowMinWidth}px, 100%)` }}
      >
        {NATURE_AMBIENT_SCENE_SLOTS.map((slot) => {
          const enabled = enabledIds.has(slot.id);
          const selected = activeSlotId === slot.id;
          const iconColor = ambientIconColor(selected, enabled);
          const label =
            locale === "en" ? slot.labelEn : locale === "zh-TW" ? toZhTwText(slot.label) : slot.label;
          return (
            <button
              key={slot.id}
              type="button"
              disabled={!enabled}
              aria-pressed={selected}
              aria-label={
                enabled ? `${label}${selected ? "（已选中）" : ""}` : `${label}（未上传）`
              }
              onClick={() => {
                if (!enabled) return;
                onToggleSlot(slot.id);
              }}
              className={[
                "nature-home-ambient-chip",
                selected ? "nature-home-ambient-chip--selected" : "",
                !enabled ? "nature-home-ambient-chip--disabled" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{ color: iconColor }}
            >
              <ShellMaterialCommunityIcon
                name={slot.icon}
                size={SHELL_AMBIENT_ICON_GLYPH_PX}
                color={iconColor}
                className="nature-home-ambient-chip__icon"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
