import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t } from "../i18n/site-copy";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "../read/readParchmentTheme";
import { useShellSwipeSuspend } from "../shell/useShellSwipeSuspend";
import { ExploreBirthDatePicker } from "./ExploreBirthDatePicker";
import { isValidBirthDate, type ExploreBirthDate } from "./explore-birth-date";
import {
  defaultBirthDate,
  isValidExploreDisplayName,
  normalizeExploreDisplayName,
  readExploreYearDayProfile,
  writeExploreYearDayProfile,
} from "./explore-birth-year-prefs";

export type ExploreYearDayProfileSaved = {
  birthDate: ExploreBirthDate;
  displayName: string;
  weddingAnniversary: ExploreBirthDate | null;
  baptismDate: ExploreBirthDate | null;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved: (profile: ExploreYearDayProfileSaved) => void;
  /** 可选：保留兼容旧调用方；当前默认允许关闭。 */
  required?: boolean;
};

function OptionalDateField({
  label,
  value,
  onChange,
  setLabel,
  clearLabel,
}: {
  label: string;
  value: ExploreBirthDate | null;
  onChange: (date: ExploreBirthDate | null) => void;
  setLabel: string;
  clearLabel: string;
}) {
  return (
    <>
      <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>{label}</Text>
      {value ? (
        <>
          <ExploreBirthDatePicker value={value} onChange={onChange} />
          <Pressable
            onPress={() => onChange(null)}
            style={({ pressed }) => [styles.optionalClearBtn, pressed && styles.modalBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel={clearLabel}
          >
            <Text style={styles.optionalClearText}>{clearLabel}</Text>
          </Pressable>
        </>
      ) : (
        <Pressable
          onPress={() => onChange(defaultBirthDate())}
          style={({ pressed }) => [styles.optionalSetBtn, pressed && styles.modalBtnPressed]}
          accessibilityRole="button"
          accessibilityLabel={setLabel}
        >
          <Text style={styles.optionalSetText}>{setLabel}</Text>
        </Pressable>
      )}
    </>
  );
}

export function ExploreBirthYearSettingsModal({ visible, onClose, onSaved, required = false }: Props) {
  const insets = useSafeAreaInsets();
  const [selectedDate, setSelectedDate] = useState<ExploreBirthDate>(() => defaultBirthDate());
  const [displayName, setDisplayName] = useState("");
  const [weddingAnniversary, setWeddingAnniversary] = useState<ExploreBirthDate | null>(null);
  const [baptismDate, setBaptismDate] = useState<ExploreBirthDate | null>(null);

  useShellSwipeSuspend(visible);

  useEffect(() => {
    if (!visible) return;
    void readExploreYearDayProfile().then((profile) => {
      setSelectedDate(profile.birthDate ?? defaultBirthDate());
      setDisplayName(profile.displayName ?? "");
      setWeddingAnniversary(profile.weddingAnniversary);
      setBaptismDate(profile.baptismDate);
    });
  }, [visible]);

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
  const canDismiss = true;

  const saveProfile = useCallback(async () => {
    if (!canSave) return;
    const profile = {
      birthDate: selectedDate,
      displayName: normalizeExploreDisplayName(displayName),
      weddingAnniversary,
      baptismDate,
    };
    await writeExploreYearDayProfile(profile);
    onSaved(profile);
    onClose();
  }, [canSave, selectedDate, displayName, weddingAnniversary, baptismDate, onClose, onSaved]);

  const hint = t("pages.explore.birthYearModalHint");

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      presentationStyle="overFullScreen"
      onRequestClose={canDismiss ? onClose : () => {}}
    >
      <View style={styles.modalRoot}>
        {!canDismiss ? (
          <View style={styles.modalBackdrop} accessibilityElementsHidden />
        ) : (
          <Pressable style={styles.modalBackdrop} onPress={onClose} accessibilityRole="button" />
        )}
        <View style={[styles.modalSheet, { paddingBottom: 20 + insets.bottom }]}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.modalScroll}
          >
            <View style={styles.modalTitleRow}>
              <View style={styles.modalTitleSpacer} />
              <Text style={styles.modalTitle}>
                {required ? t("pages.explore.birthYearModalRequiredTitle") : t("pages.explore.birthYearModalTitle")}
              </Text>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [styles.modalTopCloseBtn, pressed && styles.modalBtnPressed]}
                accessibilityRole="button"
                accessibilityLabel={t("pages.explore.birthYearModalCancel")}
              >
                <Text style={styles.modalTopCloseText}>{t("pages.explore.birthYearModalCancel")}</Text>
              </Pressable>
            </View>
            <Text style={styles.modalHint}>{hint}</Text>

            <Text style={styles.fieldLabel}>{t("pages.explore.birthYearModalNameLabel")}</Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder={t("pages.explore.birthYearModalNamePlaceholder")}
              placeholderTextColor={c.faint}
              style={styles.nameInput}
              maxLength={24}
              autoCorrect={false}
              returnKeyType="done"
              accessibilityLabel={t("pages.explore.birthYearModalNameLabel")}
            />

            <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>
              {t("pages.explore.birthYearModalDateLabel")}
            </Text>
            <ExploreBirthDatePicker value={selectedDate} onChange={setSelectedDate} />

            <OptionalDateField
              label={t("pages.explore.birthYearModalWeddingLabel")}
              value={weddingAnniversary}
              onChange={setWeddingAnniversary}
              setLabel={t("pages.explore.birthYearModalWeddingSet")}
              clearLabel={t("pages.explore.birthYearModalWeddingClear")}
            />

            <OptionalDateField
              label={t("pages.explore.birthYearModalBaptismLabel")}
              value={baptismDate}
              onChange={setBaptismDate}
              setLabel={t("pages.explore.birthYearModalBaptismSet")}
              clearLabel={t("pages.explore.birthYearModalBaptismClear")}
            />

            <View style={styles.modalActions}>
              {canDismiss ? (
                <Pressable
                  onPress={onClose}
                  style={({ pressed }) => [styles.modalBtn, pressed && styles.modalBtnPressed]}
                >
                  <Text style={styles.modalBtnGhost}>{t("pages.explore.birthYearModalCancel")}</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => void saveProfile()}
                disabled={!canSave}
                style={({ pressed }) => [
                  styles.modalBtn,
                  styles.modalBtnPrimary,
                  !canSave && styles.modalBtnDisabled,
                  pressed && canSave && styles.modalBtnPressed,
                ]}
              >
                <Text style={styles.modalBtnPrimaryText}>{t("pages.explore.birthYearModalSave")}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: c.modalBackdrop,
  },
  modalSheet: {
    maxHeight: "88%",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: c.surfaceSolid,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  modalScroll: {
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    ...parchmentSans(600),
    color: c.ink,
    textAlign: "center",
  },
  modalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitleSpacer: {
    minWidth: 44,
  },
  modalTopCloseBtn: {
    minWidth: 44,
    paddingVertical: 4,
    alignItems: "flex-end",
  },
  modalTopCloseText: {
    fontSize: 13,
    ...parchmentSans(500),
    color: c.faint,
  },
  modalHint: {
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
  optionalSetBtn: {
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: "rgba(255, 252, 245, 0.72)",
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 16,
    ...parchmentSans(500),
    color: c.ink,
    backgroundColor: "rgba(255, 252, 245, 0.72)",
    textAlign: "center",
  },
  modalActions: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  modalBtn: {
    minWidth: 100,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: "rgba(255, 252, 245, 0.55)",
  },
  modalBtnPrimary: {
    backgroundColor: c.ink,
    borderColor: c.ink,
  },
  modalBtnDisabled: { opacity: 0.42 },
  modalBtnPressed: { opacity: 0.85 },
  modalBtnGhost: {
    fontSize: 14,
    ...parchmentSans(600),
    color: c.muted,
    textAlign: "center",
  },
  modalBtnPrimaryText: {
    fontSize: 14,
    ...parchmentSans(600),
    color: "#fffaf2",
    textAlign: "center",
  },
});
