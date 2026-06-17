import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Slider from "@react-native-community/slider";
import { Pressable, ScrollView, Text, View } from "react-native";
import { inferTtsVoiceGender } from "./natureHomeTtsVoices";
import type { NatureHomeTtsLevel } from "./natureHomePrefs";
import { tNatureHomeSettings } from "./natureHomeSettingsCopy";
import { NatureHomeSettingsIconRow } from "./NatureHomeSettingsIconRow";
import type { DeviceVoice } from "./natureHomeSettingsPanelConstants";
import { ICON_MUTED } from "./natureHomeSettingsPanelConstants";
import { compactVoiceName, genderGlyph } from "./natureHomeSettingsPanelHelpers";
import { natureHomeSettingsPanelStyles as styles } from "./natureHomeSettingsPanelStyles";

type Props = {
  ttsRateLevel: NatureHomeTtsLevel;
  setTtsRateLevel: (level: NatureHomeTtsLevel) => void;
  ttsPitchLevel: NatureHomeTtsLevel;
  setTtsPitchLevel: (level: NatureHomeTtsLevel) => void;
  ttsVoiceId: string;
  setTtsVoiceId: (id: string) => void;
  deviceVoices: DeviceVoice[];
  openSystemVoiceSettings: () => void;
  labelForTtsRate: (level: NatureHomeTtsLevel) => string;
  labelForTtsPitch: (level: NatureHomeTtsLevel) => string;
};

export function NatureHomeSettingsTtsSection({
  ttsRateLevel,
  setTtsRateLevel,
  ttsPitchLevel,
  setTtsPitchLevel,
  ttsVoiceId,
  setTtsVoiceId,
  deviceVoices,
  openSystemVoiceSettings,
  labelForTtsRate,
  labelForTtsPitch,
}: Props) {
  return (
    <>
      <NatureHomeSettingsIconRow icon="tune" accessibilityLabel={tNatureHomeSettings("ttsRateSection")} alignTop>
        <View style={styles.ttsSliderWrap}>
          <View style={styles.ttsSliderCell}>
            <View style={styles.ttsSliderRow}>
              <View style={styles.ttsSliderIcon}>
                <MaterialIcons name="speed" size={16} color={ICON_MUTED} />
              </View>
              <Slider
                style={styles.ttsSlider}
                minimumValue={0}
                maximumValue={4}
                step={1}
                minimumTrackTintColor="#71717a"
                maximumTrackTintColor="#3f3f46"
                thumbTintColor="#e5e7eb"
                value={ttsRateLevel}
                onValueChange={(v) =>
                  setTtsRateLevel(Math.min(4, Math.max(0, Math.round(v))) as NatureHomeTtsLevel)
                }
                accessibilityLabel={labelForTtsRate(ttsRateLevel)}
              />
            </View>
          </View>
          <View style={styles.ttsSliderCell}>
            <View style={styles.ttsSliderRow}>
              <View style={styles.ttsSliderIcon}>
                <MaterialIcons name="graphic-eq" size={16} color={ICON_MUTED} />
              </View>
              <Slider
                style={styles.ttsSlider}
                minimumValue={0}
                maximumValue={4}
                step={1}
                minimumTrackTintColor="#71717a"
                maximumTrackTintColor="#3f3f46"
                thumbTintColor="#e5e7eb"
                value={ttsPitchLevel}
                onValueChange={(v) =>
                  setTtsPitchLevel(Math.min(4, Math.max(0, Math.round(v))) as NatureHomeTtsLevel)
                }
                accessibilityLabel={labelForTtsPitch(ttsPitchLevel)}
              />
            </View>
          </View>
        </View>
      </NatureHomeSettingsIconRow>

      <NatureHomeSettingsIconRow icon="record-voice-over" accessibilityLabel={tNatureHomeSettings("ttsVoiceSection")}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.voiceRow}
          style={styles.voiceScroll}
        >
          <Pressable
            onPress={openSystemVoiceSettings}
            style={[styles.voiceChip, styles.voiceAddChip]}
            accessibilityRole="button"
            accessibilityLabel={tNatureHomeSettings("ttsVoiceAdd")}
          >
            <MaterialIcons name="add" size={17} color="rgba(255,255,255,0.72)" />
          </Pressable>
          <Pressable
            onPress={() => {
              setTtsVoiceId("");
            }}
            style={[styles.voiceChip, styles.voiceAddChip, ttsVoiceId === "" && styles.voiceChipOn]}
            accessibilityRole="radio"
            accessibilityState={{ selected: ttsVoiceId === "" }}
            accessibilityLabel={tNatureHomeSettings("ttsVoiceDefault")}
          >
            <MaterialIcons
              name="radio-button-checked"
              size={16}
              color={ttsVoiceId === "" ? "#fff" : "rgba(255,255,255,0.62)"}
            />
          </Pressable>
          {deviceVoices.map((voice, idx) => {
            const selected = ttsVoiceId === voice.identifier;
            const baseLabel = compactVoiceName(voice);
            const duplicateCount = deviceVoices.filter(
              (v) => compactVoiceName(v).toLowerCase() === baseLabel.toLowerCase(),
            ).length;
            const label = duplicateCount > 1 ? `${baseLabel}${idx + 1}` : baseLabel;
            const gender = inferTtsVoiceGender(voice);
            const genderMark = gender === "male" ? genderGlyph("male") : genderGlyph("unknown");
            return (
              <Pressable
                key={voice.identifier}
                onPress={() => {
                  setTtsVoiceId(voice.identifier);
                }}
                style={[styles.voiceChip, selected && styles.voiceChipOn]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${voice.name?.trim() || voice.identifier} ${voice.language || ""}`.trim()}
              >
                <View style={styles.voiceChipInner}>
                  <Text style={[styles.voiceGenderText, selected && styles.voiceGenderTextOn]}>
                    {genderMark}
                  </Text>
                  <Text style={[styles.voiceChipText, selected && styles.voiceChipTextOn]}>{label}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </NatureHomeSettingsIconRow>
    </>
  );
}
