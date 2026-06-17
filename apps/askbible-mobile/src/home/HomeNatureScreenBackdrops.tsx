import { Pressable } from "react-native";
import { t } from "../i18n/site-copy";
import { homeNatureScreenStyles as styles } from "./homeNatureScreenStyles";

type Props = {
  showAutoImmersive: boolean;
  showLandscapeVideo: boolean;
  markHomeInteraction: () => void;
  onLandscapeBackdropPress: () => void;
  onPortraitBackdropPress: () => void;
};

export function HomeNatureScreenBackdrops({
  showAutoImmersive,
  showLandscapeVideo,
  markHomeInteraction,
  onLandscapeBackdropPress,
  onPortraitBackdropPress,
}: Props) {
  return (
    <>
      {showAutoImmersive ? (
        <Pressable
          style={styles.autoImmersiveBackdrop}
          onPress={markHomeInteraction}
          accessibilityRole="button"
          accessibilityLabel={t("nature.homeBackdropTapAria")}
        />
      ) : null}

      {showLandscapeVideo && !showAutoImmersive ? (
        <Pressable
          style={styles.landscapeBackdrop}
          onPress={onLandscapeBackdropPress}
          accessibilityRole="button"
          accessibilityLabel={t("nature.homeBackdropTapAria")}
        />
      ) : null}

      {!showLandscapeVideo && !showAutoImmersive ? (
        <Pressable
          style={styles.portraitBackdrop}
          onPress={onPortraitBackdropPress}
          accessibilityRole="button"
          accessibilityLabel={t("nature.homeBackdropTapAria")}
        />
      ) : null}
    </>
  );
}
