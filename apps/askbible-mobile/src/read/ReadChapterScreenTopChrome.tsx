import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, Text, View } from "react-native";
import type { EdgeInsets } from "react-native-safe-area-context";
import {
  READ_SETTINGS_TOP_OFFSET,
  READ_TOP_ACTION_GAP,
  READ_TOP_ACTION_SIZE,
} from "./readChapterScreenConstants";
import { readChapterScreenStyles as styles } from "./readChapterScreenStyles";

type Props = {
  insets: EdgeInsets;
  verseSelectionMode: boolean;
  backA11yLabel: string;
  searchA11yLabel: string;
  favoritesA11yLabel: string;
  selectionCountLabel: string;
  selectionClearLabel: string;
  selectionCopyLabel: string;
  onBack: () => void;
  onSearch: () => void;
  onFavorites: () => void;
  onExitSelection: () => void;
  onCopySelection: () => void;
};

export function ReadChapterScreenTopChrome({
  insets,
  verseSelectionMode,
  selectionCountLabel,
  backA11yLabel,
  searchA11yLabel,
  favoritesA11yLabel,
  selectionClearLabel,
  selectionCopyLabel,
  onBack,
  onSearch,
  onFavorites,
  onExitSelection,
  onCopySelection,
}: Props) {
  return (
    <>
      <View
        style={[
          styles.topLeftActionWrap,
          {
            top: insets.top + READ_SETTINGS_TOP_OFFSET,
            left: Math.max(insets.left, 8),
          },
        ]}
      >
        <Pressable
          onPress={onBack}
          disabled={verseSelectionMode}
          style={({ pressed }) => [styles.topActionBtn, pressed && styles.topActionPressed]}
          accessibilityRole="button"
          accessibilityLabel={backA11yLabel}
        >
          <MaterialIcons name="arrow-back-ios-new" size={19} color="#FFFFFF" style={styles.topActionIcon} />
        </Pressable>
      </View>

      <View
        style={[
          styles.topActions,
          {
            top: insets.top + READ_SETTINGS_TOP_OFFSET + READ_TOP_ACTION_SIZE + READ_TOP_ACTION_GAP,
            right: Math.max(insets.right, 8),
          },
        ]}
      >
        <Pressable
          onPress={onSearch}
          disabled={verseSelectionMode}
          style={({ pressed }) => [styles.topActionBtn, pressed && styles.topActionPressed]}
          accessibilityRole="button"
          accessibilityLabel={searchA11yLabel}
        >
          <MaterialIcons name="search" size={21} color="#FFFFFF" style={styles.topActionIcon} />
        </Pressable>
        <Pressable
          onPress={onFavorites}
          disabled={verseSelectionMode}
          style={({ pressed }) => [styles.topActionBtn, pressed && styles.topActionPressed]}
          accessibilityRole="button"
          accessibilityLabel={favoritesA11yLabel}
        >
          <MaterialIcons name="bookmark-border" size={21} color="#FFFFFF" style={styles.topActionIcon} />
        </Pressable>
      </View>

      {verseSelectionMode ? (
        <View
          style={[
            styles.selectionBar,
            {
              left: 14 + Math.max(insets.left, 0),
              right: 14 + Math.max(insets.right, 0),
              bottom: 92 + insets.bottom,
            },
          ]}
        >
          <Text style={styles.selectionCountText}>{selectionCountLabel}</Text>
          <View style={styles.selectionActions}>
            <Pressable
              onPress={onExitSelection}
              style={({ pressed }) => [styles.selectionBtn, pressed && styles.pressed]}
            >
              <Text style={styles.selectionBtnText}>{selectionClearLabel}</Text>
            </Pressable>
            <Pressable
              onPress={onCopySelection}
              style={({ pressed }) => [styles.selectionBtnPrimary, pressed && styles.pressed]}
            >
              <Text style={styles.selectionBtnPrimaryText}>{selectionCopyLabel}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </>
  );
}
