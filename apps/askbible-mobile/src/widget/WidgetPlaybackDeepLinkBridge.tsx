import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Linking } from "react-native";
import { useMusicPlaybackOptional } from "../music/MusicPlaybackContext";
import { isTrackPlayable, resolveShellMusicPlayIndex } from "../music/trackArtwork";
import { startTodayReadingScriptureFromReadHome } from "../read/startTodayReadingScriptureFromReadHome";
import { minimizeAfterWidgetPlayback } from "./readingAudioWidget";
import {
  getWidgetVersePlaying,
  parseWidgetPlaybackDeepLink,
  queueWidgetVersePlay,
} from "./widgetPlaybackRequest";

type Props = {
  enabled: boolean;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 冷启动时 getInitialURL 与 url 事件可能各来一次，短窗去重避免 play→pause。 */
let lastHandledPlaybackUrl = "";
let lastHandledPlaybackAt = 0;
let playbackDeepLinkInFlight: string | null = null;
/** 已消费的挂件 URL：普通图标打开时 getInitialURL 仍可能带回旧链，必须跳过。 */
const consumedWidgetPlaybackUrls = new Set<string>();

async function waitUntil(
  predicate: () => boolean,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await sleep(120);
  }
  return predicate();
}

function markWidgetUrlConsumed(url: string): void {
  consumedWidgetPlaybackUrls.add(url);
  if (consumedWidgetPlaybackUrls.size > 20) {
    const first = consumedWidgetPlaybackUrls.values().next().value;
    if (first) consumedWidgetPlaybackUrls.delete(first);
  }
}

/**
 * iOS（及 Android 深链回落）：挂件三键 deep link → 直接开播。
 * askbible://widget/play?action=music|reading|verse&verseKey=
 *
 * 注意：不要把 music context 放进 effect deps——播放进度会频繁换新对象，
 * 导致反复 getInitialURL + toggle，图标一直闪。
 */
export function WidgetPlaybackDeepLinkBridge({ enabled }: Props) {
  const router = useRouter();
  const music = useMusicPlaybackOptional();
  const musicRef = useRef(music);
  musicRef.current = music;
  const routerRef = useRef(router);
  routerRef.current = router;
  const initialHandledRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const run = async (
      url: string | null | undefined,
    ): Promise<"ok" | "retry" | "skip"> => {
      if (!url) return "skip";
      const parsed = parseWidgetPlaybackDeepLink(url);
      if (!parsed) return "skip";
      if (consumedWidgetPlaybackUrls.has(url)) return "skip";
      const latest = musicRef.current;
      if (!latest) return "retry";

      if (parsed.action === "music") {
        if (latest.loading || latest.tracks.length === 0) return "retry";
        const playIdx = resolveShellMusicPlayIndex(latest.tracks, latest.trackIndex);
        const track = latest.tracks[playIdx];
        if (!track || !isTrackPlayable(track)) return "retry";
        const wasPlaying = latest.playbackMode === "music" && latest.playing;
        await latest.togglePlayMusic();
        if (!wasPlaying) {
          await waitUntil(
            () =>
              musicRef.current?.playbackMode === "music" && !!musicRef.current?.playing,
            2500,
          );
        }
        return "ok";
      }

      if (parsed.action === "reading") {
        if (latest.playbackMode === "scripture" && latest.playing) {
          await latest.togglePlayScripture({ forcePause: true });
          return "ok";
        }
        if (latest.playbackMode === "scripture" && !latest.playing) {
          await latest.togglePlayScripture();
          await waitUntil(
            () =>
              musicRef.current?.playbackMode === "scripture" &&
              !!musicRef.current?.playing,
            4000,
          );
          return "ok";
        }
        const started = await startTodayReadingScriptureFromReadHome(routerRef.current, {
          quickStart: true,
          uiHost: "listen",
          loopTodayPlan: true,
        });
        if (!started) return "retry";
        await waitUntil(
          () =>
            musicRef.current?.playbackMode === "scripture" && !!musicRef.current?.playing,
          5000,
        );
        return "ok";
      }

      if (parsed.action === "verse") {
        if (!parsed.verseKey) return "skip";
        // 纯停读经（forcePause），再排队金句；勿走会跳计划页的包装逻辑。
        await latest.togglePlayScripture({ forcePause: true });
        routerRef.current.push("/");
        queueWidgetVersePlay(parsed.verseKey);
        await waitUntil(() => getWidgetVersePlaying(), 5000);
        return "ok";
      }

      return "skip";
    };

    const runWhenReady = async (url: string | null | undefined, timeoutMs: number) => {
      if (!url || !parseWidgetPlaybackDeepLink(url)) return;
      if (consumedWidgetPlaybackUrls.has(url)) return;
      const now = Date.now();
      if (playbackDeepLinkInFlight === url) return;
      if (url === lastHandledPlaybackUrl && now - lastHandledPlaybackAt < 2000) return;
      playbackDeepLinkInFlight = url;
      try {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
          const result = await run(url);
          if (result === "skip") return;
          if (result === "ok") {
            markWidgetUrlConsumed(url);
            lastHandledPlaybackUrl = url;
            lastHandledPlaybackAt = Date.now();
            // 仅成功开播后再回桌面（不要在 toggle 前 minimize）。
            for (const delay of [0, 400, 1200]) {
              void sleep(delay).then(() => minimizeAfterWidgetPlayback());
            }
            return;
          }
          await sleep(120);
        }
      } finally {
        if (playbackDeepLinkInFlight === url) playbackDeepLinkInFlight = null;
      }
    };

    const sub = Linking.addEventListener("url", ({ url }) => {
      void runWhenReady(url, 8000);
    });

    if (!initialHandledRef.current) {
      initialHandledRef.current = true;
      void Linking.getInitialURL().then((url) => {
        // 普通冷启也会拿到上次挂件 URL：若已消费则跳过，避免自动关 + 误 toggle。
        if (!url || consumedWidgetPlaybackUrls.has(url)) return;
        void runWhenReady(url, 10_000);
      });
    }

    return () => {
      sub.remove();
    };
  }, [enabled]);

  return null;
}
