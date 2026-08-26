import { useState, type ReactNode } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { parchmentSans } from "../fonts/parchmentType";
import { ParchmentModalCard } from "../shell/ParchmentControlSheet";
import { readParchmentTheme as c } from "./readParchmentTheme";

/** 读经页底栏（经文关联 / 节选菜单）共用：随内容增高，最高约 80% 屏高 */
const SHEET_MAX_HEIGHT_RATIO = 0.8;
const SHEET_PAD_TOP = 14;
const SHEET_PAD_H = 18;

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  titleFontSize?: number;
  closeFontSize?: number;
  children: ReactNode;
};

export function ReadChapterBottomSheet({
  visible,
  onClose,
  title,
  closeLabel,
  titleFontSize = 17,
  closeFontSize = 15,
  children,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [headerHeight, setHeaderHeight] = useState(48);

  const padBottom = Math.max(16, insets.bottom + 12);
  const maxSheetHeight = Math.round(windowHeight * SHEET_MAX_HEIGHT_RATIO);
  const scrollMaxHeight = Math.max(
    120,
    maxSheetHeight - SHEET_PAD_TOP - padBottom - headerHeight,
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()} style={styles.sheetWrap}>
          <ParchmentModalCard
            style={[
              styles.sheet,
              {
                maxHeight: maxSheetHeight,
                paddingBottom: padBottom,
              },
            ]}
          >
            <View
              style={styles.header}
              onLayout={(e) => {
                const next = Math.round(e.nativeEvent.layout.height);
                if (next > 0 && next !== headerHeight) setHeaderHeight(next);
              }}
            >
              <Text style={[styles.title, { fontSize: titleFontSize }]}>{title}</Text>
              <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
                <Text style={[styles.close, { fontSize: closeFontSize }]}>{closeLabel}</Text>
              </Pressable>
            </View>

            <ScrollView
              style={[styles.scroll, { maxHeight: scrollMaxHeight }]}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
              bounces
            >
              {children}
            </ScrollView>
          </ParchmentModalCard>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(28, 20, 16, 0.35)",
  },
  sheetWrap: {
    width: "100%",
  },
  sheet: {
    width: "100%",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: SHEET_PAD_H,
    paddingTop: SHEET_PAD_TOP,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
    flexShrink: 0,
  },
  title: {
    flex: 1,
    ...parchmentSans(600),
    color: c.ink,
  },
  close: {
    color: c.muted,
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: 12,
    flexGrow: 0,
  },
});
