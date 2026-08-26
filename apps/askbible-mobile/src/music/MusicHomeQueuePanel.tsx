import { Animated, ScrollView, View } from "react-native";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import type { RefObject } from "react";
import type { ScrollView as ScrollViewType } from "react-native";
import { MusicHomeQueueRow } from "./MusicHomeQueueRow";
import { musicHomeQueuePanelStyles as styles } from "./musicHomeQueuePanelStyles";
import { isTrackPlayable } from "./trackArtwork";
import type { PlaybackTrack } from "./types";

type Props = {
  queueDisplayIndices: number[];
  tracks: PlaybackTrack[];
  trackIndex: number;
  queueScrollV: Animated.Value;
  downloadingTrackId: string | null;
  offlineMusicOnly: boolean;
  compactLandscape: boolean;
  chromeVisible: boolean;
  queueScrollRef: RefObject<ScrollViewType | null>;
  onQueueScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onSelectTrack: (index: number) => void;
};

export function MusicHomeQueuePanel({
  queueDisplayIndices,
  tracks,
  trackIndex,
  queueScrollV,
  downloadingTrackId,
  offlineMusicOnly,
  compactLandscape,
  chromeVisible,
  queueScrollRef,
  onQueueScroll,
  onSelectTrack,
}: Props) {
  if (queueDisplayIndices.length === 0) return null;

  return (
    <View
      style={[
        styles.queueWrap,
        compactLandscape && styles.queueWrapLandscape,
        !chromeVisible && styles.chromeHidden,
      ]}
      pointerEvents={chromeVisible ? "auto" : "none"}
    >
      <ScrollView
        ref={queueScrollRef}
        style={styles.queueScroll}
        contentContainerStyle={styles.queueScrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={onQueueScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.queue}>
          {queueDisplayIndices.map((index, displayIdx) => {
            const tr = tracks[index]!;
            const active = index === trackIndex;
            const isDownloading = downloadingTrackId === tr.id;
            const needsCache = !tr.localReady && isTrackPlayable(tr);
            return (
              <MusicHomeQueueRow
                key={`${tr.id}-${displayIdx}`}
                track={tr}
                displayIdx={displayIdx}
                active={active}
                queueScrollV={queueScrollV}
                isDownloading={isDownloading}
                needsCache={needsCache}
                onSelect={() => onSelectTrack(index)}
              />
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
