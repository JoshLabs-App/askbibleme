import { useEffect, useRef, useSyncExternalStore } from "react";
import { Animated, Text, View } from "react-native";
import { MinimalProgressBar } from "../ui/MinimalProgressBar";
import { musicHomePlaybackControlsStyles as styles } from "./musicHomePlaybackControlsStyles";
import { musicCopy } from "./musicCopy";
import { formatPlaybackClock } from "./musicPlaybackProgress";
import {
  getMusicPlaybackProgressTickSnapshot,
  subscribeMusicPlaybackProgressTick,
} from "./musicPlaybackProgressTick";
import { useMusicHomeSeekState } from "./useMusicHomeScreenState";
import { SPLASH_BACKGROUND as LOGO_COLOR } from "../shell/splash-branding.generated";

type Props = {
  duration: number;
  musicActive: boolean;
  trackIndex: number;
  playbackMode: string;
  seekRatio: (ratio: number) => Promise<void>;
};

/** 播放位置每秒变化约 4 次，但时钟只显示到秒；取整后 React 才会真正重渲染。 */
function useMusicWholeSec(): number {
  const read = () => Math.floor(getMusicPlaybackProgressTickSnapshot().musicCurrentSec);
  return useSyncExternalStore(subscribeMusicPlaybackProgressTick, read, read);
}

/**
 * 音乐页唯一需要跟着播放位置走的部分。
 *
 * 进度条填充由 Animated.Value 驱动（setValue，不进 React state），所以推进过程零重渲染；
 * 只有时钟文字在整秒跳变时才渲染一次。
 */
export function MusicHomeScrubber({ duration, musicActive, trackIndex, playbackMode, seekRatio }: Props) {
  const progressV = useRef(new Animated.Value(0)).current;
  const seek = useMusicHomeSeekState(trackIndex, playbackMode);
  const wholeSec = useMusicWholeSec();

  const draggingRef = useRef(false);
  draggingRef.current = seek.seekDragging;

  useEffect(() => {
    const apply = () => {
      if (draggingRef.current) return;
      const sec = musicActive ? getMusicPlaybackProgressTickSnapshot().musicCurrentSec : 0;
      progressV.setValue(duration > 0 ? Math.min(1, sec / duration) : 0);
    };
    apply();
    return subscribeMusicPlaybackProgressTick(apply);
  }, [duration, musicActive, progressV]);

  // 拖动时进度条跟手指走，松手后由上面的订阅接管。
  useEffect(() => {
    if (seek.seekDragging) progressV.setValue(seek.seekPreview);
  }, [progressV, seek.seekDragging, seek.seekPreview]);

  const position = musicActive ? (seek.seekDragging ? seek.seekPreview * (duration || 1) : wholeSec) : 0;

  return (
    <View style={styles.scrubber}>
      <Text style={[styles.timeText, styles.timeStart]}>{formatPlaybackClock(position)}</Text>
      <View style={styles.scrubberBar}>
        <MinimalProgressBar
          progress={progressV}
          accessibilityPercent={duration > 0 ? Math.round((position / duration) * 100) : 0}
          disabled={!duration}
          accessibilityLabel={musicCopy.progress}
          trackColor="rgba(255,255,255,0.18)"
          fillColor={LOGO_COLOR}
          onSeekStart={() => seek.setSeekDragging(true)}
          onSeekPreview={seek.setSeekPreview}
          onSeekRatio={(r) => {
            seek.setSeekPreview(r);
            void seekRatio(r).finally(() => seek.setSeekDragging(false));
          }}
        />
      </View>
      <Text style={[styles.timeText, styles.timeEnd]}>{formatPlaybackClock(duration)}</Text>
    </View>
  );
}
