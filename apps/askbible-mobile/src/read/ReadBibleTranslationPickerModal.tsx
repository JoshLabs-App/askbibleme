import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ParchmentExploreOverlay, ParchmentModalCard } from "../shell/ParchmentControlSheet";
import { shellTabBarScrollPad } from "../shell/shellLayout";
import { ShellSystemBackButton } from "../shell/ShellSystemBackButton";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "./readParchmentTheme";
import type { BibleTranslationMeta } from "../bible/translations-types";
import type { AppLocale } from "../i18n/config";
import { translationSourceTone } from "./readBibleTranslationSourceTone";
import { sortPickerTranslations, translationOptionLabel, shortLabel } from "./readBibleSettingsPanelConstants";
import { translationSupportsChapterAudio } from "../bible/read-chapter-audio";

type Props = {
  visible: boolean;
  onClose: () => void;
  locale: AppLocale;
  translationCatalog: BibleTranslationMeta[];
  mode: "single" | "multi";
  selectedTranslationId?: string;
  selectedTranslationIds?: string[];
  onSelectTranslation?: (id: string) => void | Promise<void>;
  onConfirmTranslations?: (ids: string[]) => void | Promise<void>;
  extraOptions?: {
    key: string;
    label: string;
    meta?: string;
    selected?: boolean;
    onPress: () => void | Promise<void>;
  }[];
  translationAccessoryIconName?: (
    translation: BibleTranslationMeta,
  ) => keyof typeof MaterialIcons.glyphMap | null;
  /**
   * `stack`：读经 Stack 全页（底栏可见，对齐经文搜索）
   * `fullScreen` / `card`：Modal
   */
  presentation?: "fullScreen" | "card" | "stack";
  /** 直接先展示语言分类，再展示该语言的版本。 */
  languageFirst?: boolean;
  title?: string;
  subtitle?: string;
};

type PickerViewMode = "common" | "all";

const LANGUAGE_PRIORITY = ["zh-Hans", "zh-Hant", "en", "es", "he"] as const;

function languageDisplayName(language: string, locale: AppLocale): string {
  const lang = String(language || "").trim().toLowerCase();
  if (locale === "en") {
    if (lang.startsWith("zh-hant")) return "Trad. Chinese";
    if (lang.startsWith("zh")) return "Simp. Chinese";
    if (lang.startsWith("en")) return "English";
    if (lang.startsWith("es")) return "Spanish";
    if (lang.startsWith("he")) return "Hebrew";
    return lang || "Other";
  }
  if (lang.startsWith("zh-hant")) return "繁中";
  if (lang.startsWith("zh")) return "简中";
  if (lang.startsWith("en")) return "英文";
  if (lang.startsWith("es")) return "西班牙语";
  if (lang.startsWith("he")) return "希伯来语";
  return "其他";
}

function languageSortKey(language: string): number {
  const idx = LANGUAGE_PRIORITY.findIndex((item) => language.toLowerCase().startsWith(item.toLowerCase()));
  return idx >= 0 ? idx : LANGUAGE_PRIORITY.length;
}

function sortTranslationsForLanguage(items: BibleTranslationMeta[], locale: AppLocale): BibleTranslationMeta[] {
  if (items.length <= 1) return items;
  const language = items[0]?.language ?? "";
  if (language.startsWith("zh")) return sortPickerTranslations(items, locale === "zh-TW" ? "zh-TW" : "zh-CN");
  if (language.startsWith("en")) return sortPickerTranslations(items, "en");
  if (language.startsWith("es")) {
    const order = ["rv1909-es", "rvg-es", "vbl-es", "blm-es"];
    const rank = new Map(order.map((id, index) => [id, index]));
    return [...items].sort((a, b) => (rank.get(a.id) ?? order.length) - (rank.get(b.id) ?? order.length));
  }
  return [...items].sort((a, b) => a.labelEn.localeCompare(b.labelEn));
}

function toneStyle(sourceTone: ReturnType<typeof translationSourceTone>) {
  switch (sourceTone) {
    case "youversion":
      return styles.labelYouVersion;
    case "api-bible":
    case "esv":
      return styles.labelApiBible;
    case "bundled":
    default:
      return styles.labelBundled;
  }
}

function normalizeSearch(input: string): string {
  return String(input || "")
    .trim()
    .toLowerCase();
}

