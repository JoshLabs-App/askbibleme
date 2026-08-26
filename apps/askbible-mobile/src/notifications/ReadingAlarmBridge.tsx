import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, InteractionManager } from "react-native";
import type { ReadingReminderMode } from "@/lib/notifications/notification-prefs-types";
import { setShellAudioInterrupted } from "../audio/shellAudioInterruption";
import { useLocale } from "../i18n/LocaleProvider";
import { useMusicPlayback } from "../music/MusicPlaybackContext";
import type { NotificationKind } from "./notification-constants";
import { ReadingAlarmOverlay } from "./ReadingAlarmOverlay";
import {
  startReadingAlarmPreludeMusic,
  stopReadingAlarmPreludeMusic,
} from "./readingAlarmPreludeMusic";
import { resolveAlarmChapterTarget } from "./readingAlarmChapterTarget";
import { resolveDailyVerseForDate } from "./resolve-daily-verse-for-date";
import { warmReadingAlarmPreludePool } from "./readingAlarmPreludeCache";
import {
  type ActiveReadingAlarm,
  getReadingReminderMode,
  shouldStartReadingAlarmAudio,
} from "./readingAlarmPlayback";
import { clearReadPlanFlowTodayLoop, clearPlanFlowSessionActive, isPlanFlowSessionActive } from "../read/read-plan-flow-autoplay";
import { replaceReadPlanPlay } from "../read/read-plan-flow-nav";
import { scriptureCommandEndHold } from "../music/scriptureCommands";
import { startTodayReadingAlarmScriptureFlow } from "./startTodayReadingAlarmScriptureFlow";
import {
  consumeReadingAlarmTrigger,
  fireNativeReadingAlarmFromNotification,
  isNativeReadingAlarmPreludeActive,
  peekReadingAlarmTrigger,
  stopNativeReadingAlarmSound,
  subscribeReadingAlarmAutoContinue,
  subscribeReadingAlarmDismissed,
  subscribeReadingAlarmPreludeSession,
} from "./syncAndroidReadingAlarmSchedule";
import { tryWakeReadingAlarmOnActive } from "./readingAlarmIosWake";
import { runQueuedReadingAlarmDevE2E } from "./readingAlarmDevE2ERunner";

type Props = {
  enabled: boolean;
};

type AlarmUiState = {
  alarm: ActiveReadingAlarm;
  mode: ReadingReminderMode;
};

type HandoffSource = "native" | "prelude";

const ALARM_SCRIPTURE_RETRY_MS = [500, 1000, 2000, 4000, 7000, 12_000, 20_000];

function isReadingReminderKind(kind: NotificationKind | undefined): boolean {
  return kind === "reading-reminder" || kind === "reading-alarm-auto-continue";
}

