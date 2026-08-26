import { Modal, Pressable, TextInput, View } from "react-native";
import { useEffect, useState } from "react";
import { ExploreText as Text } from "./ExploreText";
import { t } from "../i18n/site-copy";
import { readParchmentTheme as c } from "../read/readParchmentTheme";
import { parchmentControlStyles } from "../shell/parchmentControlSurface";
import { ParchmentModalCard } from "../shell/ParchmentControlSheet";
import { isValidExploreDisplayName } from "./explore-birth-year-prefs";
import { exploreGreetingNameModalStyles as styles } from "./ExploreGreetingNameModalStyles";

type Props = {
  visible: boolean;
  initialName: string;
  onClose: () => void;
  onSave: (name: string) => void | Promise<void>;
};

export function ExploreGreetingNameModal({ visible, initialName, onClose, onSave }: Props) {
  const [value, setValue] = useState(initialName);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setValue(initialName);
  }, [visible, initialName]);

  const canSave = isValidExploreDisplayName(value) && !saving;

  const submit = () => {
    if (!canSave) return;
    void (async () => {
      setSaving(true);
      try {
        await onSave(value.trim());
      } finally {
        setSaving(false);
      }
    })();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button">
        <ParchmentModalCard style={styles.card} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>{t("pages.explore.greetingEditTitle")}</Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder={t("pages.explore.birthYearModalNamePlaceholder")}
            placeholderTextColor={c.faint}
            style={[parchmentControlStyles.field, styles.input]}
            maxLength={24}
            autoCorrect={false}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={submit}
          />
          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
              accessibilityRole="button"
              accessibilityLabel={t("pages.explore.birthYearModalCancel")}
            >
              <Text style={styles.btnTextMuted}>{t("pages.explore.birthYearModalCancel")}</Text>
            </Pressable>
            <Pressable
              disabled={!canSave}
              onPress={submit}
              style={({ pressed }) => [
                styles.btn,
                styles.btnPrimary,
                !canSave && styles.btnDisabled,
                pressed && canSave && styles.btnPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t("pages.explore.birthYearModalSave")}
            >
              <Text style={styles.btnTextPrimary}>{t("pages.explore.birthYearModalSave")}</Text>
            </Pressable>
          </View>
        </ParchmentModalCard>
      </Pressable>
    </Modal>
  );
}
