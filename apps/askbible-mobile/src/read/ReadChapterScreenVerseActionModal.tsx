import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "./readParchmentTheme";
import type { VerseActionMenuState } from "./readChapterScreenConstants";
import { ReadChapterBottomSheet } from "./ReadChapterBottomSheet";
import { useReadBibleTypographyPx } from "./ReadBibleTypographyContext";

type Props = {
  menu: VerseActionMenuState;
  title: string;
  bookmarked: boolean;
  bookmarkLabel: string;
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

type ActionItem = {
  key: string;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
};

export function ReadChapterScreenVerseActionModal({
  menu,
  title,
  bookmarked,
  bookmarkLabel,
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
  const px = useReadBibleTypographyPx();
  if (!menu) return null;

  const iconSize = Math.max(22, Math.round(px.verseFontSize * 1.15));
  const labelSize = Math.max(13, Math.round(px.verseFontSize * 0.78));

  const actions: ActionItem[] = [
    { key: "copy", label: copyLabel, icon: "content-copy", onPress: onCopy },
    { key: "multi", label: multiCopyLabel, icon: "library-add-check", onPress: onMultiCopy },
    ...(bookmarked
      ? []
      : [
          {
            key: "bookmark",
            label: bookmarkLabel,
            icon: "bookmark-border" as const,
            onPress: onToggleBookmark,
          },
        ]),
    { key: "highlight", label: highlightLabel, icon: "format-color-text", onPress: onHighlight },
    { key: "share", label: shareLabel, icon: "ios-share", onPress: onShare },
  ];

  return (
    <ReadChapterBottomSheet
      visible
      onClose={onClose}
      title={title}
      closeLabel={closeLabel}
      titleFontSize={Math.max(17, Math.round(px.verseFontSize * 0.95))}
      closeFontSize={Math.round(px.verseFontSize * 0.85)}
    >
      <View style={styles.grid}>
        {actions.map((action) => (
          <Pressable
            key={action.key}
            onPress={action.onPress}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
          >
            <MaterialIcons name={action.icon} size={iconSize} color={c.ink} />
            <Text style={[styles.cellLabel, { fontSize: labelSize }]} numberOfLines={2}>
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </ReadChapterBottomSheet>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
    paddingTop: 4,
    paddingBottom: 8,
  },
  cell: {
    width: "33.33%",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 14,
    gap: 8,
  },
  cellLabel: {
    ...parchmentSans(500),
    color: c.ink,
    textAlign: "center",
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.65,
  },
});