function isSoftReadingReminderDelivery(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  return (data as { delivery?: string }).delivery === "notification";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntilCancelled(isCancelled: () => boolean): Promise<void> {
  while (!isCancelled()) {
    await sleep(400);
  }
}

export function ReadingAlarmBridge({ enabled }: Props) {
  const router = useRouter();
  const { locale } = useLocale();
  const playback = useMusicPlayback();
  const [ui, setUi] = useState<AlarmUiState | null>(null);
  const handledResponseIds = useRef<Set<string>>(new Set());
  const scriptureHandoffStartedRef = useRef(false);
  const alarmHandoffLockRef = useRef(false);
  const sessionActiveRef = useRef(false);
  const cancelledRef = useRef(false);
  const targetRef = useRef<ActiveReadingAlarm | null>(null);
  const nativeHandoffDoneRef = useRef(false);
  const playbackRef = useRef(playback);
  playbackRef.current = playback;

  const stopAllAlarmAudio = useCallback(async () => {
    await stopReadingAlarmPreludeMusic(playback);
    stopNativeReadingAlarmSound();
    scriptureCommandEndHold("alarm-prelude");
    const pb = playbackRef.current;
    if (pb.playbackMode === "scripture" || pb.scripturePreparing) {
      try {
        await pb.stopScripturePlayback();
      } catch {
        /* ignore */
      }
    }
  }, [playback]);

  const clearSession = useCallback(async () => {
    cancelledRef.current = true;
    sessionActiveRef.current = false;
    scriptureHandoffStartedRef.current = false;
    alarmHandoffLockRef.current = false;
    nativeHandoffDoneRef.current = true;
    targetRef.current = null;
    clearReadPlanFlowTodayLoop();
    clearPlanFlowSessionActive();
    scriptureCommandEndHold("alarm-prelude");
    await stopAllAlarmAudio();
    setUi(null);
  }, [stopAllAlarmAudio]);

  const waitForScripturePlayback = useCallback(async (timeoutMs = 30_000): Promise<boolean> => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (cancelledRef.current) return false;
      const pb = playbackRef.current;
      if (pb.playing && pb.playbackMode === "scripture") return true;
      await sleep(400);
    }
    const pb = playbackRef.current;
    return pb.playing && pb.playbackMode === "scripture";
  }, []);

  const beginTodayReadingFlow = useCallback(async (): Promise<boolean> => {
    if (cancelledRef.current) return false;
    const target = targetRef.current;

    // 安卓原生读经会自己占会话。这里若先走 expo-av setAudioMode，
    // 三星会 setSpeakerphoneOn，被误当成通话，章页出来却没声，之后音乐也哑。
    setShellAudioInterrupted(false);
    // 预备阶段可能 hold 了读经暂停；开播前必须释放。
    scriptureCommandEndHold("alarm-prelude");
    await stopReadingAlarmPreludeMusic(playback);
    stopNativeReadingAlarmSound();
    await sleep(300);

    const startedFlow = await startTodayReadingAlarmScriptureFlow(
      router,
      target ? { bookId: target.bookId, chapter: target.chapter } : null,
    );
    if (!startedFlow) {
      scriptureCommandEndHold("alarm-prelude");
      return false;
    }

    await new Promise<void>((resolve) => {
      InteractionManager.runAfterInteractions(() => resolve());
    });

    const played = await waitForScripturePlayback(30_000);

    if (!cancelledRef.current && played) {
      setUi(null);
      targetRef.current = null;
    }
    if (!played) scriptureCommandEndHold("alarm-prelude");
    return played;
  }, [playback, router, waitForScripturePlayback]);

  const handoffToAlarmScripture = useCallback(
    async (source: HandoffSource): Promise<boolean> => {
      if (
        alarmHandoffLockRef.current ||
        scriptureHandoffStartedRef.current ||
        cancelledRef.current
      ) {
        return false;
      }

      if (source === "native") {
        const pending = await peekReadingAlarmTrigger();
        if (!pending) return false;
      }

      scriptureHandoffStartedRef.current = true;
      sessionActiveRef.current = false;
      cancelledRef.current = false;

      if (!(await shouldStartReadingAlarmAudio())) {
        scriptureHandoffStartedRef.current = false;
        scriptureCommandEndHold("alarm-prelude");
        replaceReadPlanPlay(router);
        return false;
      }

      targetRef.current = targetRef.current ?? (await resolveAlarmChapterTarget());
      nativeHandoffDoneRef.current = true;
      alarmHandoffLockRef.current = true;

      try {
        const started = await beginTodayReadingFlow();
        if (started) {
          await consumeReadingAlarmTrigger();
        } else if (!cancelledRef.current) {
          scriptureCommandEndHold("alarm-prelude");
          replaceReadPlanPlay(router);
        }
        return started;
      } finally {
        alarmHandoffLockRef.current = false;
        scriptureHandoffStartedRef.current = false;
        sessionActiveRef.current = false;
      }
    },
    [beginTodayReadingFlow, router],
  );

  const dismissAlarm = useCallback(async () => {
    await clearSession();
  }, [clearSession]);

  const handoffRef = useRef(handoffToAlarmScripture);
  handoffRef.current = handoffToAlarmScripture;
  const dismissRef = useRef(dismissAlarm);
  dismissRef.current = dismissAlarm;

  const runMusicAlarmSession = useCallback(async () => {
    if (sessionActiveRef.current || scriptureHandoffStartedRef.current) return;
    // 原生已经在响时，即使 JS 偏好还没读到也要挂停止条。
    const preludeActive = await isNativeReadingAlarmPreludeActive();
    if (!preludeActive && !(await shouldStartReadingAlarmAudio())) return;

    const target = (await resolveAlarmChapterTarget()) ?? {
      bookId: "",
      chapter: 1,
      bookName: "",
      translationId: "cuv-simp",
      label: "",
    };
    const verse = await resolveDailyVerseForDate().catch(() => null);
    if (verse?.lines.length) {
      target.verseText = verse.lines.filter(Boolean).join("\n");
      target.verseRef = verse.ref;
    }

    sessionActiveRef.current = true;
    cancelledRef.current = false;
    targetRef.current = target;
    setUi({ alarm: target, mode: "music" });

    await warmReadingAlarmPreludePool(playback.tracks);

    // 原生已经在播时只挂停止条，不要再 startPrelude，否则会清会话并重开一首。
    if (!preludeActive) {
      await startReadingAlarmPreludeMusic(playback);
    }

    await waitUntilCancelled(() => cancelledRef.current);

    sessionActiveRef.current = false;
    targetRef.current = null;
    setUi(null);
  }, [playback]);

  const triggerReadingAlarm = useCallback(async () => {
    const mode = await getReadingReminderMode();
    if (mode === "scripture") {
      fireNativeReadingAlarmFromNotification();
      return;
    }
    await runMusicAlarmSession();
  }, [runMusicAlarmSession]);

  const handleReadingReminder = useCallback(
    (responseId?: string, soft = false) => {
      if (responseId) {
        if (handledResponseIds.current.has(responseId)) return;
        handledResponseIds.current.add(responseId);
      }
      if (soft) {
        router.push("/read");
        return;
      }
      fireNativeReadingAlarmFromNotification();
    },
    [router],
  );

  const joinNativePreludeSession = useCallback(async () => {
    const mode = await getReadingReminderMode();
    if (mode === "scripture") {
      void handoffToAlarmScripture("native");
      return;
    }
    await runMusicAlarmSession();
  }, [handoffToAlarmScripture, runMusicAlarmSession]);

  const tryWakeReadingAlarm = useCallback(async () => {
    const wake = await tryWakeReadingAlarmOnActive();
    if (wake === "started") {
      void triggerReadingAlarm();
      return;
    }
    if (wake === "prelude-sync") {
      void joinNativePreludeSession();
      return;
    }
    if (wake === "handoff") {
      void handoffToAlarmScripture("native");
    }
  }, [handoffToAlarmScripture, joinNativePreludeSession, triggerReadingAlarm]);

  useEffect(() => {
    if (!enabled) return;
    if (__DEV__) void runQueuedReadingAlarmDevE2E();

    const tryNativeHandoff = () => {
      if (nativeHandoffDoneRef.current || alarmHandoffLockRef.current || scriptureHandoffStartedRef.current) {
        return;
      }
      const pb = playbackRef.current;
      if (pb.playing && pb.playbackMode === "scripture") {
        nativeHandoffDoneRef.current = true;
        void consumeReadingAlarmTrigger();
        return;
      }
      void peekReadingAlarmTrigger().then((pending) => {
        if (!pending || nativeHandoffDoneRef.current || alarmHandoffLockRef.current) return;
        void handoffRef.current("native");
      });
    };

    tryNativeHandoff();
    void tryWakeReadingAlarm();

    const retryTimers = ALARM_SCRIPTURE_RETRY_MS.map((ms) => setTimeout(tryNativeHandoff, ms));
    const wakeRetryTimers = ALARM_SCRIPTURE_RETRY_MS.map((ms) =>
      setTimeout(() => {
        void tryWakeReadingAlarm();
      }, ms),
    );
    const pendingPoll = setInterval(tryNativeHandoff, 3000);

    const dismissSub = subscribeReadingAlarmDismissed(() => {
      void dismissRef.current();
    });

    const autoContinueSub = subscribeReadingAlarmAutoContinue(() => {
      // 原生事件本身就是交接信号，不要再等 pending 标记（apply 可能还没落盘）。
      void handoffRef.current("prelude");
    });

    const preludeSub = subscribeReadingAlarmPreludeSession(() => {
      void joinNativePreludeSession();
    });

    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        tryNativeHandoff();
        void tryWakeReadingAlarm();
      }
    });

    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data;
      const kind = data?.kind as NotificationKind | undefined;
      if (!isReadingReminderKind(kind)) return;
      if (isSoftReadingReminderDelivery(data)) return;
      if (isPlanFlowSessionActive()) return;
      const pb = playbackRef.current;
      if (pb.playing && pb.playbackMode === "scripture") return;
      fireNativeReadingAlarmFromNotification();
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      const kind = data?.kind as NotificationKind | undefined;
      if (!isReadingReminderKind(kind)) return;
      if (kind === "reading-alarm-auto-continue") {
        void handoffToAlarmScripture("native");
        return;
      }
      handleReadingReminder(
        response.notification.request.identifier,
        isSoftReadingReminderDelivery(data),
      );
    });

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data = response.notification.request.content.data;
      const kind = data?.kind as NotificationKind | undefined;
      if (!isReadingReminderKind(kind)) return;
      if (kind === "reading-alarm-auto-continue") {
        void handoffToAlarmScripture("native");
        return;
      }
      handleReadingReminder(
        response.notification.request.identifier,
        isSoftReadingReminderDelivery(data),
      );
    });

    return () => {
      retryTimers.forEach(clearTimeout);
      wakeRetryTimers.forEach(clearTimeout);
      clearInterval(pendingPoll);
      dismissSub();
      autoContinueSub();
      preludeSub();
      appStateSub.remove();
      receivedSub.remove();
      responseSub.remove();
    };
  }, [enabled, handleReadingReminder, handoffToAlarmScripture, joinNativePreludeSession, triggerReadingAlarm, tryWakeReadingAlarm]);

  if (!ui) return null;

  return (
    <ReadingAlarmOverlay
      locale={locale}
      alarm={ui.alarm}
      mode={ui.mode}
      onDismiss={() => {
        void dismissAlarm();
      }}
    />
  );
}
