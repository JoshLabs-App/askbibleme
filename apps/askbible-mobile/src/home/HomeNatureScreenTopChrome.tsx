import { ActivityIndicator, Pressable, View } from "react-native";
import type { EdgeInsets } from "react-native-safe-area-context";
import type { AppLocale } from "../i18n/config";
import { resolveUiText, t } from "../i18n/site-copy";
import { ShellMaterialIcon } from "../shell/ShellMaterialIcon";
import { SPLASH_BACKGROUND as LOGO_COLOR } from "../shell/splash-branding.generated";
import { shellIconTextShadow } from "../shell/shellChromeIcons";
import { homeNatureScreenStyles as styles } from "./homeNatureScreenStyles";

type Props = {
  insets: EdgeInsets;
  locale: AppLocale;
  hidden?: boolean;
  sceneToolsOpen: boolean;
  ambientActive: boolean;
  onToggleSceneTools: () => void;
  onUserActivity?: () => void;
  homeTtsExperimentEnabled: boolean;
  voicePreparing: boolean;
  voiceSpeaking: boolean;
  onPlayDisplayedVerseVoice: () => void;
};

export function HomeNatureScreenTopChrome({
  insets,
  locale,
  hidden = false,
  sceneToolsOpen,
  ambientActive,
  onToggleSceneTools,
  onUserActivity,
  homeTtsExperimentEnabled,
  voicePreparing,
  voiceSpeaking,
  onPlayDisplayedVerseVoice,
}: Props) {
  const settingsLit = sceneToolsOpen || ambientActive;
  const settingsColor = settingsLit ? LOGO_COLOR : "#FFFFFF";

  return (
    <View
      style={[
        styles.topChrome,
        {
          top: insets.top + 4,
          right: Math.max(insets.right, 10),
        },
        hidden ? styles.topChromeHidden : null,
      ]}
      pointerEvents={hidden ? "none" : "box-none"}
    >
      {homeTtsExperimentEnabled ? (
        <Pressable
          onPress={() => {
            void onPlayDisplayedVerseVoice();
          }}
          style={({ pressed }) => [
            styles.settingsBtn,
            styles.voiceBtn,
            { opacity: pressed ? 0.72 : voicePreparing || voiceSpeaking ? 1 : 0.5 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={voiceSpeaking ? t("nature.homeVoice.stopAria") : t("nature.homeVoice.playAria")}
          accessibilityState={{ busy: voicePreparing, selected: voiceSpeaking }}
        >
          {voicePreparing ? (
            <ActivityIndicator size="small" color="rgba(255,255,255,0.92)" />
          ) : (
            <ShellMaterialIcon name="record-voice-over" size={22} color="#FFFFFF" />
          )}
        </Pressable>
      ) : null}
      <Pressable
        onPress={() => {
          onUserActivity?.();
          onToggleSceneTools();
        }}
        style={({ pressed }) => [styles.settingsBtn, pressed ? styles.topChromeBtnPressed : null]}
        accessibilityRole="button"
        accessibilityState={{ selected: settingsLit }}
        accessibilityLabel={
          sceneToolsOpen
            ? resolveUiText(locale, "收起场景与音效", "Hide scenes and sounds")
            : resolveUiText(locale, "场景与音效", "Scenes and sounds")
        }
      >
        <ShellMaterialIcon
          name="settings"
          size={28}
          color={settingsColor}
          style={shellIconTextShadow()}
        />
      </Pressable>
    </View>
  );
}
