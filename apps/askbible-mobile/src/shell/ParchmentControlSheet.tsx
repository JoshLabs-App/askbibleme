import type { ReactNode } from "react";
import { Modal, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ReadParchmentBackground } from "../read/ReadParchmentBackground";
import { ReadParchmentBackgroundImage } from "../read/ReadParchmentSurface";
import { readParchmentTheme as c } from "../read/readParchmentTheme";
import { ShellSwipeExclude } from "./ShellSwipeExclude";

type SheetProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** 与探索页相同的羊皮实图容器（仅包一层透明正文区）。 */
export function ParchmentControlSheet({ children, style }: SheetProps) {
  return <View style={[styles.sheetContent, style]}>{children}</View>;
}

/**
 * 弹层卡片默认羊皮底（settings / 闹钟条等）：新 Modal 优先用此，勿写纯色 sheet。
 */
export function ParchmentModalCard({
  children,
  style,
  fill = false,
  ...viewProps
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  fill?: boolean;
} & Pick<ViewProps, "accessibilityViewIsModal" | "onStartShouldSetResponder">) {
  return (
    <ReadParchmentBackgroundImage fill={fill} style={[styles.modalCard, style]} {...viewProps}>
      {children}
    </ReadParchmentBackgroundImage>
  );
}

type OverlayProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  sheetStyle?: StyleProp<ViewStyle>;
  /** 保留 API；全屏羊皮页通过标题栏关闭，不再点空白关闭。 */
  dismissOnBackdrop?: boolean;
};

/**
 * 探索弹层：全屏 `ReadParchmentBackground`，与探索 Tab 羊皮底完全一致（非底部纯色卡片）。
 */
export function ParchmentExploreOverlay({
  visible,
  onClose,
  children,
  sheetStyle,
}: OverlayProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <ReadParchmentBackground>
        <ShellSwipeExclude
          style={[
            styles.page,
            {
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
            },
            sheetStyle,
          ]}
        >
          {children}
        </ShellSwipeExclude>
      </ReadParchmentBackground>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  sheetContent: {
    flex: 1,
    backgroundColor: "transparent",
  },
  modalCard: {
    overflow: "hidden",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
});
