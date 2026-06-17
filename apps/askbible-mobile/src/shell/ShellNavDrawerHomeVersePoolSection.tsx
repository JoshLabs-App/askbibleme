import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { AppLocale } from "../i18n/config";
import { resolveUiText } from "../i18n/site-copy";
import {
  HOME_VERSE_POOL_SCOPE_OPTIONS,
  resolveHomeVersePoolScopeLabelWithCount,
  type HomeVersePoolScopeId,
} from "../explore/explore-home-verse-pool-scopes";
import { setHomeVersePoolScope } from "../home/homeVersePoolScopePrefs";
import { shellNavDrawerStyles as styles } from "./shellNavDrawerStyles";

type Props = {
  locale: AppLocale;
  homeVersePoolScope: HomeVersePoolScopeId;
};

export function ShellNavDrawerHomeVersePoolSection({ locale, homeVersePoolScope }: Props) {
  const [poolPickerOpen, setPoolPickerOpen] = useState(false);
  const currentPool =
    HOME_VERSE_POOL_SCOPE_OPTIONS.find((scope) => scope.id === homeVersePoolScope) ??
    HOME_VERSE_POOL_SCOPE_OPTIONS[0];

  return (
    <>
      <Text style={styles.sectionLabelCompact}>
        {resolveUiText(locale, "主页经文池", "Home verse pool")}
      </Text>
      <Pressable
        style={({ pressed }) => [
          styles.poolSelectTrigger,
          pressed ? styles.poolSelectTriggerPressed : null,
        ]}
        onPress={() => setPoolPickerOpen((v) => !v)}
      >
        <Text style={styles.poolSelectLabel}>{resolveUiText(locale, "当前选择", "Current")}</Text>
        <View style={styles.poolSelectValueWrap}>
          <Text style={styles.poolSelectValue}>
            {resolveHomeVersePoolScopeLabelWithCount(currentPool, locale)}
          </Text>
          <MaterialIcons
            name={poolPickerOpen ? "keyboard-arrow-up" : "keyboard-arrow-down"}
            size={16}
            color="rgba(85, 64, 36, 0.72)"
          />
        </View>
      </Pressable>
      {poolPickerOpen ? (
        <View style={styles.poolSelectOptions}>
          {HOME_VERSE_POOL_SCOPE_OPTIONS.map((scope) => {
            const selected = homeVersePoolScope === scope.id;
            return (
              <Pressable
                key={scope.id}
                style={[styles.poolSelectOption, selected ? styles.poolSelectOptionActive : null]}
                onPress={() => {
                  setPoolPickerOpen(false);
                  void setHomeVersePoolScope(scope.id as HomeVersePoolScopeId);
                }}
              >
                <Text
                  style={[
                    styles.poolSelectOptionText,
                    selected ? styles.poolSelectOptionTextActive : null,
                  ]}
                >
                  {resolveHomeVersePoolScopeLabelWithCount(scope, locale)}
                </Text>
                {selected ? (
                  <MaterialIcons name="check" size={14} color="#A56A2D" />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </>
  );
}
