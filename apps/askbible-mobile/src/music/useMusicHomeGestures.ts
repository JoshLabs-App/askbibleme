import { useCallback } from "react";

type Args = {
  tracksLength: number;
  filteredTrackIndices: number[];
  currentFilteredIndex: number;
  musicActive: boolean;
  musicCurrentSec: number;
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
  musicCurrentSec,
  playTrackAt,
  playNext,
  playPrev,
  seekRatio,
}: Args) {
  const onPrev = useCallback(() => {
    if (musicActive && musicCurrentSec > 3) {
      void seekRatio(0);
      return;
    }
    void playPrev();
  }, [musicActive, musicCurrentSec, playPrev, seekRatio]);

  const onMusicSwipe = useCallback(
    (direction: "left" | "right") => {
      if (tracksLength === 0) return;
      if (filteredTrackIndices.length > 1 && currentFilteredIndex >= 0) {
        if (direction === "left") {
          const nextFilteredIndex = (currentFilteredIndex + 1) % filteredTrackIndices.length;
          void playTrackAt(filteredTrackIndices[nextFilteredIndex]!);
          return;
        }
        const prevFilteredIndex =
          currentFilteredIndex <= 0 ? filteredTrackIndices.length - 1 : currentFilteredIndex - 1;
        void playTrackAt(filteredTrackIndices[prevFilteredIndex]!);
        return;
      }
      if (direction === "left") void playNext();
      else void onPrev();
    },
    [tracksLength, filteredTrackIndices, currentFilteredIndex, playTrackAt, playNext, onPrev],
  );

  return { onPrev, onMusicSwipe };
}
