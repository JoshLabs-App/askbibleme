import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import { Pressable } from "react-native";
import { t } from "../i18n/site-copy";
import { pushReadPlanPlay } from "../read/read-plan-flow-nav";
import { shellIconTextShadow } from "./shellChromeIcons";
import { SPLASH_BACKGROUND as LOGO_COLOR } from "./splash-branding.generated";
import { shellTabBarStyles as styles } from "./shellTabBarStyles";

const SCRIPTURE_FAB_ICON_SIZE = 30;

type Props = {
  /** 读经计划页：中央键视为底栏选中项 */
  routeSelected?: boolean;
};

/** 底栏中央：只切换到读经计划页，不负责播放。 */
export function ShellScripturePlayFab({ routeSelected = false }: Props) {
  const router = useRouter();
  const iconColor = routeSelected ? LOGO_COLOR : "rgba(255,255,255,0.92)";

  return (
    <Pressable
      onPress={() => {
        if (routeSelected) return;
        pushReadPlanPlay(router);
      }}
      style={({ pressed }) => [styles.scriptureFab, pressed ? styles.scriptureFabPressed : null]}
      accessibilityRole="button"
      accessibilityState={{ selected: routeSelected }}
      accessibilityLabel={t("pages.read.planPlayTitle")}
    >
      <MaterialCommunityIcons
        name="account-voice"
        size={SCRIPTURE_FAB_ICON_SIZE}
        color={iconColor}
        style={shellIconTextShadow()}
      />
    </Pressable>
  );
}
