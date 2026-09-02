import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getScriptureBookDisplayName } from "../bible/scripture-book-display-name";
import { parchmentSans } from "../fonts/parchmentType";
import { t, tFormat } from "../i18n/site-copy";
import { useLocale } from "../i18n/LocaleProvider";
import { scriptureCommandSkipNext } from "../music/scriptureCommands";
import { scriptureChapterPool } from "../music/scripture-chapter-pool";
import { useMusicPlaybackOptional } from "../music/MusicPlaybackContext";
import { shellPlaybackDockBottomPad } from "../shell/shellPlaybackTransportLayout";
import { SPLASH_BACKGROUND as LOGO_YELLOW } from "../shell/splash-branding.generated";
import { buildScriptureChapterPool } from "./build-scripture-chapter-pool";
import {
  PARCHMENT_COLUMN_MAX_WIDTH_PHONE,
  useParchmentColumnMaxWidth,
  useReadPagePaddingHorizontal,
} from "./parchmentColumnLayout";
import { ReadPlanPlayMonthCalendar } from "./ReadPlanPlayMonthCalendar";
import { ReadNtDeepRepeatStagesBelowToday } from "./ReadNtDeepRepeatStagesBelowToday";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { warmScriptureSearchDatabase } from "../bible/scripture-database";
import { ReadScripturePlaybackDock } from "./ReadScripturePlaybackDock";
import { useReadBibleTypography } from "./ReadBibleTypographyContext";
import { readScriptureSearchRoute } from "./readScriptureSearchRoute";
import { readPlanFlowChapterAudioPrefs } from "./read-plan-flow-audio-prefs";
import { clearPlanFlowUiHost, getPlanFlowUiHost, setPlanFlowUiHost } from "./read-plan-flow-autoplay";
import { buildPlanChapterQueue } from "./read-plan-flow-nav";
import { prefetchTodayReadingPlanQueueAudio } from "./prefetch-plan-flow-chapter-audio";
import {
  readAheadDays,
  setReadingPlanAheadDays,
} from "./reading-plan/reading-plan-ahead";
import { resolvePlanPlayContentAhead } from "@/lib/read/plan-play-content-ahead";
import {
  loadReadingPlanPayloadAtAhead,
  todayReadingPayloadMatchesPrefs,
} from "./reading-plan/today-reading-plan-payload";
import { resolveLocalTodayReadingScopeKeyFromPrefs } from "./reading-plan/today-reading-done";
import {
  readTodayPlanScriptureResume,
  resolveTodayPlanScriptureStartTargetFromSaved,
} from "./today-plan-scripture-resume";
import { startTodayReadingScriptureFromReadHome } from "./startTodayReadingScriptureFromReadHome";
import {
  getEmptyPlanPlayListenedDates,
  getPlanPlayListenedDates,
  markPlanPlayListenedDate,
  subscribePlanPlayListenedDates,
} from "./plan-play-listened-dates";
import { useReadingHabitStats } from "./useReadingHabitStats";
import { toLocalDateString } from "./reading-plan/reading-plan-prefs";
import { planTitleKey, useTodayReadingPlan } from "./useTodayReadingPlan";
import type { TodayReadingPlanPayload } from "./reading-plan/today-reading-plan-payload";

function subscribePool(onStoreChange: () => void): () => void {
  return scriptureChapterPool.subscribe(onStoreChange);
}

function getPoolVersion(): number {
  return scriptureChapterPool.getVersion();
}

/**
 * 今日读经计划播放器：上方日历+列表整页滚动，下方播放坞固定。
 * 职责：把「计划配置（plan.prefs）→ 当日该读的章节（queue）→ 是否正在播放（scriptureChapterPool）」
 *   串起来，支持浏览未来/过去日期（viewAhead）而不影响真实进度，直到用户显式确认（onConfirmDay）。
 * 边界：不直接操作音频播放器，只通过 scriptureChapterPool / MusicPlaybackContext 下达指令；
 *   不持久化计划配置，只读取并在用户确认时调用 setReadingPlanAheadDays 落盘。
 * 交互模块：scriptureChapterPool（真正播放中的章节队列，全局单例）、useTodayReadingPlan
 *   （计划配置与今日 payload）、ReadScripturePlaybackDock（底部播放坞 UI）。
 * queue 与 scriptureChapterPool 是两份独立状态：前者是本页“正在看”的章节列表（可能是在浏览
 * 别的日期），后者是全局“正在播”的队列；两者是否一致（poolMatchesViewedQueue）决定了
 * activeIndex 用谁的游标，以及操作是走 pool 命令还是重新 startFromIndex 建池。
 */
