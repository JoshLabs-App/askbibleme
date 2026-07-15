"use client";

import type { CSSProperties } from "react";
import { NatureHomeAmbientIconStrip } from "@/components/nature/NatureHomeAmbientIconStrip";
import { NatureGoldenVerseAudioControl } from "@/components/nature/NatureGoldenVerseAudioControl";
import { NatureHomeSceneStrip } from "@/components/nature/NatureHomeSceneStrip";
import { ShellMaterialIcon } from "@/components/shell/ShellMaterialIcon";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import "@/components/nature/nature-home-bottom-band.css";
import { NATURE_HOME_TAB_BAR_CLEARANCE_PX } from "@/lib/nature/home-scene-strip-metrics";
import type { NatureAmbientSceneSlotId } from "@/lib/nature/ambient-scene-slots";
import type { NatureSettingsV2, NatureVideoEntry } from "@/lib/nature/types";
import { isCuvChapterAudioEffectiveSrc } from "@/lib/bible/parse-cuv-chapter-audio-src";

type Props = {
  settings: NatureSettingsV2;
  scenes: NatureVideoEntry[];
  activeVideoId: string;
  loopAllScenesEnabled: boolean;
  activeAmbientSlotId: NatureAmbientSceneSlotId | "";
  activeVerseKey: string | null;
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
  activeVerseKey,
  onSelectScene,
  onSelectLoopAll,
  onToggleAmbientSlot,
}: Props) {
  const playback = useMusicShellPlayback();
  const musicPlaying = playback.playing && !isCuvChapterAudioEffectiveSrc(playback.effectiveSrc);

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
      <div className="nature-home-audio-controls">
        <button
          type="button"
          className={[
            "nature-home-audio-control",
            musicPlaying ? "nature-home-audio-control--active" : "",
          ].filter(Boolean).join(" ")}
          disabled={!playback.canPlayMusic}
          aria-pressed={musicPlaying}
          aria-label={musicPlaying ? "暂停背景音乐" : "播放背景音乐"}
          onClick={() => playback.togglePlayMusic()}
        >
          <ShellMaterialIcon
            name="music-note"
            size={35}
            color={musicPlaying ? "var(--brand-logo-background)" : "#fff"}
            legibilityShadow
          />
        </button>
        <NatureGoldenVerseAudioControl verseKey={activeVerseKey} />
      </div>
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
