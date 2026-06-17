import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { AppLocale } from "../i18n/config";
import { resolveUiText } from "../i18n/site-copy";
import { setHomeTtsExperimentEnabled } from "../home/homeExperimentalFeatures";
import type { NatureHomeTtsLevel } from "../home/natureHomePrefs";
import type { TtsVoiceGender } from "../home/natureHomeTtsVoices";
import { ShellNavDrawerTtsLevelPicker } from "./ShellNavDrawerTtsLevelPicker";
import { shellNavDrawerStyles as styles } from "./shellNavDrawerStyles";

type VoiceOption = {
  id: string;
  label: string;
  gender: TtsVoiceGender;
};

type Props = {
  locale: AppLocale;
  homeTtsExperimentEnabled: boolean;
  rateLabel: string;
  pitchLabel: string;
  rateLabels: readonly string[];
  pitchLabels: readonly string[];
  ttsRateLevel: NatureHomeTtsLevel;
  ttsPitchLevel: NatureHomeTtsLevel;
  ttsVoiceId: string;
  voiceOptions: VoiceOption[];
  persistTtsPrefs: (next: {
    rateLevel: NatureHomeTtsLevel;
    pitchLevel: NatureHomeTtsLevel;
    voiceId: string;
  }) => void;
};

export function ShellNavDrawerTtsExperimentSection({
  locale,
  homeTtsExperimentEnabled,
  rateLabel,
  pitchLabel,
  rateLabels,
  pitchLabels,
  ttsRateLevel,
  ttsPitchLevel,
  ttsVoiceId,
  voiceOptions,
  persistTtsPrefs,
}: Props) {
  return (
    <>
      <Text style={styles.sectionLabelCompact}>
        {resolveUiText(locale, "实验功能", "Experimental features")}
      </Text>
      <Pressable
        style={({ pressed }) => [styles.ttsMasterRow, pressed ? styles.ttsMasterRowPressed : null]}
        onPress={() => {
          void setHomeTtsExperimentEnabled(!homeTtsExperimentEnabled);
        }}
      >
        <Text style={styles.ttsMasterLabel}>
          {resolveUiText(locale, "尝试TTS读经文（实验）", "Try TTS verse reading (experimental)")}
        </Text>
        <Text style={styles.ttsMasterDetail}>
          {homeTtsExperimentEnabled
            ? resolveUiText(locale, "已开启", "Enabled")
            : resolveUiText(locale, "已关闭", "Disabled")}
        </Text>
      </Pressable>
      {homeTtsExperimentEnabled ? (
        <View style={styles.ttsControlsWrap}>
          <View style={styles.ttsSliderRow}>
            <Text style={styles.ttsSliderLabel}>{resolveUiText(locale, "语速", "Speed")}</Text>
            <Text style={styles.ttsSliderValue}>{rateLabel}</Text>
          </View>
          <ShellNavDrawerTtsLevelPicker
            value={ttsRateLevel}
            labelForLevel={(level) => rateLabels[level] ?? rateLabels[2]}
            onChange={(nextRate) => {
              persistTtsPrefs({
                rateLevel: nextRate,
                pitchLevel: ttsPitchLevel,
                voiceId: ttsVoiceId,
              });
            }}
          />

          <View style={styles.ttsSliderRow}>
            <Text style={styles.ttsSliderLabel}>{resolveUiText(locale, "音调", "Pitch")}</Text>
            <Text style={styles.ttsSliderValue}>{pitchLabel}</Text>
          </View>
          <ShellNavDrawerTtsLevelPicker
            value={ttsPitchLevel}
            labelForLevel={(level) => pitchLabels[level] ?? pitchLabels[2]}
            onChange={(nextPitch) => {
              persistTtsPrefs({
                rateLevel: ttsRateLevel,
                pitchLevel: nextPitch,
                voiceId: ttsVoiceId,
              });
            }}
          />

          <View style={styles.ttsVoiceRow}>
            <Text style={styles.ttsSliderLabel}>{resolveUiText(locale, "声音", "Voices")}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.ttsVoiceList}
              style={styles.ttsVoiceScroll}
            >
              {voiceOptions.map((voice) => {
                const selected = ttsVoiceId === voice.id;
                const iconName =
                  voice.gender === "male" ? "face-man-profile" : "account-circle";
                return (
                  <Pressable
                    key={voice.id || "__default_voice__"}
                    style={[styles.ttsVoiceChip, selected && styles.ttsVoiceChipSelected]}
                    onPress={() => {
                      persistTtsPrefs({
                        rateLevel: ttsRateLevel,
                        pitchLevel: ttsPitchLevel,
                        voiceId: voice.id,
                      });
                    }}
                  >
                    <MaterialCommunityIcons
                      name={iconName}
                      size={14}
                      color={selected ? "#A56A2D" : "rgba(85, 64, 36, 0.72)"}
                    />
                    <Text style={[styles.ttsVoiceChipText, selected && styles.ttsVoiceChipTextSelected]}>
                      {voice.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      ) : null}
    </>
  );
}
