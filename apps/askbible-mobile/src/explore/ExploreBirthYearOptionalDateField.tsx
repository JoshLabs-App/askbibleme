import { Pressable, View } from "react-native";
import { ExploreText as Text } from "./ExploreText";
import { parchmentControlStyles } from "../shell/parchmentControlSurface";
import { ExploreBirthDatePicker } from "./ExploreBirthDatePicker";
import { type ExploreBirthDate } from "./explore-birth-date";
import { defaultBirthDate } from "./explore-birth-year-prefs";
import { exploreBirthYearSettingsStyles as styles } from "./ExploreBirthYearSettingsScreenStyles";

export function ExploreBirthYearOptionalDateField({
  label,
  value,
  onChange,
  setLabel,
  clearLabel,
  suspendSheetScroll,
  resumeSheetScroll,
}: {
  label: string;
  value: ExploreBirthDate | null;
  onChange: (date: ExploreBirthDate | null) => void;
  setLabel: string;
  clearLabel: string;
  suspendSheetScroll: () => void;
  resumeSheetScroll: () => void;
}) {
  return (
    <>
      <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>{label}</Text>
      {value ? (
        <>
          <View
            onTouchStart={suspendSheetScroll}
            onTouchEnd={resumeSheetScroll}
            onTouchCancel={resumeSheetScroll}
          >
            <ExploreBirthDatePicker value={value} onChange={onChange} inModal />
          </View>
          <Pressable
            onPress={() => onChange(null)}
            style={({ pressed }) => [styles.optionalClearBtn, pressed && styles.btnPressed]}
            accessibilityRole="button"
            accessibilityLabel={clearLabel}
          >
            <Text style={styles.optionalClearText}>{clearLabel}</Text>
          </Pressable>
        </>
      ) : (
        <Pressable
          onPress={() => onChange(defaultBirthDate())}
          style={({ pressed }) => [parchmentControlStyles.optionalSetBtn, pressed && styles.btnPressed]}
          accessibilityRole="button"
          accessibilityLabel={setLabel}
        >
          <Text style={styles.optionalSetText}>{setLabel}</Text>
        </Pressable>
      )}
    </>
  );
}
