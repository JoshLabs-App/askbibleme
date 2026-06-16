import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useParchmentColumnMaxWidth } from "./parchmentColumnLayout";
import { t } from "../i18n/site-copy";
import {
  useMusicPlayback,
  type ScriptureAudioRepeatMode,
} from "../music/MusicPlaybackContext";
import {
  normalizeScripturePlaybackRate,
  SCRIPTURE_PLAYBACK_RATES,
} from "../music/music-playback-prefs";
import { MinimalProgressBar } from "../ui/MinimalProgressBar";
import { SHELL_TAB_BAR_ICON } from "../shell/shellChromeIcons";
import { SPLASH_BACKGROUND as LOGO_COLOR } from "../shell/splash-branding.generated";

function formatClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/** 和合本整章朗读：底栏播放钮上方（极简时长 + 进度 + 重复） */
export function ReadScriptureAudioDockStrip() {
  const columnMaxWidth = useParchmentColumnMaxWidth();
  const {
    playing,
    playbackMode,
    readChapterAudioAvailable,
    scripturePreparing,
    scriptureCurrentSec,
    scriptureDurationSec,
    scriptureAudioRepeatMode,
    setScriptureAudioRepeatMode,
    scripturePlaybackRate,
    setScripturePlaybackRate,
    seekRatio,
  } = useMusicPlayback();

  const [dragging, setDragging] = useState(false);
  const [seekVal, setSeekVal] = useState(0);

  const show =
    readChapterAudioAvailable &&
    playbackMode === "scripture" &&
    (playing || scripturePreparing);

  const durOk = scriptureDurationSec > 0.05 && Number.isFinite(scriptureDurationSec);
  const prog = durOk ? clamp01(scriptureCurrentSec / scriptureDurationSec) : 0;
  const progress = dragging ? seekVal : prog;

  const onSeek = useCallback(
    (r: number) => {
      setSeekVal(r);
      void seekRatio(r).finally(() => setDragging(false));
    },
    [seekRatio],
  );

  const cyclePlaybackRate = useCallback(() => {
    const current = normalizeScripturePlaybackRate(scripturePlaybackRate);
    const idx = SCRIPTURE_PLAYBACK_RATES.findIndex((rate) => rate === current);
    const next = SCRIPTURE_PLAYBACK_RATES[(idx + 1) % SCRIPTURE_PLAYBACK_RATES.length] ?? 1;
    void setScripturePlaybackRate(next);
  }, [scripturePlaybackRate, setScripturePlaybackRate]);

  if (!show) return null;

  const cur = formatClock(scriptureCurrentSec);
  const dur = durOk ? formatClock(scriptureDurationSec) : "—";

  const repeatBtn = (mode: Exclude<ScriptureAudioRepeatMode, "off">) => {
    const on = scriptureAudioRepeatMode === mode;
    const label =
      mode === "chapter"
        ? t("playback.scriptureRepeatChapterShort")
        : t("playback.scriptureRepeatBookShort");
    const icon = mode === "chapter" ? "repeat-one" : "menu-book";
    return (
      <Pressable
        key={mode}
        onPress={() => {
          if (!on) setScriptureAudioRepeatMode(mode);
        }}
        hitSlop={6}
        style={({ pressed }) => [styles.repeatBtn, on && styles.repeatBtnActive, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        accessibilityLabel={label}
      >
        <MaterialIcons
          name={icon}
          size={17}
          color={on ? LOGO_COLOR : SHELL_TAB_BAR_ICON}
        />
      </Pressable>
    );
  };

  return (
    <View
      style={[styles.wrap, columnMaxWidth != null ? { maxWidth: columnMaxWidth } : null]}
      accessibilityLabel={t("playback.scriptureDockLabel")}
    >
      <Text style={styles.time} numberOfLines={1}>
        <Text style={styles.timeCur}>{cur}</Text>
        <Text style={styles.timeSep}> / </Text>
        <Text style={styles.timeDur}>{dur}</Text>
      </Text>

      <MinimalProgressBar
        progress={progress}
        disabled={!durOk}
        accessibilityLabel={t("playback.scriptureSeekAria")}
        trackColor="rgba(255,255,255,0.16)"
        fillColor={LOGO_COLOR}
        onSeekStart={() => setDragging(true)}
        onSeekPreview={setSeekVal}
        onSeekRatio={onSeek}
      />

      <View style={styles.repeatRow}>
        <Pressable
          onPress={cyclePlaybackRate}
          hitSlop={6}
          style={({ pressed }) => [styles.speedBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`语音速度 ${scripturePlaybackRate.toFixed(2).replace(/\.00$/, "")}x`}
        >
          <Text style={styles.speedText}>
            {scripturePlaybackRate.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")}x
          </Text>
        </Pressable>
        {repeatBtn("chapter")}
        {repeatBtn("book")}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: "100%",
    borderRadius: 999,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 6,
  },
  time: {
    flexShrink: 0,
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.2,
  },
  timeCur: {
    color: "rgba(255,255,255,0.95)",
  },
  timeSep: {
    color: "rgba(255,255,255,0.45)",
  },
  timeDur: {
    color: "rgba(255,255,255,0.88)",
  },
  repeatRow: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    gap: 4,
  },
  speedBtn: {
    minWidth: 48,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    paddingHorizontal: 8,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  speedText: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.1,
  },
  repeatBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
  repeatBtnActive: {
    backgroundColor: "rgba(255, 177, 1, 0.16)",
  },
  pressed: { opacity: 0.65 },
});
