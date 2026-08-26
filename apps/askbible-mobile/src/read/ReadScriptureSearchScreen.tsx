import { useLocalSearchParams, useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  type ScriptureSearchChapterRef,
  type ScriptureSearchHit,
  type ScriptureSearchScope,
} from "../bible/search-scripture-verses";
import { warmScriptureSearchDatabase } from "../bible/scripture-database";
import { SCRIPTURE_SEARCH_MIN_LEN } from "../bible/scripture-search";
import { t } from "../i18n/site-copy";
import { useReadBibleTypography } from "./ReadBibleTypographyContext";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { ShellSystemBackButton } from "../shell/ShellSystemBackButton";
import { readScriptureSearchScreenStyles as styles } from "./readScriptureSearchScreenStyles";
import { scriptureSearchTypeForPx } from "./readScriptureSearchTypeScale";
import { renderScriptureSearchHitText } from "./scriptureSearchHitText";
import {
  pushScriptureRecentSearch,
  readScriptureRecentSearches,
} from "./scripture-recent-searches";
import {
  getScriptureSearchScope,
  hydrateScriptureSearchScope,
  writeScriptureSearchScope,
} from "./scripture-search-scope-prefs";
import { readLastReadPosition } from "./read-last-position";

const SCOPE_OPTIONS: { key: ScriptureSearchScope; labelKey: string }[] = [
  { key: "all", labelKey: "pages.read.scriptureSearchScopeAll" },
  { key: "old", labelKey: "pages.read.scriptureSearchScopeOld" },
  { key: "new", labelKey: "pages.read.scriptureSearchScopeNew" },
  { key: "chapter", labelKey: "pages.read.scriptureSearchScopeChapter" },
];

function firstParam(raw: string | string[] | undefined): string {
  if (Array.isArray(raw)) return String(raw[0] ?? "").trim();
  return String(raw ?? "").trim();
}

function parseChapterRefFromParams(
  bookIdRaw: string | string[] | undefined,
  chapterRaw: string | string[] | undefined,
): ScriptureSearchChapterRef | null {
  const bookId = firstParam(bookIdRaw);
  const chapter = Number(firstParam(chapterRaw));
  if (!bookId || !Number.isInteger(chapter) || chapter < 1) return null;
  return { bookId, chapter };
}

