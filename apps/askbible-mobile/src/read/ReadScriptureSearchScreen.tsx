import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ReadParchmentPageScroll } from "./ReadParchmentPageScroll";
import {
  searchScriptureVersesMobile,
  type ScriptureSearchHit,
  type ScriptureSearchScope,
} from "../bible/search-scripture-verses";
import { SCRIPTURE_SEARCH_MIN_LEN } from "../bible/scripture-search";
import { t } from "../i18n/site-copy";
import { useReadBibleTypography } from "./ReadBibleTypographyContext";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { readTypography } from "./readTypography";

const SCOPE_OPTIONS: { key: ScriptureSearchScope; labelKey: string }[] = [
  { key: "all", labelKey: "pages.read.scriptureSearchScopeAll" },
  { key: "old", labelKey: "pages.read.scriptureSearchScopeOld" },
  { key: "new", labelKey: "pages.read.scriptureSearchScopeNew" },
];
const RECENT_SEARCH_STORAGE_KEY = "askbible-mobile-scripture-recent-searches-v1";
const RECENT_SEARCH_MAX_ITEMS = 8;

function renderHighlightedHitText(text: string, query: string) {
  const keyword = query.trim();
  if (!keyword) return text;
  const parts = text.split(keyword);
  if (parts.length <= 1) return text;
  return parts.map((part, idx) => (
    <Text key={`${part}-${idx}`}>
      {part}
      {idx < parts.length - 1 ? <Text style={styles.hitTextHighlight}>{keyword}</Text> : null}
    </Text>
  ));
}

