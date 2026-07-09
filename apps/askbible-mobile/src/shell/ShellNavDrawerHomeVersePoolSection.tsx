import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { AppLocale } from "../i18n/config";
import { resolveUiText } from "../i18n/site-copy";
import {
  buildHomeVersePoolMenuRows,
  DEFAULT_HOME_VERSE_POOL_MENU_SCOPE,
  resolveHomeVersePoolMenuLabel,
  type HomeVersePoolMenuScopeId,
} from "@/lib/home-prayer-pools/home-verse-pool-menu-scopes";
import { setHomeVersePoolScope } from "../home/homeVersePoolScopePrefs";
import {
  HOME_VERSE_ROTATION_SEC_OPTIONS,
  getHomeVerseRotationSec,
  hydrateHomeVerseRotationSec,
  subscribeHomeVerseRotationSec,
  writeHomeVerseRotationSec,
} from "../home/homeVerseRotationPrefs";
import { shellNavDrawerStyles as styles } from "./shellNavDrawerStyles";

const OPTIONS_MAX_HEIGHT = 280;

const NEW_TESTAMENT_HEADERS = new Set(["新约", "新約", "New Testament"]);
const OLD_TESTAMENT_HEADERS = new Set(["旧约", "舊約", "Old Testament"]);

function orderVersePoolMenuRowsNewTestamentFirst(
  rows: ReturnType<typeof buildHomeVersePoolMenuRows>,
): ReturnType<typeof buildHomeVersePoolMenuRows> {
  const head: ReturnType<typeof buildHomeVersePoolMenuRows> = [];
  const nt: ReturnType<typeof buildHomeVersePoolMenuRows> = [];
  const ot: ReturnType<typeof buildHomeVersePoolMenuRows> = [];
  let section: "head" | "nt" | "ot" = "head";

  for (const row of rows) {
    if (row.kind === "header") {
      if (NEW_TESTAMENT_HEADERS.has(row.label)) section = "nt";
      else if (OLD_TESTAMENT_HEADERS.has(row.label)) section = "ot";
    }
    if (section === "head") head.push(row);
    else if (section === "nt") nt.push(row);
    else ot.push(row);
  }

  return [...head, ...nt, ...ot];
}

type Props = {
  locale: AppLocale;
  selectedScope: HomeVersePoolMenuScopeId;
};

export function ShellNavDrawerHomeVersePoolSection({ locale, selectedScope }: Props) {
  const [open, setOpen] = useState(false);
  const stableSec = useSyncExternalStore(
    subscribeHomeVerseRotationSec,
    getHomeVerseRotationSec,
    getHomeVerseRotationSec,
  );
  const scope = selectedScope ?? DEFAULT_HOME_VERSE_POOL_MENU_SCOPE;
  const rows = useMemo(
    () => orderVersePoolMenuRowsNewTestamentFirst(buildHomeVersePoolMenuRows(locale)),
    [locale],
  );
  const title = resolveUiText(locale, "停留时间", "Hold time");
  const hint = resolveUiText(locale, "默认 7 秒", "Default 7s");

  useEffect(() => {
    void hydrateHomeVerseRotationSec();
  }, []);

  return (
    <>
      <Text style={styles.sectionLabelCompact}>
        {resolveUiText(locale, "主页经文池", "Home verse pool")}
      </Text>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => [styles.poolSelectTrigger, pressed && styles.poolSelectTriggerPressed]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityHint={resolveUiText(locale, "展开经文池列表", "Expand verse pool list")}
      >
        <Text style={styles.poolSelectLabel}>{resolveUiText(locale, "当前池", "Pool")}</Text>
        <View style={styles.poolSelectValueWrap}>
          <Text style={styles.poolSelectValue}>{resolveHomeVersePoolMenuLabel(scope, locale)}</Text>
          <MaterialIcons
            name={open ? "expand-less" : "expand-more"}
            size={18}
            color="rgba(55, 53, 47, 0.55)"
          />
        </View>
      </Pressable>
      {open ? (
        <View style={styles.poolSelectOptions}>
          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: OPTIONS_MAX_HEIGHT }}
            showsVerticalScrollIndicator
          >
            {rows.map((row, index) =>
              row.kind === "header" ? (
                <View key={`h-${row.label}-${index}`} style={styles.poolSelectOptionGroup}>
                  <Text style={styles.poolSelectOptionGroupText}>{row.label}</Text>
                </View>
              ) : (
                <Pressable
                  key={row.scopeId}
                  onPress={() => {
                    void setHomeVersePoolScope(row.scopeId);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.poolSelectOption,
                    row.indent ? styles.poolSelectOptionIndent : null,
                    scope === row.scopeId ? styles.poolSelectOptionActive : null,
                    pressed ? styles.poolSelectTriggerPressed : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.poolSelectOptionText,
                      scope === row.scopeId ? styles.poolSelectOptionTextActive : null,
                    ]}
                  >
                    {row.label}
                  </Text>
                </Pressable>
              ),
            )}
          </ScrollView>
        </View>
      ) : null}
      <View style={styles.holdTimeBlock}>
        <Text style={styles.sectionLabelCompact}>{title}</Text>
        <Text style={styles.holdTimeHint}>{hint}</Text>
        <View style={styles.holdTimeChoicesWrap}>
          {HOME_VERSE_ROTATION_SEC_OPTIONS.map((sec) => {
            const selected = stableSec === sec;
            return (
              <Pressable
                key={sec}
                onPress={() => {
                  void writeHomeVerseRotationSec(sec);
                }}
                style={({ pressed }) => [
                  styles.holdTimeChoice,
                  selected ? styles.holdTimeChoiceActive : null,
                  pressed ? styles.poolSelectTriggerPressed : null,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={resolveUiText(locale, `停留时间 ${sec} 秒`, `Hold time ${sec}s`)}
              >
                <Text style={[styles.holdTimeChoiceText, selected ? styles.holdTimeChoiceTextActive : null]}>
                  {resolveUiText(locale, `${sec} 秒`, `${sec}s`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </>
  );
}
