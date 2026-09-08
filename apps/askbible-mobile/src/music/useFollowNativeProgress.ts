import { useEffect } from "react";
import { usePlaybackSnapshot } from "../audio/playbackState";
import { setShellMusicWantPlaying } from "../audio/shellMusicWantPlaying";
import { syncPlaybackWidgetForceIdleMusic } from "../widget/readingAudioWidget";
import { noteScriptureListenProgress } from "../read/scripture-listen-totals";
import { publishScripturePlaybackSec, setScripturePlaybackClockPlaying } from "./scripturePlaybackSec";

type Args = {
  setMusicCurrentSec?: (sec: number) => void;
  setMusicDurationSec?: (sec: number) => void;
  setScriptureCurrentSec?: (sec: number) => void;
  setScriptureDurationSec?: (sec: number) => void;
  scripturePlaybackRateRef?: { current: number };
};

/**
 * 把原生上报的进度写给界面（进度轴、时钟、跟读高亮）。
 *
 * 取代了 `useMusicNativeTakeover` 里那段进度处理：它监听一个笼统的 `ShellMediaNativeProgress`
 * 事件，再靠载荷里的 `kind` 字段猜这条进度属于音乐还是读经，还要防着金句和环境音的进度
 * 误点亮音乐黄标。原生按流上报之后，音乐的进度就在 `music` 里、读经的在 `scripture` 里，
 * 不存在归属问题，也就不需要那些猜测和防御。
 */
export function useFollowNativeProgress({
  setMusicCurrentSec,
  setMusicDurationSec,
  setScriptureCurrentSec,
  setScriptureDurationSec,
  scripturePlaybackRateRef,
}: Args): void {
  const { music, scripture } = usePlaybackSnapshot();

  useEffect(() => {
    if (music.positionSec >= 0) setMusicCurrentSec?.(music.positionSec);
    if (music.durationSec > 0) setMusicDurationSec?.(music.durationSec);
  }, [music.positionSec, music.durationSec, setMusicCurrentSec, setMusicDurationSec]);

  useEffect(() => {
    if (scripture.positionSec >= 0) {
      publishScripturePlaybackSec(scripture.positionSec);
      setScriptureCurrentSec?.(scripture.positionSec);
    }
    /** 累计听读时长（探索页那个数字）就靠这条进度累加。 */
    noteScriptureListenProgress(scripture.positionSec, scripture.playing);
    if (scripture.durationSec > 0) setScriptureDurationSec?.(scripture.durationSec);
    /** 跟读高亮靠这个时钟推进；语速影响它的外推速度。 */
    setScripturePlaybackClockPlaying(scripture.playing, scripturePlaybackRateRef?.current ?? 1);
  }, [
    scripture.positionSec,
    scripture.durationSec,
    scripture.playing,
    setScriptureCurrentSec,
    setScriptureDurationSec,
    scripturePlaybackRateRef,
  ]);

  /*
   * 音乐彻底结束（队列播完、原生清掉了音轨）时清掉 JS 的播放意图。
   * 不清的话首页音乐图标会一直亮着——`isShellMusicOn` 把 wantPlaying 也算作「亮」。
   * 这件事原先由 ShellMediaNativeStopped 事件触发，现在直接看状态：没有音轨即结束。
   */
  useEffect(() => {
    if (music.uri != null || music.wantPlaying === false) return;
    setShellMusicWantPlaying(false);
    syncPlaybackWidgetForceIdleMusic();
  }, [music.uri, music.wantPlaying]);
}
