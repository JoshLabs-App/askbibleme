import { useMemo } from "react";
import { Modal, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useShellSwipeSuspend } from "../shell/useShellSwipeSuspend";
import { NatureHomeSettingsPanelSheet } from "./NatureHomeSettingsPanelSheet";
import {
  MODAL_SUPPORTED_ORIENTATIONS,
  type NatureHomeSettingsPresentation,
} from "./natureHomeSettingsPanelConstants";
import { natureHomeSettingsPanelStyles as styles } from "./natureHomeSettingsPanelStyles";
import { useNatureHomeSettingsPanel } from "./useNatureHomeSettingsPanel";

export type { NatureHomeSettingsPresentation };

type Props = {
  visible: boolean;
  onClose: () => void;
  onPrefsChanged: () => void;
  presentation?: NatureHomeSettingsPresentation;
  /** 当前场景海报：Android 背板磨砂模糊用 */
  posterUri?: string;
  /** 试验开关：关闭时隐藏 TTS 相关设置 */
  showTtsControls?: boolean;
};

export function NatureHomeSettingsPanel({
  visible,
  onClose,
  onPrefsChanged,
  presentation = "modal",
  posterUri,
  showTtsControls = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const isLandscape = winW > winH;
  /** 横屏约占屏宽 72%（与用户标注的蓝框一致）；竖屏略窄仍留边 */
  const sheetWidth = useMemo(() => {
    const edge = Math.max(insets.right, 12) + 8;
    const ratio = isLandscape ? 0.72 : 0.86;
    return Math.max(280, Math.round(winW * ratio - edge));
  }, [winW, isLandscape, insets.right]);
  useShellSwipeSuspend(visible);

  const panel = useNatureHomeSettingsPanel({ visible, showTtsControls, onPrefsChanged });

  if (!visible) return null;

  const sheet = (
    <NatureHomeSettingsPanelSheet
      sheetWidth={sheetWidth}
      insets={insets}
      posterUri={posterUri}
      showTtsControls={showTtsControls}
      onClose={onClose}
      onPrefsChanged={onPrefsChanged}
      {...panel}
    />
  );

  if (presentation === "overlay") {
    return <View style={styles.overlayRoot}>{sheet}</View>;
  }

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
      supportedOrientations={[...MODAL_SUPPORTED_ORIENTATIONS]}
    >
      {sheet}
    </Modal>
  );
}
