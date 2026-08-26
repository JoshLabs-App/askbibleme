import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import { t } from "../i18n/site-copy";
import {
  getScripturePlaybackSecSnapshot,
  subscribeScripturePlaybackSec,
} from "../music/scripturePlaybackSec";
import {
  shellPlaybackTransportLayoutStyles as transportLayout,
  shellPlaybackTransportMetrics as tm,
} from "../shell/shellPlaybackTransportLayout";
import { SPLASH_BACKGROUND as LOGO_YELLOW } from "../shell/splash-branding.generated";
import { MinimalProgressBar } from "../ui/MinimalProgressBar";
import { readParchmentTheme as c } from "./readParchmentTheme";

type Props = {
  durationSec: number;
  /** 正在播经或池子活跃：进度条跟播；否则停在 0。 */
  live: boolean;
  seekEnabled: boolean;
  onSeekRatio: (ratio: number) => Promise<void>;
};

function formatClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

/** 播放位置高频推进，但时钟只显示到秒；取整后 React 才重渲染。 */
function useScriptureWholeSec(live: boolean): number {
  const read = () => (live ? Math.floor(getScripturePlaybackSecSnapshot()) : 0);
  return useSyncExternalStore(subscribeScripturePlaybackSec, read, read);
}

/**
 * 读经坞进度轴：对齐音乐页 MusicHomeScrubber。
 * 填充走 Animated.Value（不进 React state）；只有秒数字变化时才重渲染本组件。
 */
export function ReadScriptureDockScrubber({
  durationSec,
  live,
  seekEnabled,
  onSeekRatio,
}: Props) {
  const progressV = useRef(new Animated.Value(0)).current;
  const [dragging, setDragging] = useState(false);
  const [seekPreview, setSeekPreview] = useState(0);
  const draggingRef = useRef(false);
  draggingRef.current = dragging;
  const wholeSec = useScriptureWholeSec(live);
  const durOk = durationSec > 0.05 && Number.isFinite(durationSec);

  useEffect(() => {
    const apply = () => {
      if (draggingRef.current) return;
      const sec = live ? getScripturePlaybackSecSnapshot() : 0;
      progressV.setValue(durOk ? Math.min(1, sec / durationSec) : 0);
    };
    apply();
    return subscribeScripturePlaybackSec(apply);
  }, [durationSec, durOk, live, progressV]);

  useEffect(() => {
    if (dragging) progressV.setValue(seekPreview);
  }, [dragging, progressV, seekPreview]);

  const position = live
    ? dragging
      ? seekPreview * (durationSec || 1)
      : wholeSec
    : 0;

  return (
    <View style={styles.scrubber}>
      <Text style={[styles.timeText, styles.timeStart]}>{formatClock(position)}</Text>
      <View style={styles.scrubberBar}>
        <MinimalProgressBar
          progress={progressV}
          accessibilityPercent={durOk ? Math.round((position / durationSec) * 100) : 0}
          disabled={!seekEnabled}
          accessibilityLabel={t("playback.scriptureSeekAria")}
          trackColor="rgba(92, 64, 48, 0.22)"
          fillColor={LOGO_YELLOW}
          onSeekStart={() => setDragging(true)}
          onSeekPreview={setSeekPreview}
          onSeekRatio={(r) => {
            setSeekPreview(r);
            void onSeekRatio(r).finally(() => setDragging(false));
          }}
        />
      </View>
      <Text style={[styles.timeText, styles.timeEnd]}>
        {durOk ? formatClock(durationSec) : "—:—"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrubber: transportLayout.scrubber,
  scrubberBar: transportLayout.scrubberBar,
  timeStart: transportLayout.timeStart,
  timeEnd: transportLayout.timeEnd,
  timeText: {
    fontSize: tm.timeFontSize,
    ...parchmentSans(500),
    color: c.muted,
    fontVariant: ["tabular-nums"],
  },
});
