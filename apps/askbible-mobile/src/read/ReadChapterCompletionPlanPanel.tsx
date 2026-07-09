import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import type { AppLocale } from "../i18n/config";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { formatReadingPlanRange } from "./reading-plan/format-reading-range";
import { todayReadingItemKey } from "./reading-plan/today-reading-done";
import { readChapterCompletionPlanPanelStyles as styles } from "./readChapterCompletionPlanPanelStyles";
import { startTodayPlanFlowScripture } from "./startTodayReadingScriptureFromReadHome";
import { useReadChapterCompletionPlanState } from "./useReadChapterCompletionPlanState";

type Props = {
  bookId: string;
  chapter: number;
  displayLocale?: AppLocale;
};

export function ReadChapterCompletionPlanPanel({ bookId, chapter, displayLocale }: Props) {
  const router = useRouter();
  const {
    loading,
    readings,
    allDone,
    effectiveLocale,
    isEnglishDisplay,
    localeZhText,
    displayName,
    neighbors,
    nextTarget,
    toggleDone,
    isReadingDone,
    planId,
  } = useReadChapterCompletionPlanState({ bookId, chapter, displayLocale });

  if (loading || !readings.length) return null;

  return (
    <>
      <View style={styles.card}>
        <View style={styles.titleWrap}>
          <Text style={styles.titleName}>{displayName || (isEnglishDisplay ? "Friend" : localeZhText("你"))}</Text>
          <Text style={styles.titleMain}>
            {isEnglishDisplay ? "🎉 Great job! This chapter is complete." : localeZhText("🎉 非常好！本章已完成")}
          </Text>
          {allDone ? (
            <Text style={styles.todayDoneNote}>
              {isEnglishDisplay
                ? "You've finished all of today's reading."
                : localeZhText("今天的读经已全部完成。")}
            </Text>
          ) : null}
        </View>

        <View style={styles.readingList}>
          {readings.map((r) => {
            const key = todayReadingItemKey(r, planId);
            const done = isReadingDone(r);
            const label = formatReadingPlanRange(r, effectiveLocale);
            return (
              <View key={key} style={styles.readingRow}>
                <Pressable
                  onPress={() => void toggleDone(r)}
                  hitSlop={8}
                  style={({ pressed }) => [styles.checkboxBtn, pressed && styles.pressed]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: done }}
                >
                  <MaterialIcons
                    name={done ? "check-box" : "check-box-outline-blank"}
                    size={18}
                    color={done ? c.ink : c.muted}
                  />
                </Pressable>
                <Pressable
                  onPress={() => void startTodayPlanFlowScripture(router, { bookId: r.bookId, chapter: r.startChapter })}
                  hitSlop={8}
                  style={({ pressed }) => [styles.readingOpenBtn, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={isEnglishDisplay ? `Open ${label}` : `${localeZhText("打开")} ${label}`}
                >
                  <View style={styles.readingOpenInner}>
                    <Text style={[styles.readingText, done && styles.readingTextDone]}>{label}</Text>
                    <MaterialIcons name="chevron-right" size={18} color={done ? "#8A7762" : "#6A543B"} />
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>

        <View style={styles.actionsWrap}>
          <View style={styles.actions}>
            {nextTarget ? (
              <Pressable
                onPress={() =>
                  nextTarget
                    ? void startTodayPlanFlowScripture(router, nextTarget)
                    : undefined
                }
                hitSlop={8}
                style={({ pressed }) => [styles.actionBtn, styles.actionPrimary, pressed && styles.pressed]}
              >
                <Text style={[styles.actionText, styles.actionPrimaryText]}>
                  {isEnglishDisplay ? "Continue Plan..." : localeZhText("继续计划……")}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => router.push("/read")}
                hitSlop={8}
                style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
              >
                <Text style={styles.actionText}>
                  {isEnglishDisplay ? "Back to Read Home" : localeZhText("回到读经首页")}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>

      <View style={styles.bottomNavRow}>
        <Pressable
          onPress={
            neighbors.prev
              ? () => {
                  const prev = neighbors.prev;
                  if (!prev) return;
                  router.push({
                    pathname: "/read/[bookId]/[chapter]",
                    params: {
                      bookId: prev.bookId,
                      chapter: String(prev.chapter),
                    },
                  });
                }
              : undefined
          }
          hitSlop={10}
          disabled={!neighbors.prev}
          style={({ pressed }) => [
            styles.chapterSideNavBtn,
            !neighbors.prev && styles.chapterSideNavBtnDisabled,
            pressed && neighbors.prev && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={isEnglishDisplay ? "Previous chapter" : localeZhText("上一章")}
        >
          <Text style={styles.chapterSideNavText}>{"<"}</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/read")}
          hitSlop={8}
          style={({ pressed }) => [styles.backHomeLinkWrap, pressed && styles.pressed]}
        >
          <Text style={styles.backHomeLinkText}>{isEnglishDisplay ? "Back Home" : localeZhText("返回主页")}</Text>
        </Pressable>

        <Pressable
          onPress={
            neighbors.next
              ? () => {
                  const next = neighbors.next;
                  if (!next) return;
                  router.push({
                    pathname: "/read/[bookId]/[chapter]",
                    params: {
                      bookId: next.bookId,
                      chapter: String(next.chapter),
                    },
                  });
                }
              : undefined
          }
          hitSlop={10}
          disabled={!neighbors.next}
          style={({ pressed }) => [
            styles.chapterSideNavBtn,
            !neighbors.next && styles.chapterSideNavBtnDisabled,
            pressed && neighbors.next && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={isEnglishDisplay ? "Next chapter" : localeZhText("下一章")}
        >
          <Text style={styles.chapterSideNavText}>{">"}</Text>
        </Pressable>
      </View>
    </>
  );
}
