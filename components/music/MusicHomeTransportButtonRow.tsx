"use client";

import type { ReactNode } from "react";
import "@/components/music/music-home-transport-row.css";

export type MusicHomeTransportSideSlot = {
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
  accessibilityLabel: string;
  icon: ReactNode;
};

type Props = {
  playing: boolean;
  canTogglePlayback: boolean;
  onTogglePlay: () => void;
  playAccessibilityLabel?: string;
  pauseAccessibilityLabel?: string;
  sides: {
    start: MusicHomeTransportSideSlot;
    beforePlay: MusicHomeTransportSideSlot;
    afterPlay: MusicHomeTransportSideSlot;
    end: MusicHomeTransportSideSlot;
  };
};

function SideSlotButton({ slot }: { slot: MusicHomeTransportSideSlot }) {
  return (
    <button
      type="button"
      onClick={slot.onPress}
      disabled={slot.disabled}
      aria-pressed={slot.selected}
      aria-label={slot.accessibilityLabel}
      className={[
        "music-home-transport-side-btn",
        slot.disabled ? "music-home-transport-side-btn--disabled" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {slot.icon}
    </button>
  );
}

/** 首页底栏专辑 / 播放 / 金句 / 设置行（对齐 App `MusicHomeTransportButtonRow`） */
export function MusicHomeTransportButtonRow({
  playing,
  canTogglePlayback,
  onTogglePlay,
  playAccessibilityLabel = "Play music",
  pauseAccessibilityLabel = "Pause music",
  sides,
}: Props) {
  return (
    <div className="music-home-transport-row" data-shell-swipe-nav-exclude>
      <div className="music-home-transport-row__cluster">
        <div className="music-home-transport-row__pair">
          <SideSlotButton slot={sides.start} />
          <SideSlotButton slot={sides.beforePlay} />
        </div>
        <button
          type="button"
          onClick={onTogglePlay}
          disabled={!canTogglePlayback}
          aria-pressed={playing}
          aria-label={playing ? pauseAccessibilityLabel : playAccessibilityLabel}
          className={[
            "music-home-transport-play-btn",
            playing ? "music-home-transport-play-btn--playing" : "",
            !canTogglePlayback ? "music-home-transport-play-btn--disabled" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <ShellMaterialIcon
            name={playing ? "pause" : "play-arrow"}
            size={34}
            color="#1C1410"
            className={playing ? undefined : "music-home-transport-play-btn__icon-nudge"}
          />
        </button>
        <div className="music-home-transport-row__pair">
          <SideSlotButton slot={sides.afterPlay} />
          <SideSlotButton slot={sides.end} />
        </div>
      </div>
    </div>
  );
}
