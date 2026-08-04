import { Pressable, Text, TextInput, View } from "react-native";
import { t } from "../i18n/site-copy";
import { ParchmentBottomFadeScrollView } from "../read/ParchmentBottomFadeScrollView";
import { SHELL_TAB_SCROLL_FADE_PRESET } from "../read/readParchmentScrollMask";
import { readParchmentTheme as c } from "../read/readParchmentTheme";
import { parchmentControlStyles } from "../shell/parchmentControlSurface";
import { ExploreBirthDatePicker } from "./ExploreBirthDatePicker";
import { ExploreBirthYearOptionalDateField } from "./ExploreBirthYearOptionalDateField";
import { exploreBirthYearSettingsStyles as styles } from "./ExploreBirthYearSettingsScreenStyles";
import {
  exploreStyles as shared,
  ExploreParchmentPage,
} from "./exploreParchmentStyles";
import { useExploreBirthYearSettingsScreen } from "./useExploreBirthYearSettingsScreen";

export const EXPLORE_YEAR_DAY_BIRTH_SETTINGS_PATH = "/explore/year-day-count/birth-settings";

type ExploreBirthYearSettingsProps = {
  /** 由数算年日页 Modal 嵌入，关闭时不走路由栈。 */
  embedded?: boolean;
  required?: boolean;
  onClose?: () => void;
  onSaved?: () => void;
};

export function ExploreBirthYearSettingsScreen({
  embedded = false,
  required: requiredProp,
  onClose,
  onSaved,
}: ExploreBirthYearSettingsProps = {}) {
  const {
    required,
    scrollContentStyle,
    selectedDate,
    setSelectedDate,
    displayName,
    setDisplayName,
    weddingAnniversary,
    setWeddingAnniversary,
    baptismDate,
    setBaptismDate,
    sheetScrollEnabled,
    canSave,
    close,
    saveProfile,
    suspendSheetScroll,
    resumeSheetScroll,
    hint,
  } = useExploreBirthYearSettingsScreen({ embedded, requiredProp, onClose, onSaved });

  return (
    <ExploreParchmentPage>
      <ParchmentBottomFadeScrollView
        fadePreset={SHELL_TAB_SCROLL_FADE_PRESET}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        scrollEnabled={sheetScrollEnabled}
        contentContainerStyle={scrollContentStyle}
      >
        <View style={styles.titleRow}>
          {!embedded ? (
            <Pressable
              onPress={close}
              style={({ pressed }) => [styles.topCloseBtn, styles.topBackBtn, pressed && styles.btnPressed]}
              accessibilityRole="button"
              accessibilityLabel={t("pages.explore.birthYearModalCancel")}
            >
              <Text style={styles.topCloseText}>{t("pages.explore.birthYearModalCancel")}</Text>
            </Pressable>
          ) : (
            <View style={styles.titleSpacer} />
          )}
          <Text style={styles.title}>
            {required ? t("pages.explore.birthYearModalRequiredTitle") : t("pages.explore.birthYearModalTitle")}
          </Text>
          {embedded ? (
            <Pressable
              onPress={close}
              style={({ pressed }) => [styles.topCloseBtn, pressed && styles.btnPressed]}
              accessibilityRole="button"
              accessibilityLabel={t("pages.explore.birthYearModalCancel")}
            >
              <Text style={styles.topCloseText}>{t("pages.explore.birthYearModalCancel")}</Text>
            </Pressable>
          ) : (
            <View style={styles.titleSpacer} />
          )}
        </View>
        <Text style={styles.hint}>{hint}</Text>

        <Text style={styles.fieldLabel}>{t("pages.explore.birthYearModalNameLabel")}</Text>
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder={t("pages.explore.birthYearModalNamePlaceholder")}
          placeholderTextColor={c.faint}
          style={[parchmentControlStyles.field, styles.nameInput]}
          maxLength={24}
          autoCorrect={false}
          returnKeyType="done"
          accessibilityLabel={t("pages.explore.birthYearModalNameLabel")}
        />

        <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>
          {t("pages.explore.birthYearModalDateLabel")}
        </Text>
        <View
          style={styles.pickerBlock}
          onTouchStart={suspendSheetScroll}
          onTouchEnd={resumeSheetScroll}
          onTouchCancel={resumeSheetScroll}
        >
          <ExploreBirthDatePicker value={selectedDate} onChange={setSelectedDate} inModal={embedded} />
        </View>

        <ExploreBirthYearOptionalDateField
          label={t("pages.explore.birthYearModalWeddingLabel")}
          value={weddingAnniversary}
          onChange={setWeddingAnniversary}
          setLabel={t("pages.explore.birthYearModalWeddingSet")}
          clearLabel={t("pages.explore.birthYearModalWeddingClear")}
          suspendSheetScroll={suspendSheetScroll}
          resumeSheetScroll={resumeSheetScroll}
        />

        <ExploreBirthYearOptionalDateField
          label={t("pages.explore.birthYearModalBaptismLabel")}
          value={baptismDate}
          onChange={setBaptismDate}
          setLabel={t("pages.explore.birthYearModalBaptismSet")}
          clearLabel={t("pages.explore.birthYearModalBaptismClear")}
          suspendSheetScroll={suspendSheetScroll}
          resumeSheetScroll={resumeSheetScroll}
        />

        <View style={styles.actions}>
          <Pressable
            onPress={close}
            style={({ pressed }) => [parchmentControlStyles.ghostBtn, pressed && styles.btnPressed]}
          >
            <Text style={styles.btnGhost}>{t("pages.explore.birthYearModalCancel")}</Text>
          </Pressable>
          <Pressable
            onPress={() => void saveProfile()}
            disabled={!canSave}
            style={({ pressed }) => [
              parchmentControlStyles.ghostBtn,
              styles.btnPrimary,
              !canSave && styles.btnDisabled,
              pressed && canSave && styles.btnPressed,
            ]}
          >
            <Text style={styles.btnPrimaryText}>{t("pages.explore.birthYearModalSave")}</Text>
          </Pressable>
        </View>
      </ParchmentBottomFadeScrollView>
    </ExploreParchmentPage>
  );
}
