import { useCallback } from "react";
import { getMusicPlaybackProgressTickSnapshot } from "./musicPlaybackProgressTick";

type Args = {
  tracksLength: number;
  filteredTrackIndices: number[];
  currentFilteredIndex: number;
  musicActive: boolean;
  playTrackAt: (index: number, opts?: { autoPlay?: boolean }) => Promise<boolean>;
  playNext: () => Promise<void>;
  playPrev: () => Promise<void>;
  seekRatio: (ratio: number) => Promise<void>;
};

export function useMusicHomeGestures({
  tracksLength,
  filteredTrackIndices,
  currentFilteredIndex,
  musicActive,
  playTrackAt,
  playNext,
  playPrev,
  seekRatio,
}: Args) {
  const onPrev = useCallback(() => {
    // 按下那一刻才读播放位置：放进依赖会让回调每秒重建，把整个音乐页拖进重渲染。
    if (musicActive && getMusicPlaybackProgressTickSnapshot().musicCurrentSec > 3) {
      void seekRatio(0);
      return;
    }
    void playPrev();
  }, [musicActive, playPrev, seekRatio]);

  const onMusicSwipe = useCallback(
    (direction: "left" | "right") => {
      if (tracksLength === 0) return;
      // 下一曲统一随机（与运输键 playNext 一致）；上一曲仍按专辑顺序。
      if (direction === "left") {
        void playNext();
        return;
      }
      if (filteredTrackIndices.length > 1 && currentFilteredIndex >= 0) {
        const prevFilteredIndex =
          currentFilteredIndex <= 0 ? filteredTrackIndices.length - 1 : currentFilteredIndex - 1;
        void playTrackAt(filteredTrackIndices[prevFilteredIndex]!);
        return;
      }
      void onPrev();
    },
    [tracksLength, filteredTrackIndices, currentFilteredIndex, playTrackAt, playNext, onPrev],
  );

  return { onPrev, onMusicSwipe };
}
