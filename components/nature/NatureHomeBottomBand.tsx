"use client";

import type { CSSProperties } from "react";
import { useRef } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { SCENE_DEFAULT_AMBIENT } from "@/lib/nature/ambient-scene-slots";
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
  onAlbumOptionsOpenChange: (open: boolean) => void;
  ambientVolume: number;
  onAmbientVolumeChange: (value: number) => void;
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
  ambientVolume, onAmbientVolumeChange, onAlbumOptionsOpenChange,
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
  const { locale } = useLocale();
  const text = (zh: string, en: string) => locale === "en" ? en : zh;
  const headerY = useRef(0);
  const verse = useNatureGoldenVerseTransport(activeVerseKey);

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
      {sceneToolsOpen ? (
        <section className="nature-home-adjustment" role="dialog" aria-label={text("调整", "Adjust")} aria-modal="false" data-shell-swipe-nav-exclude>
          <header onPointerDown={e => { if ((e.target as Element).closest("button")) return; headerY.current = e.clientY; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerUp={e => { if ((e.target as Element).closest("button")) return; if (e.clientY - headerY.current > 40) onSceneToolsOpenChange(false); }}>
            <strong>{text("调整", "Adjust")}</strong><button type="button" aria-label={text("关闭调整", "Close adjustments")} onClick={() => onSceneToolsOpenChange(false)}>×</button>
          </header>
          <div className="nature-home-adjustment-scroll">
          <label className="nature-home-adjustment-switch">{text("环境音", "Ambient sound")}<input type="checkbox" checked={!!activeAmbientSlotId} onChange={() => onToggleAmbientSlot(activeAmbientSlotId || SCENE_DEFAULT_AMBIENT[activeVideoId] || "scene-water")} /></label>
          <NatureHomeAmbientIconStrip
            settings={settings}
            activeSlotId={activeAmbientSlotId}
            onToggleSlot={onToggleAmbientSlot}
          />
          <label className="nature-home-volume">{text("音量", "Volume")}<input type="range" min="0" max="1" step="0.05" value={ambientVolume} onChange={e => onAmbientVolumeChange(Number(e.target.value))} /></label>
          <h3>{text("音乐专辑", "Music albums")}</h3>
          <NatureHomeAlbumStrip optionsOnly goldenVersePlaying={verse.active} onToggleGoldenVerse={() => void verse.toggle()} onResumeVerseTransport={() => void verse.resumeVerseTransport()} />
          <h3>{text("场景", "Scenes")}</h3>
          <NatureHomeSceneStrip
            scenes={scenes}
            activeVideoId={activeVideoId}
            liveVideoActive={liveVideoActive}
            onToggleLiveVideo={onToggleLiveVideo}
            onSelectScene={onSelectScene}
          />
          <NatureHomeVerseScaleTimerControl prefsVersion={prefsVersion} onPrefsChanged={onPrefsChanged} />
          </div>
        </section>
      ) : null}
      <div hidden={sceneToolsOpen}><NatureHomeAlbumStrip
        onOptionsOpenChange={onAlbumOptionsOpenChange}
        goldenVersePlaying={verse.active}
        goldenVerseAudible={verse.audible}
        goldenVersePreparing={verse.preparing}
        onToggleGoldenVerse={() => void verse.toggle()}
        onPauseVerseTransport={verse.pauseVerseTransport}
        onResumeVerseTransport={() => void verse.resumeVerseTransport()}
      /></div>
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
