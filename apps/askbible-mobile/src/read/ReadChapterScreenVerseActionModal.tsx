import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Modal, Pressable, Text, View } from "react-native";
import { readParchmentTheme as c } from "./readParchmentTheme";
import type { VerseActionMenuState } from "./readChapterScreenConstants";
import { readChapterScreenStyles as styles } from "./readChapterScreenStyles";

type Props = {
  menu: VerseActionMenuState;
  title: string;
  bookmarked: boolean;
  bookmarkLabel: string;
  unbookmarkLabel: string;
  copyLabel: string;
  multiCopyLabel: string;
  highlightLabel: string;
  shareLabel: string;
  closeLabel: string;
  onClose: () => void;
  onCopy: () => void;
  onMultiCopy: () => void;
  onToggleBookmark: () => void;
  onHighlight: () => void;
  onShare: () => void;
};

export function ReadChapterScreenVerseActionModal({
  menu,
  title,
  bookmarked,
  bookmarkLabel,
  unbookmarkLabel,
  copyLabel,
  multiCopyLabel,
  highlightLabel,
  shareLabel,
  closeLabel,
  onClose,
  onCopy,
  onMultiCopy,
  onToggleBookmark,
  onHighlight,
  onShare,
}: Props) {
  if (!menu) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.verseActionBackdrop} onPress={onClose}>
        <Pressable style={styles.verseActionSheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.verseActionTitle}>{title}</Text>

          <Pressable onPress={onCopy} style={styles.verseActionBtn}>
            <View style={styles.verseActionBtnRow}>
              <MaterialIcons name="content-copy" size={18} color={c.ink} />
              <Text style={styles.verseActionBtnText}>{copyLabel}</Text>
            </View>
          </Pressable>

          <Pressable onPress={onMultiCopy} style={styles.verseActionBtn}>
            <View style={styles.verseActionBtnRow}>
              <MaterialIcons name="done-all" size={18} color={c.ink} />
              <Text style={styles.verseActionBtnText}>{multiCopyLabel}</Text>
            </View>
          </Pressable>

          <Pressable onPress={onToggleBookmark} style={styles.verseActionBtn}>
            <View style={styles.verseActionBtnRow}>
              <MaterialIcons
                name={bookmarked ? "bookmark" : "bookmark-border"}
                size={18}
                color={c.ink}
              />
              <Text style={styles.verseActionBtnText}>
                {bookmarked ? unbookmarkLabel : bookmarkLabel}
              </Text>
            </View>
          </Pressable>

          <Pressable onPress={onHighlight} style={styles.verseActionBtn}>
            <View style={styles.verseActionBtnRow}>
              <MaterialIcons name="edit" size={18} color={c.ink} />
              <Text style={styles.verseActionBtnText}>{highlightLabel}</Text>
            </View>
          </Pressable>

          <Pressable onPress={onShare} style={styles.verseActionBtn}>
            <View style={styles.verseActionBtnRow}>
              <MaterialIcons name="share" size={18} color={c.ink} />
              <Text style={styles.verseActionBtnText}>{shareLabel}</Text>
            </View>
          </Pressable>

          <Pressable onPress={onClose} style={[styles.verseActionBtn, styles.verseActionBtnCancel]}>
            <View style={styles.verseActionBtnRow}>
              <MaterialIcons name="close" size={18} color={c.muted} />
              <Text style={[styles.verseActionBtnText, styles.verseActionBtnTextMuted]}>
                {closeLabel}
              </Text>
            </View>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
