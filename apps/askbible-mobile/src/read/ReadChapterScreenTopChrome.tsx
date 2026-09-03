import { usePathname } from "expo-router";
import { ShellMaterialIcon } from "../shell/ShellMaterialIcon";
import { ShellSystemBackButton } from "../shell/ShellSystemBackButton";
import { Pressable, Text, View } from "react-native";
import type { EdgeInsets } from "react-native-safe-area-context";
import { useMusicPlayback } from "../music/MusicPlaybackContext";
import {
  SHELL_SCRIPTURE_DOCK_CONTENT_HEIGHT,
  SHELL_TAB_BAR_DOCK_GAP,
} from "../shell/shellPlaybackTransportLayout";
import { isReadChapterPathname } from "../shell/shellPrimaryRoute";
import { ReadChapterTitleAudioButton } from "./ReadChapterTitleAudioButton";
import { READ_TOP_CHROME, readTopChromeLeftStyle, readTopChromeRightStyle } from "./readTopChrome";
import { readChapterScreenStyles as styles } from "./readChapterScreenStyles";
import { shouldShowReadScriptureAudioDock } from "./readScriptureDockVisibility";

type Props = {
  insets: EdgeInsets;
  /** 章页默认显示；圣经首页不显示返回 */
  showBack?: boolean;
  verseSelectionMode?: boolean;
  /** 章页播放坞已有搜索时隐藏 */
  showSearch?: boolean;
  searchA11yLabel?: string;
  favoritesA11yLabel: string;
  increaseSizeA11yLabel: string;
  decreaseSizeA11yLabel: string;
  selectionCountLabel?: string;
  selectionClearLabel?: string;
  selectionCopyLabel?: string;
  sizeAtMax: boolean;
  sizeAtMin: boolean;
  audioBookId?: string;
  audioChapter?: number;
  audioBookName?: string;
  audioDisabled?: boolean;
  /** 章页默认显示；圣经首页不展示朗读 */
  showAudio?: boolean;
  /** 圣经首页：回到上次阅读的一章 */
  showLastRead?: boolean;
  lastReadA11yLabel?: string;
  lastReadDisabled?: boolean;
  onLastRead?: () => void;
  onBack?: () => void;
  onSearch?: () => void;
  onFavorites: () => void;
  onIncreaseSize: () => void;
  onDecreaseSize: () => void;
  onExitSelection?: () => void;
  onCopySelection?: () => void;
};

