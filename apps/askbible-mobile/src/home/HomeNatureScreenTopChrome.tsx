import { ActivityIndicator, Pressable, View } from "react-native";
import type { EdgeInsets } from "react-native-safe-area-context";
import { ShellMaterialIcon } from "../shell/ShellMaterialIcon";
import { t } from "../i18n/site-copy";
import { homeNatureScreenStyles as styles } from "./homeNatureScreenStyles";

type Props = {
  insets: EdgeInsets;
  homeTtsExperimentEnabled: boolean;
  voicePreparing: boolean;
  voiceSpeaking: boolean;
  onPlayDisplayedVerseVoice: () => void;
  onOpenSettings: () => void;
};

export function HomeNatureScreenTopChrome({
  insets,
  homeTtsExperimentEnabled,
  voicePreparing,
  voiceSpeaking,
  onPlayDisplayedVerseVoice,
  onOpenSettings,
}: Props) {
  return (
    <View
      style={[
        styles.topChrome,
        {
          top: insets.top + 4,
          right: Math.max(insets.right, 10),
        },
      ]}
      pointerEvents="box-none"
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
        onPress={onOpenSettings}
        style={({ pressed }) => [styles.settingsBtn, { opacity: pressed ? 0.72 : 0.5 }]}
        accessibilityRole="button"
        accessibilityLabel={t("nature.homeSettings.openAria")}
      >
        <ShellMaterialIcon name="settings" size={22} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}