function translationSearchHaystack(tr: BibleTranslationMeta, locale: AppLocale): string {
  const label = translationOptionLabel(tr, locale);
  const short = shortLabel(tr.id, locale, label);
  return [tr.id, tr.labelZh, tr.labelEn, label, short].join(" ").toLowerCase();
}

export function ReadBibleTranslationPickerModal({
  visible,
  onClose,
  locale,
  translationCatalog,
  mode,
  selectedTranslationId,
  selectedTranslationIds,
  onSelectTranslation,
  onConfirmTranslations,
  extraOptions,
  translationAccessoryIconName,
  presentation = "fullScreen",
  languageFirst = false,
  title: titleProp,
  subtitle: subtitleProp,
}: Props) {
  const insets = useSafeAreaInsets();
  const groups = useMemo(() => {
    const byLanguage = new Map<string, BibleTranslationMeta[]>();
    for (const tr of translationCatalog) {
      const lang = String(tr.language || "").trim() || "other";
      const next = byLanguage.get(lang) ?? [];
      next.push(tr);
      byLanguage.set(lang, next);
    }
    return [...byLanguage.entries()]
      .map(([language, items]) => ({
        language,
        items: sortTranslationsForLanguage(items, locale),
      }))
      .sort((a, b) => {
        const byPriority = languageSortKey(a.language) - languageSortKey(b.language);
        if (byPriority !== 0) return byPriority;
        return languageDisplayName(a.language, locale).localeCompare(languageDisplayName(b.language, locale));
      });
  }, [locale, translationCatalog]);

  const [activeLanguage, setActiveLanguage] = useState(() => {
    const selected = translationCatalog.find((item) => item.id === selectedTranslationId);
    return selected?.language ?? groups[0]?.language ?? "en";
  });
  const [viewMode, setViewMode] = useState<PickerViewMode>(languageFirst ? "all" : "common");
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [languageMenuAnchor, setLanguageMenuAnchor] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [searchText, setSearchText] = useState("");
  const [draftSelectedIds, setDraftSelectedIds] = useState<string[]>(selectedTranslationIds ?? []);
  const wasVisibleRef = useRef(false);
  const languageTriggerRef = useRef<View>(null);
  const searchQuery = useMemo(() => normalizeSearch(searchText), [searchText]);

  const closeLanguageMenu = useCallback(() => {
    setLanguageMenuOpen(false);
    setLanguageMenuAnchor(null);
  }, []);

  const openLanguageMenu = useCallback(() => {
    languageTriggerRef.current?.measureInWindow((x, y, width, height) => {
      setLanguageMenuAnchor({ x, y, width, height });
      setLanguageMenuOpen(true);
    });
  }, []);

  const commonTranslations = useMemo(
    () => sortPickerTranslations(translationCatalog, locale).slice(0, 10),
    [locale, translationCatalog],
  );

  useEffect(() => {
    if (visible && !wasVisibleRef.current) {
      const selected = translationCatalog.find((item) => item.id === selectedTranslationId);
      setActiveLanguage(selected?.language ?? groups[0]?.language ?? "en");
      setViewMode(languageFirst ? "all" : "common");
      setLanguageMenuOpen(false);
      setLanguageMenuAnchor(null);
      setSearchText("");
      setDraftSelectedIds(selectedTranslationIds ?? []);
    }
    wasVisibleRef.current = visible;
  }, [visible, selectedTranslationId, selectedTranslationIds, translationCatalog, groups, languageFirst]);

  useEffect(() => {
    if (!groups.some((group) => group.language === activeLanguage)) {
      setActiveLanguage(groups[0]?.language ?? "en");
    }
  }, [activeLanguage, groups]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery) return groups;
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((tr) => translationSearchHaystack(tr, locale).includes(searchQuery)),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, locale, searchQuery]);

  const filteredCommonTranslations = useMemo(() => {
    if (!searchQuery) return commonTranslations;
    return commonTranslations.filter((tr) => translationSearchHaystack(tr, locale).includes(searchQuery));
  }, [commonTranslations, locale, searchQuery]);
  const filteredExtraOptions = useMemo(() => {
    if (!extraOptions?.length) return [];
    if (!searchQuery) return extraOptions;
    return extraOptions.filter((opt) =>
      [opt.label, opt.meta ?? ""].join(" ").toLowerCase().includes(searchQuery),
    );
  }, [extraOptions, searchQuery]);

  useEffect(() => {
    if (!searchQuery) return;
    const firstVisibleLanguage = filteredGroups[0]?.language;
    if (firstVisibleLanguage && firstVisibleLanguage !== activeLanguage) {
      setActiveLanguage(firstVisibleLanguage);
    }
  }, [activeLanguage, filteredGroups, searchQuery]);

  const activeGroup =
    filteredGroups.find((group) => group.language === activeLanguage) ?? filteredGroups[0];
  const visibleTranslations = activeGroup?.items ?? [];

  const visibleLanguageGroups = searchQuery ? filteredGroups : groups;
  const activeLanguageGroup =
    visibleLanguageGroups.find((group) => group.language === activeLanguage) ?? visibleLanguageGroups[0];
  const isAllView = viewMode === "all";
  const commonLabel = locale === "en" ? "Common" : "常用";
  const allLabel = locale === "en" ? "All" : "全部";
  const confirmLabel = locale === "en" ? "Done" : "完成";
  const languageMenuLabel = locale === "en" ? "Language" : "语言";
  const activeLanguageLabel = activeLanguageGroup
    ? `${languageDisplayName(activeLanguageGroup.language, locale)}  ${activeLanguageGroup.items.length}`
    : languageMenuLabel;

  if (!visible) return null;

  /** 全页（fullScreen / stack）用居中标题，对齐经文搜索；卡片仍用左右标题栏。 */
  const useCenteredHeader = presentation === "stack" || presentation === "fullScreen";
  const title =
    titleProp ??
    (mode === "multi"
      ? locale === "en"
        ? "Choose parallel"
        : "选择对照本"
      : locale === "en"
        ? "Choose translation"
        : "选择译本");
  const subtitle =
    subtitleProp ??
    (mode === "multi"
      ? locale === "en"
        ? "Select one or more, then tap Done."
        : "可多选，点完成保存。"
      : locale === "en"
        ? "Pick a language first, then choose a version."
        : "先选语言，再选这个语言里的版本。");

  const page = (
      <View
        style={[
          styles.page,
          presentation === "stack" && [
            styles.stackPage,
            {
              paddingTop: Math.max(insets.top, 12) + 8,
              paddingBottom: shellTabBarScrollPad(insets.bottom, -8),
            },
          ],
        ]}
      >
        {useCenteredHeader ? (
          <>
            <ShellSystemBackButton onPress={onClose} />
            <View>
              <Text style={styles.stackTitle}>{title}</Text>
              <Text style={styles.stackSubtitle}>{subtitle}</Text>
            </View>
          </>
        ) : (
          <View style={styles.header}>
            <ShellSystemBackButton onPress={onClose} />
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle}>{title}</Text>
              <Text style={styles.headerSubtitle}>{subtitle}</Text>
            </View>
          </View>
        )}

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={18} color={c.faint} />
            <TextInput
              value={searchText}
              onChangeText={(next) => {
                setSearchText(next);
                closeLanguageMenu();
              }}
              placeholder={locale === "en" ? "Search translations" : "搜索译本"}
              placeholderTextColor={c.faint}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              clearButtonMode="never"
              {...(Platform.OS === "android"
                ? { includeFontPadding: false, textAlignVertical: "center" as const }
                : null)}
            />
            {searchText.trim() ? (
              <Pressable
                onPress={() => setSearchText("")}
                hitSlop={10}
                style={styles.searchClear}
                accessibilityRole="button"
                accessibilityLabel={locale === "en" ? "Clear search" : "清除搜索"}
              >
                <MaterialIcons name="close" size={16} color={c.faint} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {!languageFirst ? (
          <View style={styles.viewToggleRow}>
            <Pressable
              onPress={() => setViewMode("common")}
              style={({ pressed }) => [
                styles.viewToggleChip,
                !isAllView && styles.viewToggleChipActive,
                pressed && styles.viewToggleChipPressed,
              ]}
            >
              <Text style={[styles.viewToggleText, !isAllView && styles.viewToggleTextActive]}>
                {commonLabel}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setViewMode("all")}
              style={({ pressed }) => [
                styles.viewToggleChip,
                isAllView && styles.viewToggleChipActive,
                pressed && styles.viewToggleChipPressed,
              ]}
            >
              <Text style={[styles.viewToggleText, isAllView && styles.viewToggleTextActive]}>
                {allLabel}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {isAllView || languageFirst ? (
          <View ref={languageTriggerRef} collapsable={false} style={styles.languageDropdownWrap}>
            <Pressable
              onPress={languageMenuOpen ? closeLanguageMenu : openLanguageMenu}
              style={({ pressed }) => [
                styles.languageDropdownTrigger,
                languageMenuOpen && styles.languageDropdownTriggerOpen,
                pressed && styles.languageDropdownTriggerPressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ expanded: languageMenuOpen }}
              accessibilityLabel={languageMenuLabel}
            >
              <Text style={styles.languageDropdownValue} numberOfLines={1}>
                {activeLanguageLabel}
              </Text>
              <MaterialIcons
                name={languageMenuOpen ? "expand-less" : "expand-more"}
                size={22}
                color={c.muted}
              />
            </Pressable>
          </View>
        ) : (
          <View style={styles.commonStrip}>
            <Text style={styles.commonStripLabel}>
              {locale === "en" ? "Top versions" : "常用版本"}
            </Text>
          </View>
        )}

        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator>
          {filteredExtraOptions.map((opt) => (
            <Pressable
              key={opt.key}
              onPress={() => {
                void opt.onPress();
                onClose();
              }}
              style={({ pressed }) => [
                styles.versionCard,
                opt.selected && styles.versionCardSelected,
                pressed && styles.versionCardPressed,
              ]}
            >
              <View style={styles.versionMain}>
                <Text
                  style={[styles.versionExtraLabel, opt.selected && styles.versionLabelSelected]}
                  numberOfLines={2}
                >
                  {opt.label}
                </Text>
                {opt.meta ? (
                  <Text style={styles.versionMeta} numberOfLines={1}>
                    {opt.meta}
                  </Text>
                ) : null}
              </View>
              <View style={styles.versionTail}>
                {opt.selected ? (
                  <MaterialIcons name="check-circle" size={18} color={c.parchmentAccent} />
                ) : null}
              </View>
            </Pressable>
          ))}
          {!isAllView && filteredCommonTranslations.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>
                {locale === "en" ? "No matches" : "没有找到匹配结果"}
              </Text>
              <Text style={styles.emptyBody}>
                {locale === "en"
                  ? "Try another language or clear the search."
                  : "换个语言，或者清除搜索。"}
              </Text>
            </View>
          ) : isAllView && visibleTranslations.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>
                {locale === "en" ? "No matches" : "没有找到匹配结果"}
              </Text>
              <Text style={styles.emptyBody}>
                {locale === "en"
                  ? "Try another language or clear the search."
                  : "换个语言，或者清除搜索。"}
              </Text>
            </View>
          ) : (isAllView ? visibleTranslations : filteredCommonTranslations).map((tr) => {
            const selected = mode === "multi" ? draftSelectedIds.includes(tr.id) : tr.id === selectedTranslationId;
            const defaultAccessoryIconName = translationSupportsChapterAudio(tr.id) ? "volume-up" : null;
            const accessoryIconName = translationAccessoryIconName
              ? translationAccessoryIconName(tr)
              : defaultAccessoryIconName;
            const tone = translationSourceTone(tr);
            const label = translationOptionLabel(tr, locale);
            return (
              <Pressable
                key={tr.id}
                onPress={() => {
                  if (mode === "multi") {
                    setDraftSelectedIds((current) =>
                      current.includes(tr.id) ? current.filter((id) => id !== tr.id) : [...current, tr.id],
                    );
                    return;
                  }
                  void onSelectTranslation?.(tr.id);
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.versionCard,
                  selected && styles.versionCardSelected,
                  pressed && styles.versionCardPressed,
                ]}
              >
                <View style={styles.versionMain}>
                  <Text
                    style={[styles.versionLabel, toneStyle(tone), selected && styles.versionLabelSelected]}
                    numberOfLines={2}
                  >
                    {label}
                  </Text>
                </View>
                <View style={styles.versionTail}>
                  {accessoryIconName ? (
                    <MaterialIcons
                      name={accessoryIconName}
                      size={18}
                      color={selected ? c.parchmentAccent : c.faint}
                    />
                  ) : null}
                  {selected ? (
                    mode === "multi" ? (
                      <MaterialIcons name="check-box" size={18} color={c.parchmentAccent} />
                    ) : (
                      <MaterialIcons name="check-circle" size={18} color={c.parchmentAccent} />
                    )
                  ) : mode === "multi" ? (
                    <MaterialIcons name="check-box-outline-blank" size={18} color={c.faint} />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
        {mode === "multi" ? (
          <View style={styles.footer}>
            <Pressable
              onPress={() => {
                void onConfirmTranslations?.(draftSelectedIds);
                onClose();
              }}
              style={({ pressed }) => [
                styles.doneBtn,
                pressed && styles.doneBtnPressed,
              ]}
            >
              <Text style={styles.doneBtnText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        ) : null}

        <Modal
          visible={languageMenuOpen && languageMenuAnchor != null}
          transparent
          animationType="fade"
          statusBarTranslucent={Platform.OS === "android"}
          onRequestClose={closeLanguageMenu}
        >
          <View style={styles.languageDropdownModalRoot}>
            <Pressable
              style={styles.languageDropdownScrim}
              onPress={closeLanguageMenu}
              accessibilityRole="button"
              accessibilityLabel={locale === "en" ? "Close language menu" : "关闭语言菜单"}
            />
            {languageMenuAnchor ? (
              <View
                pointerEvents="box-none"
                style={[
                  styles.languageDropdownFloating,
                  {
                    top: languageMenuAnchor.y,
                    left: languageMenuAnchor.x,
                    width: languageMenuAnchor.width,
                  },
                ]}
              >
                <Pressable
                  onPress={closeLanguageMenu}
                  style={[styles.languageDropdownTrigger, styles.languageDropdownTriggerOpen]}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: true }}
                  accessibilityLabel={languageMenuLabel}
                >
                  <Text style={styles.languageDropdownValue} numberOfLines={1}>
                    {activeLanguageLabel}
                  </Text>
                  <MaterialIcons name="expand-less" size={22} color={c.muted} />
                </Pressable>
                <View style={styles.languageDropdownMenu}>
                  {visibleLanguageGroups.map((group, index) => {
                    const active = group.language === activeLanguage;
                    return (
                      <Pressable
                        key={group.language}
                        onPress={() => {
                          setActiveLanguage(group.language);
                          closeLanguageMenu();
                        }}
                        style={({ pressed }) => [
                          styles.languageDropdownOption,
                          index === 0 && styles.languageDropdownOptionFirst,
                          active && styles.languageDropdownOptionActive,
                          pressed && styles.languageDropdownOptionPressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        <Text
                          style={[
                            styles.languageDropdownOptionText,
                            active && styles.languageDropdownOptionTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {languageDisplayName(group.language, locale)}
                        </Text>
                        <Text
                          style={[
                            styles.languageDropdownOptionCount,
                            active && styles.languageDropdownOptionTextActive,
                          ]}
                        >
                          {group.items.length}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </View>
        </Modal>
      </View>
  );

  if (presentation === "stack") {
    return page;
  }

  if (presentation === "card") {
    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View
          style={[
            styles.cardBackdrop,
            {
              paddingTop: Math.max(insets.top, 12),
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          <ParchmentModalCard fill style={styles.card}>{page}</ParchmentModalCard>
        </View>
      </Modal>
    );
  }

  return (
    <ParchmentExploreOverlay visible={visible} onClose={onClose}>
      {page}
    </ParchmentExploreOverlay>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    gap: 14,
  },
  stackPage: {
    backgroundColor: "transparent",
  },
  stackTitle: {
    fontSize: 22,
    lineHeight: 28,
    color: c.ink,
    textAlign: "center",
    marginBottom: 8,
    ...parchmentSans(600),
  },
  stackSubtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: c.muted,
    textAlign: "center",
    ...parchmentSans(500),
  },
  cardBackdrop: {
    flex: 1,
    paddingHorizontal: 10,
    backgroundColor: c.modalBackdrop,
  },
  card: {
    flex: 1,
    width: "100%",
    borderRadius: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  headerTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 20,
    lineHeight: 26,
    color: c.ink,
    ...parchmentSans(700),
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 19,
    color: c.faint,
    ...parchmentSans(500),
  },
  searchRow: {
    paddingHorizontal: 14,
  },
  viewToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
  },
  viewToggleChip: {
    minWidth: 70,
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  viewToggleChipActive: {
    backgroundColor: c.parchmentAccentGlow,
    borderColor: c.parchmentAccent,
  },
  viewToggleChipPressed: {
    opacity: 0.86,
  },
  viewToggleText: {
    fontSize: 15,
    color: c.muted,
    ...parchmentSans(600),
  },
  viewToggleTextActive: {
    color: c.parchmentAccent,
  },
  commonStrip: {
    paddingHorizontal: 14,
    paddingTop: 2,
  },
  commonStripLabel: {
    fontSize: 15,
    color: c.faint,
    ...parchmentSans(600),
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: Platform.OS === "android" ? 40 : 42,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "android" ? 6 : 9,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    margin: 0,
    fontSize: Platform.OS === "android" ? 15 : 16,
    lineHeight: Platform.OS === "android" ? 20 : undefined,
    color: c.ink,
    ...parchmentSans(500),
  },
  searchClear: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  languageDropdownModalRoot: {
    flex: 1,
  },
  languageDropdownScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(28, 20, 16, 0.38)",
  },
  languageDropdownWrap: {
    marginHorizontal: 14,
  },
  languageDropdownFloating: {
    position: "absolute",
  },
  languageDropdownTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: "#FFFEFA",
  },
  languageDropdownTriggerOpen: {
    borderColor: c.parchmentAccent,
    backgroundColor: "#FFFEFA",
  },
  languageDropdownTriggerPressed: {
    opacity: 0.92,
  },
  languageDropdownValue: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    lineHeight: 22,
    color: c.ink,
    ...parchmentSans(600),
  },
  languageDropdownMenu: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.borderStrong,
    backgroundColor: "#FFFEFA",
    overflow: "hidden",
  },
  languageDropdownOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    backgroundColor: "#FFFEFA",
  },
  languageDropdownOptionFirst: {
    borderTopWidth: 0,
  },
  languageDropdownOptionActive: {
    backgroundColor: "#F3E4CF",
  },
  languageDropdownOptionPressed: {
    backgroundColor: "#F7ECDD",
  },
  languageDropdownOptionText: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    lineHeight: 22,
    color: c.ink,
    ...parchmentSans(500),
  },
  languageDropdownOptionCount: {
    fontSize: 14,
    lineHeight: 20,
    color: c.faint,
    ...parchmentSans(600),
  },
  languageDropdownOptionTextActive: {
    color: c.parchmentAccent,
    ...parchmentSans(600),
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 20,
    gap: 8,
  },
  footer: {
    paddingHorizontal: 14,
    paddingBottom: 18,
  },
  doneBtn: {
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: c.parchmentAccent,
  },
  doneBtnPressed: {
    opacity: 0.88,
  },
  doneBtnText: {
    fontSize: 14,
    color: "#fff",
    ...parchmentSans(700),
  },
  emptyState: {
    paddingHorizontal: 14,
    paddingVertical: 26,
    alignItems: "center",
    gap: 6,
  },
  emptyTitle: {
    fontSize: 14,
    color: c.ink,
    ...parchmentSans(700),
  },
  emptyBody: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
    color: c.faint,
    ...parchmentSans(500),
  },
  versionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  versionCardSelected: {
    backgroundColor: c.parchmentAccentGlow,
    borderColor: c.parchmentAccent,
  },
  versionCardPressed: {
    backgroundColor: c.hover,
  },
  versionMain: {
    flex: 1,
    minWidth: 0,
  },
  versionLabel: {
    fontSize: 18,
    lineHeight: 24,
    ...parchmentSans(600),
  },
  versionLabelSelected: {
    color: c.parchmentAccent,
  },
  versionExtraLabel: {
    fontSize: 18,
    lineHeight: 24,
    color: c.ink,
    ...parchmentSans(600),
  },
  versionMeta: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 18,
    color: c.faint,
    ...parchmentSans(500),
  },
  versionTail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  labelBundled: {
    color: c.parchmentAccent,
  },
  labelYouVersion: {
    color: "#2D6CE6",
  },
  labelApiBible: {
    color: "#0F8D73",
  },
});
