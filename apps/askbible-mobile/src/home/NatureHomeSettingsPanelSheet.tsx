import { Pressable, StyleSheet, View } from "react-native";
import type { EdgeInsets } from "react-native-safe-area-context";
import { ShellSwipeExclude } from "../shell/ShellSwipeExclude";
import { ParchmentModalCard } from "../shell/ParchmentControlSheet";
import { HomeSleepTimerSection } from "./HomeSleepTimerSection";
import { NatureHomeSettingsIconRow } from "./NatureHomeSettingsIconRow";
import { NatureHomeSettingsTextScaleSection } from "./NatureHomeSettingsTextScaleSection";
import { NatureHomeSettingsTtsSection } from "./NatureHomeSettingsTtsSection";
import type { NatureHomeTtsLevel } from "./natureHomePrefs";
import { tNatureHomeSettings } from "./natureHomeSettingsCopy";
import type { DeviceVoice } from "./natureHomeSettingsPanelConstants";
import { natureHomeSettingsPanelStyles as styles } from "./natureHomeSettingsPanelStyles";

type Props = {
  sheetWidth: number;
  insets: EdgeInsets;
  showTtsControls: boolean;
  onClose: () => void;
  onPrefsChanged: () => void;
  scaleIndex: number;
  setScaleIndex: (index: number) => void;
  ttsRateLevel: NatureHomeTtsLevel;
  setTtsRateLevel: (level: NatureHomeTtsLevel) => void;
  ttsPitchLevel: NatureHomeTtsLevel;
  setTtsPitchLevel: (level: NatureHomeTtsLevel) => void;
  ttsVoiceId: string;
  setTtsVoiceId: (id: string) => void;
  deviceVoices: DeviceVoice[];
  openSystemVoiceSettings: () => void;
};

export function NatureHomeSettingsPanelSheet({
  sheetWidth,
  insets,
  showTtsControls,
  onClose,
  onPrefsChanged,
  scaleIndex,
  setScaleIndex,
  ttsRateLevel,
  setTtsRateLevel,
  ttsPitchLevel,
  setTtsPitchLevel,
  ttsVoiceId,
  setTtsVoiceId,
  deviceVoices,
  openSystemVoiceSettings,
}: Props) {
  const labelForTtsRate = (level: NatureHomeTtsLevel) =>
    level <= 1
      ? tNatureHomeSettings("ttsLevelSlow")
      : level >= 3
        ? tNatureHomeSettings("ttsLevelFast")
        : tNatureHomeSettings("ttsLevelNormal");

  const labelForTtsPitch = (level: NatureHomeTtsLevel) =>
    level <= 1
      ? tNatureHomeSettings("ttsLevelLow")
      : level >= 3
        ? tNatureHomeSettings("ttsLevelHigh")
        : tNatureHomeSettings("ttsLevelNormal");

  return (
    <ShellSwipeExclude style={styles.backdrop}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={tNatureHomeSettings("closeAria")}
      />
      <ParchmentModalCard
        style={[
          styles.sheet,
          { width: sheetWidth, marginTop: insets.top + 8, marginRight: Math.max(insets.right, 12) },
        ]}
        onStartShouldSetResponder={() => true}
        accessibilityViewIsModal
      >
        <View style={styles.sheetBody}>
          <NatureHomeSettingsTextScaleSection
            scaleIndex={scaleIndex}
            setScaleIndex={setScaleIndex}
            onPrefsChanged={onPrefsChanged}
          />
          <NatureHomeSettingsIconRow
            icon="timer"
            accessibilityLabel={tNatureHomeSettings("sleepSection")}
          >
            <HomeSleepTimerSection />
          </NatureHomeSettingsIconRow>
          {showTtsControls ? (
            <NatureHomeSettingsTtsSection
              ttsRateLevel={ttsRateLevel}
              setTtsRateLevel={setTtsRateLevel}
              ttsPitchLevel={ttsPitchLevel}
              setTtsPitchLevel={setTtsPitchLevel}
              ttsVoiceId={ttsVoiceId}
              setTtsVoiceId={setTtsVoiceId}
              deviceVoices={deviceVoices}
              openSystemVoiceSettings={openSystemVoiceSettings}
              labelForTtsRate={labelForTtsRate}
              labelForTtsPitch={labelForTtsPitch}
            />
          ) : null}
        </View>
      </ParchmentModalCard>
    </ShellSwipeExclude>
  );
}
