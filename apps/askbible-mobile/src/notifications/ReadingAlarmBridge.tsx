import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, InteractionManager, Platform } from "react-native";
import type { ReadingReminderMode } from "@/lib/notifications/notification-prefs-types";
import { configureScriptureShellAudioMode } from "../audio/shellAudioMode";
import { useLocale } from "../i18n/LocaleProvider";
import { useMusicPlayback } from "../music/MusicPlaybackContext";
import type { NotificationKind } from "./notification-constants";
import { ReadingAlarmOverlay } from "./ReadingAlarmOverlay";
import {
  startReadingAlarmPreludeMusic,
  stopReadingAlarmPreludeMusic,
} from "./readingAlarmPreludeMusic";
import { resolveAlarmChapterTarget } from "./readingAlarmChapterTarget";
import { warmReadingAlarmPreludePool } from "./readingAlarmPreludeCache";
import {
  type ActiveReadingAlarm,
  getReadingReminderMode,
  shouldStartReadingAlarmAudio,
} from "./readingAlarmPlayback";
import { clearReadPlanFlowTodayLoop, clearPlanFlowSessionActive, isPlanFlowSessionActive } from "../read/read-plan-flow-autoplay";
import { startTodayReadingAlarmScriptureFlow } from "./startTodayReadingAlarmScriptureFlow";
import {
  consumeReadingAlarmTrigger,
  fireNativeReadingAlarmFromNotification,
  isNativeReadingAlarmPreludeActive,
  peekReadingAlarmTrigger,
  stopNativeReadingAlarmSound,
  subscribeReadingAlarmAutoContinue,
  subscribeReadingAlarmDismissed,
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
    const target = targetRef.current;
    if (!target || cancelledRef.current) return false;

    await configureScriptureShellAudioMode();
    await stopReadingAlarmPreludeMusic(playback);
    stopNativeReadingAlarmSound();
    await sleep(300);

    const startedFlow = await startTodayReadingAlarmScriptureFlow(router, {
      bookId: target.bookId,
      chapter: target.chapter,
    });
    if (!startedFlow) return false;

    await new Promise<void>((resolve) => {
      InteractionManager.runAfterInteractions(() => resolve());
    });

    const played = await waitForScripturePlayback(30_000);

    if (!cancelledRef.current && played) {
      setUi(null);
      targetRef.current = null;
    }
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
        router.push("/(tabs)/read");
        return false;
      }

      const target = targetRef.current ?? (await resolveAlarmChapterTarget());
      if (!target) {
        scriptureHandoffStartedRef.current = false;
        return false;
      }
      targetRef.current = target;

      await consumeReadingAlarmTrigger();
      nativeHandoffDoneRef.current = true;
      alarmHandoffLockRef.current = true;

      try {
        const started = await beginTodayReadingFlow();
        if (!started && !cancelledRef.current) {
          router.push("/(tabs)/read");
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
    if (!(await shouldStartReadingAlarmAudio())) return;

    const target = await resolveAlarmChapterTarget();
    if (!target) return;

    sessionActiveRef.current = true;
    cancelledRef.current = false;
    targetRef.current = target;
    setUi({ alarm: target, mode: "music" });

    await warmReadingAlarmPreludePool(playback.tracks);

    if (Platform.OS === "ios") {
      const preludeActive = await isNativeReadingAlarmPreludeActive();
      if (!preludeActive) {
        await startReadingAlarmPreludeMusic(playback);
      }
    } else {
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
    (responseId?: string) => {
      if (responseId) {
        if (handledResponseIds.current.has(responseId)) return;
        handledResponseIds.current.add(responseId);
      }
      fireNativeReadingAlarmFromNotification();
    },
    [],
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
      void handoffRef.current("native");
    });

    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        tryNativeHandoff();
        void tryWakeReadingAlarm();
      }
    });

    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      const kind = notification.request.content.data?.kind as NotificationKind | undefined;
      if (!isReadingReminderKind(kind)) return;
      if (isPlanFlowSessionActive()) return;
      const pb = playbackRef.current;
      if (pb.playing && pb.playbackMode === "scripture") return;
      fireNativeReadingAlarmFromNotification();
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const kind = response.notification.request.content.data?.kind as NotificationKind | undefined;
      if (!isReadingReminderKind(kind)) return;
      if (kind === "reading-alarm-auto-continue") {
        void handoffToAlarmScripture("native");
        return;
      }
      handleReadingReminder(response.notification.request.identifier);
    });

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const kind = response.notification.request.content.data?.kind as NotificationKind | undefined;
      if (!isReadingReminderKind(kind)) return;
      if (kind === "reading-alarm-auto-continue") {
        void handoffToAlarmScripture("native");
        return;
      }
      handleReadingReminder(response.notification.request.identifier);
    });

    return () => {
      retryTimers.forEach(clearTimeout);
      wakeRetryTimers.forEach(clearTimeout);
      clearInterval(pendingPoll);
      dismissSub();
      autoContinueSub();
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