export function ReadScriptureSearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const params = useLocalSearchParams<{ bookId?: string | string[]; chapter?: string | string[] }>();
  const routeChapterRef = useMemo(
    () => parseChapterRefFromParams(params.bookId, params.chapter),
    [params.bookId, params.chapter],
  );
  const { px, primaryTranslationId, translationCatalogReady } = useReadBibleTypography();
  const type = useMemo(() => scriptureSearchTypeForPx(px), [px]);
  const [scope, setScopeState] = useState<ScriptureSearchScope>(() => getScriptureSearchScope());
  const [chapterRef, setChapterRef] = useState<ScriptureSearchChapterRef | null>(routeChapterRef);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ScriptureSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const setScope = useCallback((next: ScriptureSearchScope) => {
    setScopeState(next);
    void writeScriptureSearchScope(next);
  }, []);

  const pushRecentSearch = useCallback((raw: string) => {
    void pushScriptureRecentSearch(raw).then((record) => setRecentSearches(record.terms));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void hydrateScriptureSearchScope().then((saved) => {
      if (!cancelled) setScopeState(saved);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (routeChapterRef) {
      setChapterRef(routeChapterRef);
      return;
    }
    let cancelled = false;
    void readLastReadPosition().then((pos) => {
      if (cancelled || !pos) return;
      setChapterRef((prev) => prev ?? { bookId: pos.bookId, chapter: pos.chapter });
    });
    return () => {
      cancelled = true;
    };
  }, [routeChapterRef]);

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
      if (scope === "chapter" && !chapterRef) {
        setResults([]);
        setSearched(true);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const hits = await searchScriptureVersesMobile(
          primaryTranslationId,
          q,
          scope,
          chapterRef,
        );
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
    [chapterRef, primaryTranslationId, pushRecentSearch, scope, translationCatalogReady],
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
  }, [isFocused, query, scope, chapterRef, runSearch]);

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
      : scope === "chapter" && !chapterRef
        ? t("pages.read.scriptureSearchNoChapterHint")
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
        <ShellSystemBackButton onPress={() => router.back()} />

        <Text style={[styles.title, { fontSize: type.titleSize }]}>
          {t("pages.read.scriptureSearchTitle")}
        </Text>
        <Text style={[styles.lead, { fontSize: type.leadSize, lineHeight: type.leadLine }]}>
          {t("pages.read.scriptureSearchLead")}
        </Text>

        <View style={styles.scopeRow} accessibilityLabel={t("pages.read.scriptureSearchScopeAria")}>
          {SCOPE_OPTIONS.map((opt) => {
            const active = scope === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => setScope(opt.key)}
                style={[
                  styles.scopeBtn,
                  { paddingHorizontal: type.scopePadH, paddingVertical: type.scopePadV },
                  active && styles.scopeBtnOn,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t(opt.labelKey)}
              >
                <Text
                  style={[
                    styles.scopeBtnText,
                    { fontSize: type.scopeSize },
                    active && styles.scopeBtnTextOn,
                  ]}
                >
                  {t(opt.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("pages.read.scriptureSearchPlaceholder")}
          placeholderTextColor={c.faint}
          style={[styles.input, { fontSize: type.inputSize }]}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          {...(Platform.OS === "ios" ? { clearButtonMode: "while-editing" as const } : {})}
          accessibilityLabel={t("pages.read.scriptureSearchPlaceholder")}
        />

        {recentSearches.length > 0 ? (
          <View style={styles.recentWrap} accessibilityLabel={t("pages.read.scriptureSearchRecentAria")}>
            <Text style={[styles.recentTitle, { fontSize: type.recentTitleSize }]}>
              {t("pages.read.scriptureSearchRecentTitle")}
            </Text>
            <View style={styles.recentList}>
              {recentSearches.map((term) => (
                <Pressable
                  key={term}
                  onPress={() => {
                    setQuery(term);
                    void runSearch(term);
                  }}
                  style={({ pressed }) => [
                    styles.recentChip,
                    {
                      paddingHorizontal: type.recentChipPadH,
                      paddingVertical: type.recentChipPadV,
                    },
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={term}
                >
                  <Text style={[styles.recentChipText, { fontSize: type.recentChipSize }]}>{term}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {hint ? <Text style={[styles.hint, { fontSize: type.hintSize }]}>{hint}</Text> : null}
        {loading ? <ActivityIndicator color={c.muted} style={styles.loader} /> : null}
        {error ? (
          <Text style={[styles.error, { fontSize: type.errorSize, lineHeight: type.errorLine }]}>
            {error}
          </Text>
        ) : null}

        {!loading && searched && results.length === 0 && !error && !(scope === "chapter" && !chapterRef) ? (
          <Text style={[styles.empty, { fontSize: type.emptySize, lineHeight: type.emptyLine }]}>
            {t("pages.read.scriptureSearchEmpty")}
          </Text>
        ) : null}

        {results.map((hit) => (
          <Pressable
            key={`${hit.bookId}:${hit.chapter}:${hit.verse}`}
            onPress={() => openHit(hit)}
            style={({ pressed }) => [
              styles.hit,
              { paddingVertical: type.hitPadV },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${hit.bookName} ${hit.chapter}:${hit.verse}`}
          >
            <Text style={[styles.hitRef, { fontSize: type.hitRefSize }]}>
              {hit.bookName} {hit.chapter}:{hit.verse}
            </Text>
            <Text
              style={[
                styles.hitText,
                { fontSize: type.hitFontSize, lineHeight: type.hitLineHeight },
              ]}
              numberOfLines={4}
            >
              {renderScriptureSearchHitText(hit.text, query)}
            </Text>
          </Pressable>
        ))}
      </ReadParchmentPageScroll>
    </KeyboardAvoidingView>
  );
}
