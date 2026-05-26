import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  loadScriptureXrefSnippets,
  scriptureXrefSnippetKey,
} from "../bible/load-scripture-xref-snippets";
import { formatScriptureXrefLabel } from "../bible/format-scripture-xref-label";
import type { ScriptureVerseXrefs, ScriptureXrefTarget } from "../bible/scripture-xref-types";
import { parchmentSans } from "../fonts/parchmentType";
import { useLocale } from "../i18n/LocaleProvider";
import { tFormat } from "../i18n/site-copy";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { useReadBibleTypography } from "./ReadBibleTypographyContext";

type Props = {
  visible: boolean;
  onClose: () => void;
  bookName: string;
  chapter: number;
  verse: number;
  bundle: ScriptureVerseXrefs | null;
};

const EMPTY_XREFS: ScriptureXrefTarget[] = [];

function XrefListSection({
  title,
  refs,
  snippets,
  loading,
  locale,
  onOpen,
}: {
  title: string;
  refs: ScriptureXrefTarget[];
  snippets: Record<string, string>;
  loading: boolean;
  locale: ReturnType<typeof useLocale>["locale"];
  onOpen: (ref: ScriptureXrefTarget) => void;
}) {
  if (!refs.length) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {refs.map((ref) => {
        const key = scriptureXrefSnippetKey(ref);
        const snippet = snippets[key];
        return (
          <View key={`${title}-${key}`} style={styles.row}>
            <Pressable
              onPress={() => onOpen(ref)}
              hitSlop={6}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text style={styles.link}>{formatScriptureXrefLabel(ref, locale)}</Text>
            </Pressable>
            {snippet ? (
              <Text style={styles.snippet}>{snippet}</Text>
            ) : loading ? (
              <Text style={styles.snippetMuted}>…</Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

export function ReadChapterVerseXrefSheet({
  visible,
  onClose,
  bookName,
  chapter,
  verse,
  bundle,
}: Props) {
  const router = useRouter();
  const { locale } = useLocale();
  const insets = useSafeAreaInsets();
  const { primaryTranslationId } = useReadBibleTypography();

  const incoming = bundle?.incoming ?? EMPTY_XREFS;
  const outgoing = bundle?.outgoing ?? EMPTY_XREFS;

  const allRefs = useMemo(
    () => (incoming.length || outgoing.length ? [...incoming, ...outgoing] : EMPTY_XREFS),
    [incoming, outgoing],
  );

  const [snippets, setSnippets] = useState<Record<string, string>>({});
  const [loadingSnippets, setLoadingSnippets] = useState(false);

  useEffect(() => {
    if (!visible || allRefs.length === 0) {
      setSnippets((prev) => (Object.keys(prev).length ? {} : prev));
      setLoadingSnippets((prev) => (prev ? false : prev));
      return;
    }
    let cancelled = false;
    setLoadingSnippets(true);
    void loadScriptureXrefSnippets(primaryTranslationId, allRefs)
      .then((map) => {
        if (!cancelled) {
          setSnippets(map);
          setLoadingSnippets(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadingSnippets(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, primaryTranslationId, allRefs]);

  const openRef = (ref: ScriptureXrefTarget) => {
    onClose();
    router.push({
      pathname: "/read/[bookId]/[chapter]",
      params: { bookId: ref.bookId, chapter: String(ref.chapter), verse: String(ref.verseStart) },
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(16, insets.bottom + 12) }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <Text style={styles.title}>
              {tFormat("pages.read.verseXrefSheetTitle", {
                bookName,
                chapter: String(chapter),
                verse: String(verse),
              })}
            </Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>{tFormat("pages.read.chapterJumpClose")}</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
            <XrefListSection
              title={tFormat("pages.read.verseXrefIncoming")}
              refs={incoming}
              snippets={snippets}
              loading={loadingSnippets}
              locale={locale}
              onOpen={openRef}
            />
            <XrefListSection
              title={tFormat("pages.read.verseXrefOutgoing")}
              refs={outgoing}
              snippets={snippets}
              loading={loadingSnippets}
              locale={locale}
              onOpen={openRef}
            />
            {!incoming.length && !outgoing.length ? (
              <Text style={styles.empty}>{tFormat("pages.read.verseXrefEmpty")}</Text>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(28, 20, 16, 0.35)",
  },
  sheet: {
    width: "100%",
    maxHeight: "78%",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: c.surfaceSolid,
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
    flexShrink: 0,
  },
  title: {
    flex: 1,
    fontSize: 16,
    ...parchmentSans(600),
    color: c.ink,
  },
  close: {
    fontSize: 14,
    color: c.muted,
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: c.muted,
    marginBottom: 8,
  },
  row: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  link: {
    fontSize: 15,
    ...parchmentSans(600),
    color: c.accentOt,
    textDecorationLine: "none",
  },
  snippet: {
    marginTop: 5,
    fontSize: 14,
    lineHeight: 21,
    ...parchmentSans(400),
    color: c.inkSoft,
  },
  snippetMuted: {
    marginTop: 4,
    fontSize: 13,
    color: c.muted,
  },
  pressed: {
    opacity: 0.7,
  },
  empty: {
    fontSize: 14,
    color: c.muted,
    paddingVertical: 8,
  },
});
