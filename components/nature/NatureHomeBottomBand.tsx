"use client";

import type { CSSProperties } from "react";
import { NatureHomeAmbientIconStrip } from "@/components/nature/NatureHomeAmbientIconStrip";
import { NatureHomeSceneStrip } from "@/components/nature/NatureHomeSceneStrip";
import "@/components/nature/nature-home-bottom-band.css";
import { NATURE_HOME_TAB_BAR_CLEARANCE_PX } from "@/lib/nature/home-scene-strip-metrics";
import type { NatureAmbientSceneSlotId } from "@/lib/nature/ambient-scene-slots";
import type { NatureSettingsV2, NatureVideoEntry } from "@/lib/nature/types";

type Props = {
  settings: NatureSettingsV2;
  scenes: NatureVideoEntry[];
  activeVideoId: string;
  loopAllScenesEnabled: boolean;
  activeAmbientSlotId: NatureAmbientSceneSlotId | "";
  onSelectScene: (id: string) => void;
  onSelectLoopAll: () => void;
  onToggleAmbientSlot: (slotId: NatureAmbientSceneSlotId) => void;
};

/** 自然首页底区：环境音图标条 + 圆形场景缩略图条（叠在视频上，避让浮层 Tab） */
export function NatureHomeBottomBand({
  settings,
  scenes,
  activeVideoId,
  loopAllScenesEnabled,
  activeAmbientSlotId,
  onSelectScene,
  onSelectLoopAll,
  onToggleAmbientSlot,
}: Props) {
  if (!scenes.length) return null;

  return (
    <div
      className="nature-home-bottom-band"
      style={
        {
          "--nature-home-tab-bar-clearance": `${NATURE_HOME_TAB_BAR_CLEARANCE_PX}px`,
        } as CSSProperties
      }
    >
      <NatureHomeAmbientIconStrip
        settings={settings}
        activeSlotId={activeAmbientSlotId}
        onToggleSlot={onToggleAmbientSlot}
      />
      <NatureHomeSceneStrip
        scenes={scenes}
        activeVideoId={activeVideoId}
        loopAllScenesEnabled={loopAllScenesEnabled}
        onSelectScene={onSelectScene}
        onSelectLoopAll={onSelectLoopAll}
      />
    </div>
  );
}
