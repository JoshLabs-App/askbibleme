import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useCallback, useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { VerseSpeechPart } from "../bible/verse-annotations";
import { useLocale } from "../i18n/LocaleProvider";
import { resolveUiText } from "../i18n/site-copy";
import { ReadChapterVerseText } from "./ReadChapterVerseText";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { parchmentSans } from "./readTypography";
import {
  DEFAULT_VERSE_TEXT_HIGHLIGHT_COLOR,
  VERSE_TEXT_HIGHLIGHT_PALETTE,
  writeVerseTextHighlightIndices,
} from "./read-verse-text-highlights";

export type HighlightWordEditorTarget = {
  verse: number;
  text: string;
};

type ChapterHighlightRef = {
  translationId: string;
  bookId: string;
  chapter: number;
};

type Props = {
  visible: boolean;
  target: HighlightWordEditorTarget | null;
  title: string;
  parts: VerseSpeechPart[] | null;
  initialHighlights: Map<number, string> | null;
  chapterRef: ChapterHighlightRef | null;
  onClose: () => void;
  onSaved: (verse: number, highlights: Map<number, string> | null) => void;
  onFeedback: (message: string) => void;
};

function cloneCharHighlightMap(input: Map<number, string> | null | undefined): Map<number, string> {
  return new Map(input ?? []);
}

export function ReadVerseHighlightWordSheet({
  visible,
  target,
  title,
  parts,
  initialHighlights,
  chapterRef,
  onClose,
  onSaved,
  onFeedback,
}: Props) {
  const { locale } = useLocale();
  const insets = useSafeAreaInsets();
  const [activeColor, setActiveColor] = useState<string>(DEFAULT_VERSE_TEXT_HIGHLIGHT_COLOR);
  const [draft, setDraft] = useState<Map<number, string>>(() => new Map());

  useEffect(() => {
    if (!visible || !target) return;
    setDraft(cloneCharHighlightMap(initialHighlights));
    setActiveColor(DEFAULT_VERSE_TEXT_HIGHLIGHT_COLOR);
  }, [initialHighlights, target, visible]);

  const toggleUnit = useCallback(
    (start: number, end: number, color: string) => {
      setDraft((prev) => {
        const next = new Map(prev);
        let allSelected = true;
        for (let i = start; i < end; i += 1) {
          if (!next.has(i)) {
            allSelected = false;
            break;
          }
        }
        for (let i = start; i < end; i += 1) {
          if (allSelected) next.delete(i);
          else next.set(i, color);
        }
        return next;
      });
    },
    [],
  );

  const handleDone = useCallback(async () => {
    if (!target || !chapterRef) {
      onClose();
      return;
    }
    await writeVerseTextHighlightIndices(
      {
        translationId: chapterRef.translationId,
        bookId: chapterRef.bookId,
        chapter: chapterRef.chapter,
        verse: target.verse,
      },
      draft.entries(),
    );
    onSaved(target.verse, draft.size ? new Map(draft) : null);
    onFeedback(
      draft.size > 0
        ? resolveUiText(locale, "已保存高亮", "Highlight saved")
        : resolveUiText(locale, "已清空高亮", "Highlight cleared"),
    );
    onClose();
  }, [chapterRef, draft, locale, onClose, onFeedback, onSaved, target]);

  const bodyText = target?.text ?? "";
  const sheetVisible = visible && Boolean(target);

  const hint = resolveUiText(locale, "点选字词即可上色；再次点击可取消。", "Tap words to highlight; tap again to clear.");

  return (
    <Modal visible={sheetVisible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: 16 + insets.bottom, maxHeight: "86%" }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.headerRow}>
            <Text style={styles.title}>{resolveUiText(locale, "划重点词", "Highlight words")}</Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={resolveUiText(locale, "关闭", "Close")}
            >
              <MaterialIcons name="close" size={22} color={c.muted} />
            </Pressable>
          </View>
          <Text style={styles.verseTitle}>{title}</Text>
          <Text style={styles.hint}>{hint}</Text>

          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.bodyScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <ReadChapterVerseText
              key={`highlight-word:${target?.verse ?? 0}:${draft.size}`}
              inline={false}
              preciseHighlightUnits
              text={bodyText}
              parts={parts}
              highlightedCharIndexes={draft}
              highlightEditMode
              textHighlightColor={activeColor}
              onToggleHighlightUnit={toggleUnit}
            />
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.colorPicker}>
              {VERSE_TEXT_HIGHLIGHT_PALETTE.map((color) => {
                const active = color === activeColor;
                return (
                  <Pressable
                    key={color}
                    onPress={() => setActiveColor(color)}
                    style={[
                      styles.colorChip,
                      { backgroundColor: color },
                      active && styles.colorChipActive,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={
                      active
                        ? resolveUiText(locale, "当前颜色", "Current color")
                        : resolveUiText(locale, "切换颜色", "Switch color")
                    }
                  />
                );
              })}
            </View>
            <Pressable
              onPress={() => void handleDone()}
              style={({ pressed }) => [styles.doneBtn, pressed && styles.pressed]}
            >
              <Text style={styles.doneBtnText}>{resolveUiText(locale, "完成", "Done")}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: c.modalBackdrop,
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 24,
  },
  sheet: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderStrong,
    backgroundColor: c.surfaceSolid,
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 16,
    color: c.ink,
    ...parchmentSans(700),
  },
  verseTitle: {
    fontSize: 13,
    color: c.muted,
    ...parchmentSans(600),
  },
  hint: {
    fontSize: 12,
    color: c.faint,
    ...parchmentSans(400),
  },
  bodyScroll: {
    maxHeight: 360,
  },
  bodyScrollContent: {
    paddingVertical: 6,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 4,
  },
  colorPicker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  colorChip: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(80, 50, 20, 0.35)",
  },
  colorChipActive: {
    borderWidth: 2,
    borderColor: c.ink,
  },
  doneBtn: {
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: c.parchmentAccent,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  doneBtnText: {
    fontSize: 14,
    color: "#FFFFFF",
    ...parchmentSans(700),
  },
  pressed: {
    opacity: 0.88,
  },
});
