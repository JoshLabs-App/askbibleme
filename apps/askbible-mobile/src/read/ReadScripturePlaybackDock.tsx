import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { t } from "../i18n/site-copy";
import { MusicRepeatAllIcon, MusicRepeatOneIcon } from "../music/MusicHomeControlIcons";
import { useMusicPlaybackOptional } from "../music/MusicPlaybackContext";
import { nextScripturePlaybackRate } from "../music/music-playback-prefs";
import { scriptureChapterPool } from "../music/scripture-chapter-pool";
import {
  shellPlaybackDockChrome,
  shellPlaybackTransportLayoutStyles as transportLayout,
  shellPlaybackTransportMetrics as tm,
} from "../shell/shellPlaybackTransportLayout";
import { SPLASH_BACKGROUND as LOGO_YELLOW } from "../shell/splash-branding.generated";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { ReadScriptureDockScrubber } from "./ReadScriptureDockScrubber";
import { ScriptureSpeedRateIcon } from "./ScriptureSpeedRateIcon";

const BTN_HIT_SLOP = { top: 14, bottom: 14, left: 12, right: 12 } as const;

function subscribePool(onStoreChange: () => void): () => void {
  return scriptureChapterPool.subscribe(onStoreChange);
}

function getPoolVersion(): number {
  return scriptureChapterPool.getVersion();
}

type LoopMode = "off" | "chapter" | "all";

type Props = {
  visible?: boolean;
  busy?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  columnMaxWidth?: number | null;
  onTogglePlay: () => void;
  onNext: () => void;
  onRead: () => void;
  /** 左侧键无障碍文案；默认「阅读」。 */
  readAccessibilityLabel?: string;
  /** 左侧键图标；默认 menu-book（计划页「阅读」）。 */
  readIconName?: keyof typeof MaterialIcons.glyphMap;
};

