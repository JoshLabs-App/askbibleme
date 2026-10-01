"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { NatureHomeAmbientIconStrip } from "@/components/nature/NatureHomeAmbientIconStrip";
import { NatureHomeAlbumStrip } from "@/components/nature/NatureHomeAlbumStrip";
import { NatureHomeSceneStrip } from "@/components/nature/NatureHomeSceneStrip";
import { NatureHomeVerseScaleTimerControl } from "@/components/nature/NatureHomeVerseScaleTimerControl";
import { useNatureGoldenVerseTransport } from "@/components/nature/NatureGoldenVerseAudioControl";
import "@/components/nature/nature-home-bottom-band.css";
import { NATURE_HOME_TAB_BAR_CLEARANCE_PX } from "@/lib/nature/home-scene-strip-metrics";
import type { NatureAmbientSceneSlotId } from "@/lib/nature/ambient-scene-slots";
import type { NatureSettingsV2, NatureVideoEntry } from "@/lib/nature/types";

type Props = {
  settings: NatureSettingsV2;
  scenes: NatureVideoEntry[];
  activeVideoId: string;
  activeAmbientSlotId: NatureAmbientSceneSlotId | "";
  activeVerseKey: string | null;
  liveVideoActive: boolean;
  onToggleLiveVideo: () => void;
  prefsVersion: number;
  onPrefsChanged: () => void;
  onSelectScene: (id: string) => void;
  onToggleAmbientSlot: (slotId: NatureAmbientSceneSlotId) => void;
  /** 「字号与定时 · 环境音 · 场景」三排是否展开；开关在首页右上角齿轮 */
  sceneToolsOpen: boolean;
  onSceneToolsOpenChange: (open: boolean) => void;
};

/** 展开后闲置多久自动收起（安卓 `HomeMetrics.TOOLS_AUTO_CLOSE_MS`） */
const SCENE_TOOLS_AUTO_CLOSE_MS = 7000;

/** 自然首页底区：专辑 transport + 可折叠场景/环境音/字号定时（对齐 App `HomeNatureScreenBottomBand`） */
export function NatureHomeBottomBand({
  settings,
  scenes,
  activeVideoId,
  activeAmbientSlotId,
  activeVerseKey,
  liveVideoActive,
  onToggleLiveVideo,
  prefsVersion,
  onPrefsChanged,
  onSelectScene,
  onToggleAmbientSlot,
  sceneToolsOpen,
  onSceneToolsOpenChange,
}: Props) {
  /** 每碰一下底部带就重新计 7 秒 */
  const [idleEpoch, setIdleEpoch] = useState(0);
  useEffect(() => {
    if (!sceneToolsOpen) return;
    const id = window.setTimeout(() => onSceneToolsOpenChange(false), SCENE_TOOLS_AUTO_CLOSE_MS);
    return () => window.clearTimeout(id);
  }, [sceneToolsOpen, idleEpoch, onSceneToolsOpenChange]);
  const verse = useNatureGoldenVerseTransport(activeVerseKey);

  if (!scenes.length) return null;

  return (
    <div
      className="nature-home-bottom-band"
      onPointerDownCapture={() => setIdleEpoch((n) => n + 1)}
      style={
        {
          "--nature-home-tab-bar-clearance": `${NATURE_HOME_TAB_BAR_CLEARANCE_PX}px`,
        } as CSSProperties
      }
    >
      {sceneToolsOpen ? (
        <>
          <NatureHomeVerseScaleTimerControl prefsVersion={prefsVersion} onPrefsChanged={onPrefsChanged} />
          <NatureHomeAmbientIconStrip
            settings={settings}
            activeSlotId={activeAmbientSlotId}
            onToggleSlot={onToggleAmbientSlot}
          />
          <NatureHomeSceneStrip
            scenes={scenes}
            activeVideoId={activeVideoId}
            liveVideoActive={liveVideoActive}
            onToggleLiveVideo={onToggleLiveVideo}
            onSelectScene={onSelectScene}
          />
        </>
      ) : null}
      <NatureHomeAlbumStrip
        goldenVersePlaying={verse.active}
        goldenVerseAudible={verse.audible}
        goldenVersePreparing={verse.preparing}
        onToggleGoldenVerse={() => void verse.toggle()}
        onPauseVerseTransport={verse.pauseVerseTransport}
        onResumeVerseTransport={() => void verse.resumeVerseTransport()}
      />
      <audio
        ref={verse.audioRef}
        src={verse.src ?? undefined}
        className="hidden"
        playsInline
        preload="metadata"
        aria-hidden
      />
    </div>
  );
}
