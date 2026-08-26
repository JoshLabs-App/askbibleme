import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import type { AppLocale } from "../i18n/config";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { formatReadingPlanRange } from "./reading-plan/format-reading-range";
import { readChapterCompletionPlanPanelStyles as styles } from "./readChapterCompletionPlanPanelStyles";
import { useReadChapterCompletionPlanState } from "./useReadChapterCompletionPlanState";

type Props = {
  bookId: string;
  chapter: number;
  displayLocale?: AppLocale;
};

/** 本章完成面板：只进阅读章页，不走 planFlow、不自动播音频。 */
function openChapterForReading(
  router: ReturnType<typeof useRouter>,
  target: { bookId: string; chapter: number },
) {
  router.push({
    pathname: "/read/[bookId]/[chapter]",
    params: {
      bookId: target.bookId,
      chapter: String(target.chapter),
    },
  });
}

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
    showLoginHint,
    neighbors,
    nextTarget,
    toggleDone,
    isReadingDone,
  } = useReadChapterCompletionPlanState({ bookId, chapter, displayLocale });

  if (loading || !readings.length) return null;

  return (
    <>
      <View style={styles.card}>
        <View style={styles.titleWrap}>
          {displayName ? <Text style={styles.titleName}>{displayName}</Text> : null}
          {showLoginHint ? (
            <Pressable
              onPress={() => router.push("/login")}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={
                isEnglishDisplay
                  ? "Tap to sign in and save reading progress"
                  : localeZhText("点击登录可保存读经进度")
              }
              style={({ pressed }) => [styles.titleLoginHintBtn, pressed && styles.pressed]}
            >
              <Text style={styles.titleLoginHint}>
                {isEnglishDisplay
                  ? "Tap to sign in and save reading progress ›"
                  : localeZhText("点击登录可保存读经进度 ›")}
              </Text>
            </Pressable>
          ) : null}
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
            const rowKey = `${r.bookId}:${r.startChapter}-${r.endChapter}:${r.startVerse ?? ""}-${r.endVerse ?? ""}`;
            const done = isReadingDone(r);
            const label = formatReadingPlanRange(r, effectiveLocale);
            return (
              <View key={rowKey} style={styles.readingRow}>
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
                  onPress={() =>
                    openChapterForReading(router, {
                      bookId: r.bookId,
                      chapter: r.startChapter,
                    })
                  }
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
                onPress={() => openChapterForReading(router, nextTarget)}
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
                  openChapterForReading(router, prev);
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
                  openChapterForReading(router, next);
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