export function ReadPlanPlayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { locale } = useLocale();
  const { primaryTranslationId } = useReadBibleTypography();
  const playback = useMusicPlaybackOptional();
  const padX = useReadPagePaddingHorizontal();
  const columnMaxWidth = useParchmentColumnMaxWidth(PARCHMENT_COLUMN_MAX_WIDTH_PHONE);
  const plan = useTodayReadingPlan([]);
  const [cursor, setCursor] = useState(0);
  const [starting, setStarting] = useState(false);
  const [viewAhead, setViewAhead] = useState(0);
  const [browsePayload, setBrowsePayload] = useState<TodayReadingPlanPayload | null>(null);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const browsePayloadRef = useRef<TodayReadingPlanPayload | null>(null);
  browsePayloadRef.current = browsePayload;

  // 焦点绑定 listen：进圣经章页时 blur 清掉，避免坞/朗读仍钉死计划池当前章。
  useFocusEffect(
    useCallback(() => {
      setPlanFlowUiHost("listen");
      return () => {
        if (getPlanFlowUiHost() === "listen") clearPlanFlowUiHost();
      };
    }, []),
  );


  // 切换计划（planId 变化）时清掉浏览缓存的 payload，防止显示上一个计划的章节列表。
  useEffect(() => {
    setBrowsePayload((prev) =>
      prev && todayReadingPayloadMatchesPrefs(prev, plan.prefs) ? prev : null,
    );
  }, [plan.prefs.planId]);

  const committedAhead = readAheadDays(plan.prefs);
  /**
   * 黑底 = 系统今天。aheadDays 平移整本日历池：今天 / 明天 / 昨天都加同一偏移。
   */
  const contentAhead = resolvePlanPlayContentAhead(viewAhead, committedAhead);
  const browsingAway = contentAhead !== committedAhead;
  /** 点选今天之后的日期时可确认：把进度调到该日对应内容。 */
  const needsConfirm = browsingAway && viewAhead >= 0;

  useEffect(() => {
    let cancelled = false;
    // 已有内容时后台刷新，勿先插 spinner 把布局顶乱（进出页会像跳动）。
    if (browsePayloadRef.current == null) setBrowseLoading(true);
    void loadReadingPlanPayloadAtAhead(plan.prefs, contentAhead, {
      dayCount: plan.dayCount ?? plan.prefs.dayCount,
    })
      .then((payload) => {
        if (cancelled) return;
        setBrowsePayload(payload);
        setBrowseLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setBrowseLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contentAhead, plan.calendarEpochDay, plan.dayCount, plan.prefs]);

  // 订阅全局章节播放池（scriptureChapterPool）以感知外部（如锁屏/其他页）发起的切章；
  // poolVersion 本身不直接读，只用于强制该组件在池变化时重渲染。
  const poolVersion = useSyncExternalStore(subscribePool, getPoolVersion, () => 0);
  const poolActive = scriptureChapterPool.isActive();
  const poolIndex = scriptureChapterPool.getIndex();
  const poolTracks = scriptureChapterPool.getTracks();
  void poolVersion;

  // 决定本页列表用哪份数据源：若全局播放池的曲目与当前计划内容完全一致（顺序/章节都对得上）
  // 且未在浏览别的日期，则直接复用池的 tracks（含 lazySrc 解析结果），
  // 否则退回按 plan/browsePayload 现算的 planned 列表（尚未建池，仅用于展示与后续 startFromIndex）。
  const queue = useMemo(() => {
    const titleFor = (bookId: string, chapter: number) =>
      `${getScriptureBookDisplayName(bookId, locale)} ${chapter}`;
    const readings = browsePayload?.day?.readings ?? plan.payload?.day?.readings ?? [];
    const planned = buildPlanChapterQueue(readings).map((ref) => ({
      bookId: ref.bookId,
      chapter: ref.chapter,
      title: titleFor(ref.bookId, ref.chapter),
    }));
    const poolMatchesPlan =
      poolTracks.length > 0 &&
      poolTracks.length === planned.length &&
      poolTracks.every(
        (track, i) =>
          track.bookId === planned[i]?.bookId && track.chapter === planned[i]?.chapter,
      );
    const usePoolList =
      poolMatchesPlan &&
      !browsingAway &&
      todayReadingPayloadMatchesPrefs(plan.payload, plan.prefs);
    if (usePoolList) {
      return poolTracks.map((track) => ({
        bookId: track.bookId,
        chapter: track.chapter,
        title: titleFor(track.bookId, track.chapter),
      }));
    }
    return planned;
  }, [
    browsePayload?.day?.readings,
    browsingAway,
    locale,
    plan.payload,
    plan.prefs,
    poolTracks,
  ]);

  const isScripturePlaying = Boolean(
    playback && playback.playbackMode === "scripture" && playback.playing,
  );
  const isPreparing = Boolean(
    playback &&
      playback.playbackMode === "scripture" &&
      playback.scripturePreparing &&
      !playback.playing,
  );

  const poolMatchesViewedQueue =
    poolActive &&
    poolTracks.length > 0 &&
    poolTracks.length === queue.length &&
    poolTracks.every(
      (track, i) =>
        track.bookId === queue[i]?.bookId && track.chapter === queue[i]?.chapter,
    );
  const activeIndex = poolMatchesViewedQueue ? poolIndex : cursor;

  // 池在播时游标跟随池索引，保证锁屏/其他页切章时本页高亮同步移动。
  // 仅当池内容与本页正在浏览的 queue 一致时才跟：否则用户在看另一天的计划、
  // 而别处（如锁屏续播了今日计划）在播，会把 poolIndex 错写成本页 queue 的下标。
  useEffect(() => {
    if (poolActive && poolMatchesViewedQueue) setCursor(poolIndex);
  }, [poolActive, poolIndex, poolMatchesViewedQueue]);

  // 池未在播（尚未开始收听）时，尝试从上次保存的断点恢复游标位置，
  // 让用户回到本页时能续听而非总是从第一章开始。
  useEffect(() => {
    if (poolActive || queue.length === 0) return;
    let cancelled = false;
    void (async () => {
      const scopeKey = resolveLocalTodayReadingScopeKeyFromPrefs(plan.prefs);
      const saved = await readTodayPlanScriptureResume();
      const start = resolveTodayPlanScriptureStartTargetFromSaved(queue, scopeKey, saved);
      if (cancelled || !start) return;
      const idx = queue.findIndex(
        (item) => item.bookId === start.target.bookId && item.chapter === start.target.chapter,
      );
      if (idx >= 0) setCursor(idx);
    })();
    return () => {
      cancelled = true;
    };
  }, [plan.prefs, poolActive, queue]);

  useEffect(() => {
    if (queue.length === 0) {
      setCursor(0);
      return;
    }
    setCursor((prev) => Math.max(0, Math.min(prev, queue.length - 1)));
  }, [queue.length]);

  const planName = useMemo(() => {
    const key = planTitleKey(plan.prefs.planId);
    const localized = t(key);
    if (localized !== key) return localized;
    return plan.payload?.name?.trim() || t("pages.read.planPlayTitle");
  }, [plan.payload?.name, plan.prefs.planId]);

  const planDayNumber = useMemo(() => {
    if (plan.isPointerPlan) {
      return Math.max(1, plan.calendarEpochDay + contentAhead);
    }
    if (plan.dayIndex != null) {
      return plan.dayIndex + 1 + contentAhead;
    }
    return null;
  }, [contentAhead, plan.calendarEpochDay, plan.dayIndex, plan.isPointerPlan]);

  const dayMeta =
    planDayNumber != null
      ? tFormat("pages.read.todayPlanDayMeta", { n: planDayNumber })
      : null;

  const planPlayListenedDates = useSyncExternalStore(
    subscribePlanPlayListenedDates,
    getPlanPlayListenedDates,
    getEmptyPlanPlayListenedDates,
  );
  const { completedDates: habitCompletedDates } = useReadingHabitStats();
  const listenedDates = useMemo(() => {
    const merged = new Set<string>(planPlayListenedDates);
    for (const date of habitCompletedDates) merged.add(date);
    return merged;
  }, [habitCompletedDates, planPlayListenedDates]);

  const openPlanSettings = useCallback(() => {
    router.push("/read/plans");
  }, [router]);

  const onSelectCalendarAhead = useCallback((ahead: number) => {
    setViewAhead(ahead);
    setCursor(0);
  }, []);

  const onConfirmDay = useCallback(async () => {
    if (!needsConfirm || confirmBusy) return;
    setConfirmBusy(true);
    try {
      await setReadingPlanAheadDays(contentAhead);
      // 进度改完后日历回到系统今天；黑底仍是系统今天，列表已是新进度内容
      setViewAhead(0);
    } finally {
      setConfirmBusy(false);
    }
  }, [confirmBusy, contentAhead, needsConfirm]);

  const startFromIndex = useCallback(async (index: number) => {
    const target = queue[index];
    if (!target) return false;
    setStarting(true);
    try {
      const viewDate = new Date();
      viewDate.setDate(viewDate.getDate() + viewAhead);
      void markPlanPlayListenedDate(toLocalDateString(viewDate));
      setPlanFlowUiHost("listen");
      const refs = queue.map((item) => ({ bookId: item.bookId, chapter: item.chapter }));
      const audioPrefs = await readPlanFlowChapterAudioPrefs();
      // lazySrc：先建池开播，勿等整日队列逐章预取（冷启动可卡十几秒）；
      // 下方 setTimeout 延迟 4s 才补预取下一章音频，让首章优先拿到带宽/CPU。
      const tracks = await buildScriptureChapterPool(
        refs,
        audioPrefs.translationId,
        audioPrefs.voiceId,
        { lazySrc: true },
      );
      if (!tracks.length) return false;
      scriptureChapterPool.load(tracks, { loop: scriptureChapterPool.getLoop() });
      const started = await scriptureChapterPool.playAt(index, {
        skipNavigate: true,
        maxAttempts: 2,
        retryDelayMs: 150,
      });
      if (started) {
        setCursor(index);
        setTimeout(() => {
          void prefetchTodayReadingPlanQueueAudio(refs.slice(index + 1, index + 2), {
            translationId: audioPrefs.translationId,
            voiceId: audioPrefs.voiceId,
            awaitFirst: false,
          });
        }, 4_000);
      }
      return started;
    } finally {
      setStarting(false);
    }
  }, [queue, viewAhead]);

  const onTogglePlay = useCallback(async () => {
    if (!playback) return;
    // 播中一律暂停。浏览昨天时若先走 startFromIndex，点暂停会再次开播。
    if (isScripturePlaying) {
      await playback.togglePlayScripture({ forcePause: true });
      return;
    }
    if (playback.playbackMode === "scripture" && poolMatchesViewedQueue) {
      const viewDate = new Date();
      viewDate.setDate(viewDate.getDate() + viewAhead);
      void markPlanPlayListenedDate(toLocalDateString(viewDate));
      setPlanFlowUiHost("listen");
      await playback.togglePlayScripture();
      return;
    }
    if (queue.length === 0) return;
    const fromCursor = await startFromIndex(cursor);
    if (fromCursor) return;
    if (browsingAway) return;
    setStarting(true);
    try {
      await startTodayReadingScriptureFromReadHome(router, {
        uiHost: "listen",
        quickStart: true,
      });
    } finally {
      setStarting(false);
    }
  }, [
    browsingAway,
    cursor,
    isScripturePlaying,
    playback,
    poolMatchesViewedQueue,
    queue.length,
    router,
    startFromIndex,
    viewAhead,
  ]);

  const onNext = useCallback(async () => {
    if (queue.length === 0) return;
    if (poolActive) {
      await scriptureCommandSkipNext({ skipNavigate: true });
      return;
    }
    setCursor((prev) => Math.min(queue.length - 1, prev + 1));
  }, [poolActive, queue.length]);

  const onPlayChapterAudio = useCallback(
    async (index: number) => {
      const viewDate = new Date();
      viewDate.setDate(viewDate.getDate() + viewAhead);
      void markPlanPlayListenedDate(toLocalDateString(viewDate));
      if (poolMatchesViewedQueue) {
        await scriptureChapterPool.playAt(index, { skipNavigate: true });
        return;
      }
      await startFromIndex(index);
    },
    [poolMatchesViewedQueue, startFromIndex, viewAhead],
  );

  /** 进正在播的这一章阅读页，不停播。 */
  const onReadChapter = useCallback(
    (index: number) => {
      const target = queue[index];
      if (!target) return;
      router.push({
        pathname: "/read/[bookId]/[chapter]",
        params: { bookId: target.bookId, chapter: String(target.chapter) },
      });
    },
    [queue, router],
  );

  /** 单击切章；同条双击打开阅读页。 */
  const rowTapRef = useRef<{ index: number; at: number } | null>(null);
  const onRowPress = useCallback(
    (index: number) => {
      const now = Date.now();
      const last = rowTapRef.current;
      if (last && last.index === index && now - last.at < 320) {
        rowTapRef.current = null;
        onReadChapter(index);
        return;
      }
      rowTapRef.current = { index, at: now };
      void onPlayChapterAudio(index);
    },
    [onPlayChapterAudio, onReadChapter],
  );

  /** 播放坞左侧：与读经章页一致，打开经文搜索（带当前章上下文）。 */
  const onOpenSearch = useCallback(() => {
    const target = queue[activeIndex];
    router.push(
      readScriptureSearchRoute(
        target ? { bookId: target.bookId, chapter: target.chapter } : undefined,
      ),
    );
    void warmScriptureSearchDatabase(primaryTranslationId);
  }, [activeIndex, primaryTranslationId, queue, router]);

  const trackMeta =
    queue.length > 0
      ? tFormat("pages.read.planPlayTrackMeta", {
          current: activeIndex + 1,
          total: queue.length,
        })
      : null;

  const busy = starting || isPreparing;
  const hasQueue = queue.length > 0;
  const playerBottomPad = shellPlaybackDockBottomPad(insets.bottom);
  const columnStyle = [
    styles.column,
    { paddingHorizontal: padX },
    columnMaxWidth != null ? { maxWidth: columnMaxWidth } : null,
  ];

  return (
    <View style={styles.root}>
      <ScrollView
        style={[styles.upper, columnStyle]}
        contentContainerStyle={[
          styles.pageScrollContent,
          { paddingTop: insets.top + 8 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        bounces
        alwaysBounceVertical={false}
        overScrollMode={Platform.OS === "android" ? "always" : undefined}
      >
        <View style={styles.topBar}>
          <Text style={styles.planTitle} numberOfLines={2}>
            {planName}
          </Text>
          <Pressable
            onPress={openPlanSettings}
            hitSlop={10}
            style={({ pressed }) => [styles.settingsBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t("pages.read.todayPlanChange")}
          >
            <MaterialIcons name="settings" size={22} color={c.muted} />
          </Pressable>
        </View>

        {plan.loading && queue.length === 0 ? (
          <ActivityIndicator color={c.muted} style={{ marginTop: 48 }} />
        ) : !hasQueue ? (
          <Text style={styles.empty}>{t("pages.read.todayPlanEmpty")}</Text>
        ) : (
          <View style={styles.queueSection}>
            <ReadPlanPlayMonthCalendar
              locale={locale}
              prefs={plan.prefs}
              dayCount={plan.dayCount ?? plan.prefs.dayCount}
              viewAhead={viewAhead}
              onSelectAhead={onSelectCalendarAhead}
              listenedDates={listenedDates}
            />

            {needsConfirm ? (
              <Pressable
                onPress={() => void onConfirmDay()}
                disabled={confirmBusy}
                style={({ pressed }) => [
                  styles.confirmBtn,
                  confirmBusy && styles.transportDisabled,
                  pressed && !confirmBusy && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={t("pages.read.planPlayConfirmDay")}
              >
                <Text style={styles.confirmBtnText}>
                  {confirmBusy
                    ? t("pages.read.todayPlanLoading")
                    : t("pages.read.planPlayConfirmDay")}
                </Text>
              </Pressable>
            ) : null}

            <View style={styles.queueHeader}>
              {dayMeta ? <Text style={styles.queueDayMeta}>{dayMeta}</Text> : <Text style={styles.queueDayMeta}> </Text>}
              <Text style={styles.queueHeading}>{t("pages.read.todayPlanTitle")}</Text>
              <Text style={styles.queueCount}>{trackMeta ?? " "}</Text>
            </View>

            {browseLoading && queue.length === 0 ? (
              <ActivityIndicator color={c.muted} style={{ marginVertical: 12 }} />
            ) : null}
            <View style={styles.list}>
              {queue.map((item, index) => {
                const active = activeIndex === index;
                return (
                  <Pressable
                    key={`${item.bookId}:${item.chapter}:${index}`}
                    onPress={() => onRowPress(index)}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.row,
                      active && styles.rowActive,
                      pressed && !busy && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={item.title}
                    accessibilityHint={
                      locale === "en"
                        ? "Double tap to open reading"
                        : "双击打开阅读页"
                    }
                  >
                    <Text style={[styles.rowIndex, active && styles.rowIndexActive]}>
                      {String(index + 1).padStart(2, "0")}
                    </Text>
                    <Text
                      style={[styles.rowText, active && styles.rowTextActive]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    <View style={styles.rowActions}>
                      <Pressable
                        onPress={() => onReadChapter(index)}
                        hitSlop={8}
                        style={({ pressed }) => [styles.rowActionBtn, pressed && styles.pressed]}
                        accessibilityRole="button"
                        accessibilityLabel={t("pages.read.planPlayReadChapter")}
                      >
                        <MaterialIcons name="menu-book" size={20} color={c.muted} />
                      </Pressable>
                      <Pressable
                        onPress={() => void onPlayChapterAudio(index)}
                        disabled={busy}
                        hitSlop={8}
                        style={({ pressed }) => [
                          styles.rowActionBtn,
                          busy && styles.transportDisabled,
                          pressed && !busy && styles.pressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={t("pages.read.planPlayPlayChapterAudio")}
                        accessibilityState={{ selected: active && isScripturePlaying }}
                      >
                        <MaterialIcons
                          name={active && isScripturePlaying ? "graphic-eq" : "volume-up"}
                          size={20}
                          color={c.muted}
                        />
                      </Pressable>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {plan.isNtDeepRepeat ? (
          <ReadNtDeepRepeatStagesBelowToday
            onStageSet={() => {
              setViewAhead(0);
              setCursor(0);
            }}
          />
        ) : null}
      </ScrollView>

      <ReadScripturePlaybackDock
        visible={hasQueue}
        busy={busy}
        disabled={!hasQueue}
        columnMaxWidth={columnMaxWidth}
        style={{ paddingBottom: playerBottomPad }}
        onTogglePlay={() => void onTogglePlay()}
        onNext={() => void onNext()}
        onRead={onOpenSearch}
        readIconName="search"
        readAccessibilityLabel={t("pages.read.chapterChromeSearch")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    // Android：限制高度，避免 ScrollView 被内容撑满后无法滚动
    overflow: "hidden",
  },
  upper: {
    flex: 1,
    width: "100%",
    alignSelf: "center",
    minHeight: 0,
  },
  pageScrollContent: {
    paddingBottom: 20,
    flexGrow: 0,
  },
  column: {
    width: "100%",
    alignSelf: "center",
  },
  queueSection: {
    width: "100%",
  },
  topBar: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
    marginBottom: 6,
    paddingHorizontal: 44,
  },
  planTitle: {
    fontSize: 20,
    lineHeight: 26,
    textAlign: "center",
    ...parchmentSans(700),
    color: c.ink,
  },
  settingsBtn: {
    position: "absolute",
    right: 0,
    top: 0,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtn: {
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginBottom: 10,
    borderRadius: 8,
    backgroundColor: c.ink,
  },
  confirmBtnText: {
    fontSize: 14,
    ...parchmentSans(600),
    color: c.surfaceSolid,
  },
  queueHeader: {
    position: "relative",
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: 12,
    marginBottom: 6,
    minHeight: 26,
  },
  queueDayMeta: {
    fontSize: 17,
    ...parchmentSans(500),
    color: c.muted,
    zIndex: 1,
  },
  queueHeading: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 18,
    ...parchmentSans(600),
    color: c.ink,
  },
  queueCount: {
    fontSize: 17,
    ...parchmentSans(500),
    color: c.muted,
    fontVariant: ["tabular-nums"],
    zIndex: 1,
  },
  empty: {
    fontSize: 15,
    ...parchmentSans(400),
    color: c.muted,
    marginTop: 32,
    textAlign: "center",
  },
  list: {
    gap: 0,
    marginTop: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 7,
    paddingLeft: 12,
    paddingRight: 2,
  },
  rowActive: {
    backgroundColor: LOGO_YELLOW,
    marginHorizontal: -6,
    paddingLeft: 18,
    paddingRight: 8,
    borderRadius: 14,
  },
  rowIndex: {
    width: 28,
    fontSize: 15,
    ...parchmentSans(500),
    color: c.muted,
    fontVariant: ["tabular-nums"],
  },
  rowIndexActive: {
    color: c.ink,
    ...parchmentSans(700),
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    fontSize: 18,
    ...parchmentSans(500),
    lineHeight: 24,
    color: c.ink,
  },
  rowTextActive: {
    color: c.ink,
    ...parchmentSans(700),
  },
  rowActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 0,
  },
  rowActionBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  transportDisabled: { opacity: 0.35 },
  pressed: { opacity: 0.88 },
});