export function ReadScriptureSearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { primaryTranslationId, translationCatalogReady } = useReadBibleTypography();
  const [scope, setScope] = useState<ScriptureSearchScope>("all");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ScriptureSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const persistRecentSearches = useCallback(async (next: string[]) => {
    try {
      await AsyncStorage.setItem(RECENT_SEARCH_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage write failures.
    }
  }, []);

  const pushRecentSearch = useCallback(
    (raw: string) => {
      const normalized = raw.trim().replace(/\s+/g, " ");
      if (normalized.length < SCRIPTURE_SEARCH_MIN_LEN) return;
      setRecentSearches((prev) => {
        const next = [
          normalized,
          ...prev.filter((item) => item.toLowerCase() !== normalized.toLowerCase()),
        ].slice(0, RECENT_SEARCH_MAX_ITEMS);
        void persistRecentSearches(next);
        return next;
      });
    },
    [persistRecentSearches],
  );

  useEffect(() => {
    let cancelled = false;
    const loadRecent = async () => {
      try {
        const raw = await AsyncStorage.getItem(RECENT_SEARCH_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return;
        const cleaned = parsed
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter((item) => item.length >= SCRIPTURE_SEARCH_MIN_LEN)
          .slice(0, RECENT_SEARCH_MAX_ITEMS);
        if (!cancelled) setRecentSearches(cleaned);
      } catch {
        // Ignore malformed storage data.
      }
    };
    void loadRecent();
    return () => {
      cancelled = true;
    };
  }, []);

  const runSearch = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (!q) {
        setResults([]);
        setSearched(false);
        setError(null);
        return;
      }
      if (q.length < SCRIPTURE_SEARCH_MIN_LEN) return;
      if (!translationCatalogReady) return;
      setLoading(true);
      setError(null);
      try {
        const hits = await searchScriptureVersesMobile(primaryTranslationId, q, scope);
        setResults(hits);
        setSearched(true);
        pushRecentSearch(q);
      } catch (e) {
        setResults([]);
        setSearched(true);
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [primaryTranslationId, pushRecentSearch, scope, translationCatalogReady],
  );

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearched(false);
      setError(null);
      return;
    }
    const timer = setTimeout(() => {
      void runSearch(q);
    }, 320);
    return () => clearTimeout(timer);
  }, [query, scope, runSearch]);

  const openHit = (hit: ScriptureSearchHit) => {
    router.push({
      pathname: "/read/[bookId]/[chapter]",
      params: {
        bookId: hit.bookId,
        chapter: String(hit.chapter),
        verse: String(hit.verse),
      },
    });
  };

  const hint =
    query.trim().length > 0 && query.trim().length < SCRIPTURE_SEARCH_MIN_LEN
      ? t("pages.read.scriptureSearchMinHint")
      : null;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <ReadParchmentPageScroll keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t("pages.read.scriptureSearchTitle")}</Text>
        <Text style={styles.lead}>{t("pages.read.scriptureSearchLead")}</Text>

        <View style={styles.scopeRow} accessibilityLabel={t("pages.read.scriptureSearchScopeAria")}>
          {SCOPE_OPTIONS.map((opt) => {
            const active = scope === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => setScope(opt.key)}
                style={[styles.scopeBtn, active && styles.scopeBtnOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t(opt.labelKey)}
              >
                <Text style={[styles.scopeBtnText, active && styles.scopeBtnTextOn]}>{t(opt.labelKey)}</Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("pages.read.scriptureSearchPlaceholder")}
          placeholderTextColor={c.faint}
          style={styles.input}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
          accessibilityLabel={t("pages.read.scriptureSearchPlaceholder")}
        />

        {recentSearches.length > 0 ? (
          <View style={styles.recentWrap} accessibilityLabel={t("pages.read.scriptureSearchRecentAria")}>
            <Text style={styles.recentTitle}>{t("pages.read.scriptureSearchRecentTitle")}</Text>
            <View style={styles.recentList}>
              {recentSearches.map((term) => (
                <Pressable
                  key={term}
                  onPress={() => {
                    setQuery(term);
                    void runSearch(term);
                  }}
                  style={({ pressed }) => [styles.recentChip, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={term}
                >
                  <Text style={styles.recentChipText}>{term}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        {loading ? <ActivityIndicator color={c.muted} style={styles.loader} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!loading && searched && results.length === 0 && !error ? (
          <Text style={styles.empty}>{t("pages.read.scriptureSearchEmpty")}</Text>
        ) : null}

        {results.map((hit) => (
          <Pressable
            key={`${hit.bookId}:${hit.chapter}:${hit.verse}`}
            onPress={() => openHit(hit)}
            style={({ pressed }) => [styles.hit, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`${hit.bookName} ${hit.chapter}:${hit.verse}`}
          >
            <Text style={styles.hitRef}>
              {hit.bookName} {hit.chapter}:{hit.verse}
            </Text>
            <Text style={styles.hitText} numberOfLines={3}>
              {renderHighlightedHitText(hit.text, query)}
            </Text>
          </Pressable>
        ))}
      </ReadParchmentPageScroll>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "transparent" },
  title: {
    fontSize: 22,
    ...parchmentSans(600),
    color: c.ink,
    textAlign: "center",
    marginBottom: 8,
  },
  lead: {
    fontSize: 13,
    lineHeight: 20,
    color: c.muted,
    textAlign: "center",
    marginBottom: 12,
  },
  scopeRow: {
    flexDirection: "row",
    alignSelf: "center",
    marginBottom: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
    padding: 3,
    gap: 2,
  },
  scopeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  scopeBtnOn: {
    backgroundColor: c.ink,
  },
  scopeBtnText: {
    fontSize: 13,
    ...parchmentSans(500),
    color: c.muted,
  },
  scopeBtnTextOn: {
    color: c.surface,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    borderRadius: 10,
    backgroundColor: c.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: c.ink,
    marginBottom: 8,
  },
  recentWrap: {
    marginTop: 2,
    marginBottom: 2,
  },
  recentTitle: {
    fontSize: 12,
    ...parchmentSans(500),
    color: c.muted,
    marginBottom: 6,
  },
  recentList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  recentChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    borderRadius: 999,
    backgroundColor: c.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  recentChipText: {
    fontSize: 12,
    ...parchmentSans(500),
    color: c.ink,
  },
  hint: {
    fontSize: 12,
    color: c.faint,
    textAlign: "center",
    marginBottom: 8,
  },
  loader: { marginVertical: 20 },
  error: {
    fontSize: 13,
    lineHeight: 20,
    color: c.muted,
    textAlign: "center",
    marginVertical: 12,
  },
  empty: {
    fontSize: 14,
    lineHeight: 22,
    color: c.muted,
    textAlign: "center",
    marginTop: 24,
  },
  hit: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    paddingVertical: 10,
  },
  hitRef: {
    fontSize: 14,
    ...parchmentSans(600),
    color: readTypography.breadcrumbColor,
    marginBottom: 3,
  },
  hitText: {
    fontSize: 14,
    lineHeight: 20,
    ...parchmentSans(500),
    color: readTypography.verseColor,
  },
  hitTextHighlight: {
    color: c.parchmentAccent,
    ...parchmentSans(700),
  },
  pressed: { opacity: 0.88 },
});
