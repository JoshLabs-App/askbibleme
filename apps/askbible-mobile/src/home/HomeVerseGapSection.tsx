import { useEffect, useSyncExternalStore } from "react";
import { Text, View, Pressable } from "react-native";
import { NatureHomeSettingsIconRow } from "./NatureHomeSettingsIconRow";
import { natureHomeSettingsPanelStyles as styles } from "./natureHomeSettingsPanelStyles";
import { HOME_VERSE_GAP_SEC_OPTIONS, getHomeVerseGapSec, hydrateHomeVerseGapSec, subscribeHomeVerseGapSec, writeHomeVerseGapSec } from "./homeVerseGapPrefs";

export function HomeVerseGapSection() {
  const selected = useSyncExternalStore(subscribeHomeVerseGapSec, getHomeVerseGapSec, getHomeVerseGapSec);
  useEffect(() => { void hydrateHomeVerseGapSec(); }, []);
  const label = "间隔时长";
  return (
    <NatureHomeSettingsIconRow icon="more-time" accessibilityLabel={label}>
      <View style={styles.rotationChoicesRow}>
        <Text style={styles.rotationLabel}>间距</Text>
        <View style={styles.rotationChoicesWrap}>
        {HOME_VERSE_GAP_SEC_OPTIONS.map((sec) => (
          <Pressable key={sec} onPress={() => void writeHomeVerseGapSec(sec)} style={[styles.rotationChoice, selected === sec && styles.rotationChoiceOn]} accessibilityRole="button" accessibilityState={{ selected: selected === sec }}>
            <Text style={styles.rotationChoiceText}>{sec}s</Text>
          </Pressable>
        ))}
        </View>
      </View>
    </NatureHomeSettingsIconRow>
  );
}
