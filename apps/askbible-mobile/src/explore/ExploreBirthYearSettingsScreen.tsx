import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InteractionManager, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { parchmentSans } from "../fonts/parchmentType";
import { t } from "../i18n/site-copy";
import { ParchmentBottomFadeScrollView } from "../read/ParchmentBottomFadeScrollView";
import { READ_PARCHMENT_PAGE_BOTTOM } from "../read/ReadParchmentPageScroll";
import { readParchmentTheme as c } from "../read/readParchmentTheme";
import { parchmentControlStyles } from "../shell/parchmentControlSurface";
import { useShellSwipeSuspend } from "../shell/useShellSwipeSuspend";
import { ExploreBirthDatePicker } from "./ExploreBirthDatePicker";
import { exploreStyles as shared, useExploreScrollContentStyle } from "./exploreParchmentStyles";
import { isValidBirthDate, type ExploreBirthDate } from "./explore-birth-date";
import {
  defaultBirthDate,
  isValidExploreDisplayName,
  normalizeExploreDisplayName,
  readExploreYearDayProfile,
  writeExploreYearDayProfile,
} from "./explore-birth-year-prefs";
import { dismissRequiredYearDayBirthProfilePrompt } from "./explore-year-day-birth-prompt-session";

export const EXPLORE_YEAR_DAY_BIRTH_SETTINGS_PATH = "/explore/year-day-count/birth-settings";

type ExploreBirthYearSettingsProps = {
  /** 由数算年日页 Modal 嵌入，关闭时不走路由栈。 */
  embedded?: boolean;
  required?: boolean;
  onClose?: () => void;
  onSaved?: () => void;
};

function OptionalDateField({
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

export function ExploreBirthYearSettingsScreen({
  embedded = false,
  required: requiredProp,
  onClose,
  onSaved,
}: ExploreBirthYearSettingsProps = {}) {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const scrollContentStyle = useExploreScrollContentStyle({
    paddingTop: 8 + insets.top,
    paddingBottom: READ_PARCHMENT_PAGE_BOTTOM + insets.bottom,
  });
  const { required: requiredParam } = useLocalSearchParams<{ required?: string }>();
  const required = requiredProp ?? requiredParam === "1";
  const didSaveRef = useRef(false);

  const [selectedDate, setSelectedDate] = useState<ExploreBirthDate>(() => defaultBirthDate());
  const [displayName, setDisplayName] = useState("");
  const [weddingAnniversary, setWeddingAnniversary] = useState<ExploreBirthDate | null>(null);
  const [baptismDate, setBaptismDate] = useState<ExploreBirthDate | null>(null);
  const [sheetScrollEnabled, setSheetScrollEnabled] = useState(true);

  useShellSwipeSuspend(!embedded);

  useEffect(() => {
    if (embedded) return;
    const unsub = navigation.addListener("beforeRemove", () => {
      if (!didSaveRef.current) {
        dismissRequiredYearDayBirthProfilePrompt();
      }
    });
    return unsub;
  }, [embedded, navigation]);

  useEffect(() => {
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      void readExploreYearDayProfile().then((profile) => {
        if (cancelled) return;
        setSelectedDate(profile.birthDate ?? defaultBirthDate());
        setDisplayName(profile.displayName ?? "");
        setWeddingAnniversary(profile.weddingAnniversary);
        setBaptismDate(profile.baptismDate);
      });
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, []);

  const nameValid = useMemo(() => isValidExploreDisplayName(displayName), [displayName]);
  const dateValid = useMemo(() => isValidBirthDate(selectedDate), [selectedDate]);
  const weddingValid = useMemo(
    () => weddingAnniversary == null || isValidBirthDate(weddingAnniversary),
    [weddingAnniversary],
  );
  const baptismValid = useMemo(
    () => baptismDate == null || isValidBirthDate(baptismDate),
    [baptismDate],
  );
  const canSave = nameValid && dateValid && weddingValid && baptismValid;

  const finishClose = useCallback(() => {
    dismissRequiredYearDayBirthProfilePrompt();
    if (onClose) {
      onClose();
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/explore/year-day-count");
  }, [onClose, router]);

  const close = useCallback(() => {
    finishClose();
  }, [finishClose]);

  const saveProfile = useCallback(async () => {
    if (!canSave) return;
    await writeExploreYearDayProfile({
      birthDate: selectedDate,
      displayName: normalizeExploreDisplayName(displayName),
      weddingAnniversary,
      baptismDate,
    });
    didSaveRef.current = true;
    if (onSaved) {
      onSaved();
      return;
    }
    finishClose();
  }, [
    baptismDate,
    canSave,
    displayName,
    finishClose,
    onSaved,
    selectedDate,
    weddingAnniversary,
  ]);

  const suspendSheetScroll = useCallback(() => setSheetScrollEnabled(false), []);
  const resumeSheetScroll = useCallback(() => setSheetScrollEnabled(true), []);
  const hint = t("pages.explore.birthYearModalHint");

  return (
    <View style={shared.root}>
      <ParchmentBottomFadeScrollView
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

        <OptionalDateField
          label={t("pages.explore.birthYearModalWeddingLabel")}
          value={weddingAnniversary}
          onChange={setWeddingAnniversary}
          setLabel={t("pages.explore.birthYearModalWeddingSet")}
          clearLabel={t("pages.explore.birthYearModalWeddingClear")}
          suspendSheetScroll={suspendSheetScroll}
          resumeSheetScroll={resumeSheetScroll}
        />

        <OptionalDateField
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
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 18,
    ...parchmentSans(600),
    color: c.ink,
    textAlign: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleSpacer: {
    minWidth: 44,
  },
  topCloseBtn: {
    minWidth: 44,
    paddingVertical: 4,
    alignItems: "flex-end",
  },
  topBackBtn: {
    alignItems: "flex-start",
  },
  topCloseText: {
    fontSize: 13,
    ...parchmentSans(500),
    color: c.faint,
  },
  hint: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 20,
    color: c.muted,
    textAlign: "center",
  },
  fieldLabel: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 12,
    ...parchmentSans(600),
    color: c.muted,
    textAlign: "center",
    letterSpacing: 0.2,
  },
  fieldLabelSpaced: {
    marginTop: 14,
  },
  pickerBlock: {
    marginTop: 8,
  },
  optionalSetText: {
    fontSize: 14,
    ...parchmentSans(600),
    color: c.muted,
    textAlign: "center",
  },
  optionalClearBtn: {
    alignSelf: "center",
    marginTop: 10,
    paddingVertical: 4,
  },
  optionalClearText: {
    fontSize: 12,
    ...parchmentSans(500),
    color: c.faint,
    textAlign: "center",
  },
  nameInput: {
    ...parchmentSans(500),
  },
  actions: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  btnPrimary: {
    backgroundColor: c.ink,
    borderColor: c.ink,
  },
  btnDisabled: { opacity: 0.42 },
  btnPressed: { opacity: 0.85 },
  btnGhost: {
    fontSize: 14,
    ...parchmentSans(600),
    color: c.muted,
    textAlign: "center",
  },
  btnPrimaryText: {
    fontSize: 14,
    ...parchmentSans(600),
    color: "#fffaf2",
    textAlign: "center",
  },
});