/** 读经顶栏右侧共用：搜索 / 收藏 / 字号 / 朗读（设置在 layout 第 0 位） */
export function ReadChapterScreenTopChrome({
  insets,
  showBack = true,
  verseSelectionMode = false,
  selectionCountLabel = "",
  showSearch = true,
  searchA11yLabel,
  favoritesA11yLabel,
  increaseSizeA11yLabel,
  decreaseSizeA11yLabel,
  selectionClearLabel = "",
  selectionCopyLabel = "",
  sizeAtMax,
  sizeAtMin,
  audioBookId = "",
  audioChapter = 1,
  audioBookName = "",
  audioDisabled = false,
  showAudio = true,
  showLastRead = false,
  lastReadA11yLabel = "",
  lastReadDisabled = false,
  onLastRead,
  onBack,
  onSearch,
  onFavorites,
  onIncreaseSize,
  onDecreaseSize,
  onExitSelection,
  onCopySelection,
}: Props) {
  const rightStack = readTopChromeRightStyle(insets, 1);
  const pathname = usePathname();
  const { playing, playbackMode, readChapterAudioAvailable, scripturePreparing } =
    useMusicPlayback();
  const dockVisible = shouldShowReadScriptureAudioDock({
    readChapterAudioAvailable,
    onChapterPage: isReadChapterPathname(pathname ?? ""),
    playbackMode,
    playing,
    scripturePreparing,
  });

  return (
    <>
      {showBack && onBack ? (
        <View style={[styles.topLeftActionWrap, readTopChromeLeftStyle(insets)]}>
          <ShellSystemBackButton
            onPress={onBack}
            disabled={verseSelectionMode}
            tintColor={READ_TOP_CHROME.iconColor}
            style={styles.topSystemBack}
          />
        </View>
      ) : null}

      <View style={[styles.topActions, rightStack]}>
        {showSearch && onSearch ? (
        <Pressable
          onPress={onSearch}
          disabled={verseSelectionMode}
          style={({ pressed }) => [styles.topActionBtn, pressed && styles.topActionPressed]}
          android_ripple={{
            color: "rgba(0,0,0,0.12)",
            borderless: true,
            radius: READ_TOP_CHROME.btnSize / 2,
          }}
          accessibilityRole="button"
          accessibilityLabel={searchA11yLabel}
        >
          <ShellMaterialIcon
            name="search"
            size={READ_TOP_CHROME.iconSize}
            color={READ_TOP_CHROME.iconColor}
          />
        </Pressable>
        ) : null}
        <Pressable
          onPress={onFavorites}
          disabled={verseSelectionMode}
          style={({ pressed }) => [styles.topActionBtn, pressed && styles.topActionPressed]}
          android_ripple={{
            color: "rgba(0,0,0,0.12)",
            borderless: true,
            radius: READ_TOP_CHROME.btnSize / 2,
          }}
          accessibilityRole="button"
          accessibilityLabel={favoritesA11yLabel}
        >
          <ShellMaterialIcon
            name="bookmark-border"
            size={READ_TOP_CHROME.iconSize}
            color={READ_TOP_CHROME.iconColor}
          />
        </Pressable>
        <Pressable
          onPress={onIncreaseSize}
          disabled={verseSelectionMode || sizeAtMax}
          style={({ pressed }) => [
            styles.topActionBtn,
            (verseSelectionMode || sizeAtMax) && styles.topActionDisabled,
            pressed && !sizeAtMax && styles.topActionPressed,
          ]}
          android_ripple={{
            color: "rgba(0,0,0,0.12)",
            borderless: true,
            radius: READ_TOP_CHROME.btnSize / 2,
          }}
          accessibilityRole="button"
          accessibilityState={{ disabled: verseSelectionMode || sizeAtMax }}
          accessibilityLabel={increaseSizeA11yLabel}
        >
          <Text style={[styles.topActionIcon, styles.topActionSizeLabel]}>+</Text>
        </Pressable>
        <Pressable
          onPress={onDecreaseSize}
          disabled={verseSelectionMode || sizeAtMin}
          style={({ pressed }) => [
            styles.topActionBtn,
            (verseSelectionMode || sizeAtMin) && styles.topActionDisabled,
            pressed && !sizeAtMin && styles.topActionPressed,
          ]}
          android_ripple={{
            color: "rgba(0,0,0,0.12)",
            borderless: true,
            radius: READ_TOP_CHROME.btnSize / 2,
          }}
          accessibilityRole="button"
          accessibilityState={{ disabled: verseSelectionMode || sizeAtMin }}
          accessibilityLabel={decreaseSizeA11yLabel}
        >
          <Text style={[styles.topActionIcon, styles.topActionSizeLabel]}>−</Text>
        </Pressable>
        {showAudio ? (
          <ReadChapterTitleAudioButton
            appearance="chrome"
            bookId={audioBookId}
            chapter={audioChapter}
            bookName={audioBookName}
            disabled={verseSelectionMode || audioDisabled}
          />
        ) : null}
        {showLastRead ? (
          <Pressable
            onPress={onLastRead}
            disabled={verseSelectionMode || lastReadDisabled || !onLastRead}
            style={({ pressed }) => [
              styles.topActionBtn,
              (verseSelectionMode || lastReadDisabled) && styles.topActionDisabled,
              pressed && !lastReadDisabled && styles.topActionPressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ disabled: verseSelectionMode || lastReadDisabled }}
            accessibilityLabel={lastReadA11yLabel}
          >
            <ShellMaterialIcon
              name="history"
              size={READ_TOP_CHROME.iconSize}
              color={READ_TOP_CHROME.iconColor}
            />
          </Pressable>
        ) : null}
      </View>

      {verseSelectionMode ? (
        <View
          style={[
            styles.selectionBar,
            {
              left: 14 + Math.max(insets.left, 0),
              right: 14 + Math.max(insets.right, 0),
              bottom:
                92 +
                insets.bottom +
                (dockVisible ? SHELL_SCRIPTURE_DOCK_CONTENT_HEIGHT + SHELL_TAB_BAR_DOCK_GAP : 0),
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