/** 计划播放页与读经章页共用的读经播放条。 */
export function ReadScripturePlaybackDock({
  visible = true,
  busy = false,
  disabled = false,
  style,
  columnMaxWidth,
  onTogglePlay,
  onNext,
  onRead,
  readAccessibilityLabel,
  readIconName = "menu-book",
}: Props) {
  const playback = useMusicPlaybackOptional();
  const poolVersion = useSyncExternalStore(subscribePool, getPoolVersion, () => 0);
  void poolVersion;
  const poolLoop = scriptureChapterPool.getLoop();
  const poolActive = scriptureChapterPool.isActive();

  const playing = Boolean(
    playback && playback.playbackMode === "scripture" && playback.playing,
  );
  const preparing = Boolean(
    playback &&
      playback.playbackMode === "scripture" &&
      playback.scripturePreparing &&
      !playback.playing,
  );
  const durationSec = playback?.scriptureDurationSec ?? 0;
  const durOk = durationSec > 0.05 && Number.isFinite(durationSec);
  const live = playing || poolActive;
  const seekEnabled = Boolean(playback && live && durOk);
  const rate = playback?.scripturePlaybackRate ?? 1;
  const rateLabel = rate.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");

  const chapterLoopOn = playback?.scriptureAudioRepeatMode === "chapter";
  const allOn = poolActive ? poolLoop : playback?.scriptureAudioRepeatMode === "book";
  const loopMode: LoopMode = chapterLoopOn ? "chapter" : allOn ? "all" : "off";

  const onSeek = useCallback(
    (ratio: number) => playback?.seekRatio(ratio) ?? Promise.resolve(),
    [playback],
  );

  const onCycleRate = useCallback(() => {
    if (!playback) return;
    void playback.setScripturePlaybackRate(nextScripturePlaybackRate(playback.scripturePlaybackRate));
  }, [playback]);

  const onCycleLoop = useCallback(() => {
    const next: LoopMode = loopMode === "off" ? "chapter" : loopMode === "chapter" ? "all" : "off";
    playback?.setScriptureAudioRepeatMode(
      next === "chapter" ? "chapter" : next === "all" && !poolActive ? "book" : "off",
    );
    scriptureChapterPool.setLoop(next === "all" && poolActive);
  }, [loopMode, playback, poolActive]);

  const loopLabel = useMemo(() => {
    if (loopMode === "chapter") return t("pages.read.planPlayRepeatChapter");
    if (loopMode === "all") {
      return poolActive
        ? t("pages.read.planPlayRepeatPool")
        : t("playback.scriptureRepeatBookShort");
    }
    return t("pages.read.planPlayRepeatOff");
  }, [loopMode, poolActive]);

  if (!visible) return null;

  const playLocked = disabled || busy;

  return (
    <View
      style={[
        styles.wrap,
        columnMaxWidth != null ? { maxWidth: columnMaxWidth } : null,
        style,
      ]}
      accessibilityLabel={t("playback.scriptureDockLabel")}
    >
      <ReadScriptureDockScrubber
        durationSec={durationSec}
        live={live}
        seekEnabled={seekEnabled}
        onSeekRatio={onSeek}
      />

      <View style={styles.transport}>
        <Pressable
          onPress={onRead}
          disabled={disabled}
          hitSlop={BTN_HIT_SLOP}
          style={({ pressed }) => [
            styles.loopBtn,
            disabled && styles.transportDisabled,
            pressed && !disabled && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            readAccessibilityLabel ?? t("pages.read.planPlayReadChapter")
          }
        >
          <MaterialIcons name={readIconName} size={tm.loopIconSize} color={c.ink} />
        </Pressable>

        <View style={styles.transportMain}>
          <Pressable
            onPress={onCycleRate}
            disabled={!playback}
            hitSlop={BTN_HIT_SLOP}
            style={({ pressed }) => [
              styles.speedBtn,
              !playback && styles.transportDisabled,
              pressed && playback && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`语音速度 ${rateLabel}x`}
          >
            <ScriptureSpeedRateIcon rate={rate} color={c.ink} />
          </Pressable>

          <Pressable
            onPress={onTogglePlay}
            disabled={playLocked}
            hitSlop={BTN_HIT_SLOP}
            style={({ pressed }) => [
              styles.playBtn,
              playing && styles.playBtnPlaying,
              playLocked && styles.transportDisabled,
              pressed && !playLocked && styles.playBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              preparing
                ? t("pages.read.chapterAudioPreparing")
                : playing
                  ? t("pages.read.chapterAudioPause")
                  : t("pages.read.planPlayPlay")
            }
            accessibilityState={{ selected: playing, busy: preparing }}
          >
            {busy || preparing ? (
              <ActivityIndicator color={playing ? c.ink : c.surfaceSolid} />
            ) : (
              <MaterialIcons
                name={playing ? "pause" : "play-arrow"}
                size={tm.playIconSize}
                color={playing ? c.ink : c.surfaceSolid}
                style={playing ? undefined : styles.playIcon}
              />
            )}
          </Pressable>

          <Pressable
            onPress={onCycleLoop}
            hitSlop={BTN_HIT_SLOP}
            style={({ pressed }) => [
              styles.loopBtn,
              loopMode !== "off" && styles.loopBtnOn,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: loopMode !== "off" }}
            accessibilityLabel={loopLabel}
          >
            {loopMode === "chapter" ? (
              <MusicRepeatOneIcon size={tm.loopIconSize} color={c.ink} />
            ) : (
              <MusicRepeatAllIcon
                size={tm.loopIconSize}
                color={loopMode === "all" ? c.ink : c.muted}
              />
            )}
          </Pressable>
        </View>

        <Pressable
          onPress={onNext}
          disabled={playLocked}
          hitSlop={BTN_HIT_SLOP}
          style={({ pressed }) => [
            styles.transportBtn,
            playLocked && styles.transportDisabled,
            pressed && !playLocked && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t("pages.read.planPlayNextChapter")}
        >
          <MaterialIcons name="skip-next" size={tm.skipIconSize} color={c.ink} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    zIndex: 1,
    width: "100%",
    alignSelf: "center",
    paddingTop: shellPlaybackDockChrome.paddingTop,
    paddingHorizontal: shellPlaybackDockChrome.paddingHorizontal,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    backgroundColor: "transparent",
  },
  transport: transportLayout.transport,
  transportMain: transportLayout.transportMain,
  loopBtn: transportLayout.loopBtn,
  loopBtnOn: {
    backgroundColor: "rgba(92, 64, 48, 0.1)",
  },
  speedBtn: {
    minWidth: tm.speedBtnSize,
    height: tm.transportBtnSize,
    alignItems: "center",
    justifyContent: "center",
  },
  transportBtn: transportLayout.transportBtn,
  playBtn: {
    ...transportLayout.playBtn,
    backgroundColor: c.ink,
  },
  playBtnPlaying: {
    backgroundColor: LOGO_YELLOW,
  },
  playBtnPressed: transportLayout.playBtnPressed,
  playIcon: transportLayout.playIcon,
  transportDisabled: transportLayout.transportDisabled,
  pressed: { opacity: 0.88 },
});
