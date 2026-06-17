import { useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  InteractionManager,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import { warmScriptureSearchDatabase } from "../bible/scripture-database";
import { SCRIPTURE_SEARCH_MIN_LEN } from "../bible/scripture-search";
import { t } from "../i18n/site-copy";
import { bundledBibleTranslationsCatalog } from "../api/fetchBibleTranslationsCatalog";
import { inferAppLocaleFromDevice } from "../i18n/config";
import { resolveDefaultPrimaryTranslationId } from "./read-bible-translation-prefs";
import { ReadBibleTypographyContext } from "./ReadBibleTypographyContext";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { readScriptureSearchScreenStyles as styles } from "./readScriptureSearchScreenStyles";
import { renderScriptureSearchHitText } from "./scriptureSearchHitText";
import {
  pushScriptureRecentSearch,
  readScriptureRecentSearches,
} from "./scripture-recent-searches";

const SCOPE_OPTIONS: { key: ScriptureSearchScope; labelKey: string }[] = [
  { key: "all", labelKey: "pages.read.scriptureSearchScopeAll" },
  { key: "old", labelKey: "pages.read.scriptureSearchScopeOld" },
  { key: "new", labelKey: "pages.read.scriptureSearchScopeNew" },
];

function useScriptureSearchTranslationPrefs(): {
  primaryTranslationId: string;
  translationCatalogReady: boolean;
} {
  const typography = useContext(ReadBibleTypographyContext);
  return useMemo(() => {
    if (typography) {
      return {
        primaryTranslationId: typography.primaryTranslationId,
        translationCatalogReady: typography.translationCatalogReady,
      };
    }
    const catalog = bundledBibleTranslationsCatalog();
    return {
      primaryTranslationId: resolveDefaultPrimaryTranslationId(catalog, inferAppLocaleFromDevice()),
      translationCatalogReady: true,
    };
  }, [typography]);
}

export function ReadScriptureSearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { primaryTranslationId, translationCatalogReady } = useScriptureSearchTranslationPrefs();
  const [scope, setScope] = useState<ScriptureSearchScope>("all");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ScriptureSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const pushRecentSearch = useCallback((raw: string) => {
    void pushScriptureRecentSearch(raw).then((record) => setRecentSearches(record.terms));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      void readScriptureRecentSearches().then((record) => {
        if (!cancelled) setRecentSearches(record.terms);
      });
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, []);

  useEffect(() => {
    if (!isFocused || !translationCatalogReady) return;
    const task = InteractionManager.runAfterInteractions(() => {
      void warmScriptureSearchDatabase(primaryTranslationId);
    });
    return () => task.cancel();
  }, [isFocused, primaryTranslationId, translationCatalogReady]);

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
    if (!isFocused) return;
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearched(false);
      setError(null);
      return;
    }
    const timer = setTimeout(() => {
      void runSearch(q);
    }, 360);
    return () => clearTimeout(timer);
  }, [isFocused, query, scope, runSearch]);

  const openHit = (hit: ScriptureSearchHit) => {
    const q = query.trim();
    router.push({
      pathname: "/read/[bookId]/[chapter]",
      params: {
        bookId: hit.bookId,
        chapter: String(hit.chapter),
        verse: String(hit.verse),
        ...(q ? { q } : {}),
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
      <ReadParchmentPageScroll
        inset="sub"
        keyboardShouldPersistTaps="handled"
        maskEnabled={Platform.OS !== "android"}
      >
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Text style={styles.backText}>{t("pages.read.catalogBack")}</Text>
        </Pressable>

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
          {...(Platform.OS === "ios" ? { clearButtonMode: "while-editing" as const } : {})}
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
              {renderScriptureSearchHitText(hit.text, query)}
            </Text>
          </Pressable>
        ))}
      </ReadParchmentPageScroll>
    </KeyboardAvoidingView>
  );
}
