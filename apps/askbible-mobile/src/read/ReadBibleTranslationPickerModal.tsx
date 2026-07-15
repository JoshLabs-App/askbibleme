import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ParchmentExploreOverlay } from "../shell/ParchmentControlSheet";
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
};

type PickerViewMode = "common" | "all";

const LANGUAGE_PRIORITY = ["zh-Hans", "zh-Hant", "en", "es", "he"] as const;

function languageDisplayName(language: string, locale: AppLocale): string {
  const lang = String(language || "").trim().toLowerCase();
  if (locale === "en") {
    if (lang.startsWith("zh-hant")) return "Chinese (Traditional)";
    if (lang.startsWith("zh")) return "Chinese (Simplified)";
    if (lang.startsWith("en")) return "English";
    if (lang.startsWith("es")) return "Spanish";
    if (lang.startsWith("he")) return "Hebrew";
    return lang || "Other";
  }
  if (lang.startsWith("zh-hant")) return "中文（繁體）";
  if (lang.startsWith("zh")) return "中文（简体）";
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
}: Props) {
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
  const [viewMode, setViewMode] = useState<PickerViewMode>("common");
  const [searchText, setSearchText] = useState("");
  const [draftSelectedIds, setDraftSelectedIds] = useState<string[]>(selectedTranslationIds ?? []);
  const wasVisibleRef = useRef(false);
  const searchQuery = useMemo(() => normalizeSearch(searchText), [searchText]);

  const commonTranslations = useMemo(
    () => sortPickerTranslations(translationCatalog, locale).slice(0, 10),
    [locale, translationCatalog],
  );

  useEffect(() => {
    if (visible && !wasVisibleRef.current) {
      const selected = translationCatalog.find((item) => item.id === selectedTranslationId);
      setActiveLanguage(selected?.language ?? groups[0]?.language ?? "en");
      setViewMode("common");
      setSearchText("");
      setDraftSelectedIds(selectedTranslationIds ?? []);
    }
    wasVisibleRef.current = visible;
  }, [visible, selectedTranslationId, selectedTranslationIds, translationCatalog, groups]);

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
  const isAllView = viewMode === "all";
  const commonLabel = locale === "en" ? "Common" : "常用";
  const allLabel = locale === "en" ? "All" : "全部";
  const confirmLabel = locale === "en" ? "Done" : "完成";

  if (!visible) return null;

  return (
    <ParchmentExploreOverlay visible={visible} onClose={onClose}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10} style={styles.headerBackBtn}>
            <MaterialIcons name="arrow-back" size={22} color={c.ink} />
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>{locale === "en" ? "Choose translation" : "选择译本"}</Text>
            <Text style={styles.headerSubtitle}>
              {locale === "en"
                ? "Pick a language first, then choose a version."
                : "先选语言，再选这个语言里的版本。"}
            </Text>
          </View>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={18} color={c.faint} />
            <TextInput
              value={searchText}
              onChangeText={setSearchText}
              placeholder={locale === "en" ? "Search translations" : "搜索译本"}
              placeholderTextColor={c.faint}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              clearButtonMode="never"
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

        {isAllView ? (
          <View style={styles.languageStrip}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.languageStripContent}>
              {visibleLanguageGroups.map((group) => {
                const active = group.language === activeLanguage;
                return (
                  <Pressable
                    key={group.language}
                    onPress={() => setActiveLanguage(group.language)}
                    style={({ pressed }) => [
                      styles.languageChip,
                      active && styles.languageChipActive,
                      pressed && styles.languageChipPressed,
                    ]}
                  >
                    <Text style={[styles.languageChipText, active && styles.languageChipTextActive]}>
                      {languageDisplayName(group.language, locale)}
                    </Text>
                    <Text style={[styles.languageChipCount, active && styles.languageChipCountActive]}>
                      {group.items.length}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
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
                <Text style={styles.versionExtraLabel} numberOfLines={2}>
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
            const short = shortLabel(tr.id, locale, label);
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
                  <Text style={[styles.versionLabel, toneStyle(tone)]} numberOfLines={2}>
                    {label}
                  </Text>
                  <Text style={styles.versionMeta} numberOfLines={1}>
                    {short}
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
      </View>
    </ParchmentExploreOverlay>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    gap: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  headerBackBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
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
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
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
  languageStrip: {
    paddingHorizontal: 10,
  },
  languageStripContent: {
    gap: 8,
    paddingHorizontal: 4,
  },
  languageChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  languageChipActive: {
    backgroundColor: c.parchmentAccentGlow,
    borderColor: c.parchmentAccent,
  },
  languageChipPressed: {
    opacity: 0.84,
  },
  languageChipText: {
    fontSize: 15,
    color: c.muted,
    ...parchmentSans(600),
  },
  languageChipTextActive: {
    color: c.parchmentAccent,
  },
  languageChipCount: {
    fontSize: 13,
    color: c.faint,
    ...parchmentSans(700),
  },
  languageChipCountActive: {
    color: c.parchmentAccent,
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
    backgroundColor: "rgba(255, 177, 3, 0.12)",
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
