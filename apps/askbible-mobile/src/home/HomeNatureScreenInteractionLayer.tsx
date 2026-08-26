import { Pressable } from "react-native";
import { t } from "../i18n/site-copy";
import { homeNatureScreenStyles as styles } from "./homeNatureScreenStyles";

type Props = {
  autoImmersive: boolean;
  enabled: boolean;
  onInteraction: () => void;
};

/** 场景首页点空白：竖屏显隐顶栏 / Tab（播放行留下）；横屏显隐整排播放栏。 */
export function HomeNatureScreenInteractionLayer({
  autoImmersive,
  enabled,
  onInteraction,
}: Props) {
  if (!enabled) return null;

  return (
    <Pressable
      style={autoImmersive ? styles.autoImmersiveBackdrop : styles.sceneMusicTapSurface}
      onPress={onInteraction}
      accessibilityRole="button"
      accessibilityLabel={t("nature.homeBackdropTapAria")}
    />
  );
}
