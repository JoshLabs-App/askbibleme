import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { InteractionManager, Pressable, StyleSheet, Text, View } from "react-native";
import {
  loadScriptureXrefSnippets,
  scriptureXrefSnippetKey,
} from "../bible/load-scripture-xref-snippets";
import { formatScriptureXrefLabel } from "../bible/format-scripture-xref-label";
import type { ScriptureVerseXrefs, ScriptureXrefTarget } from "../bible/scripture-xref-types";
import { parchmentSans } from "../fonts/parchmentType";
import { useLocale } from "../i18n/LocaleProvider";
import type { AppLocale } from "../i18n/config";
import { createT } from "../i18n/site-copy";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { ReadChapterBottomSheet } from "./ReadChapterBottomSheet";
import {
  useReadBibleTypography,
  useReadBibleTypographyPx,
} from "./ReadBibleTypographyContext";
import type { ReadBibleTypographyPx } from "./read-bible-typography-prefs";

type Props = {
  visible: boolean;
  onClose: () => void;
  bookName: string;
  displayLocale?: AppLocale;
  chapter: number;
  verse: number;
  bundle: ScriptureVerseXrefs | null;
  bundleLoading?: boolean;
};

const EMPTY_XREFS: ScriptureXrefTarget[] = [];

function XrefListSection({
  title,
  refs,
  snippets,
  loading,
  locale,
  px,
  onOpen,
}: {
  title: string;
  refs: ScriptureXrefTarget[];
  snippets: Record<string, string>;
  loading: boolean;
  locale: AppLocale;
  px: ReadBibleTypographyPx;
  onOpen: (ref: ScriptureXrefTarget) => void;
}) {
  if (!refs.length) return null;
  const linkSize = px.verseFontSize;
  const snippetSize = px.verseFontSize;
  const snippetLine = px.verseLineHeight;
  const sectionSize = Math.max(12, Math.round(px.verseFontSize * 0.72));
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { fontSize: sectionSize }]}>{title}</Text>
      {refs.map((ref) => {
        const key = scriptureXrefSnippetKey(ref);
        const snippet = snippets[key];
        return (
          <Pressable
            key={`${title}-${key}`}
            onPress={() => onOpen(ref)}
            accessibilityRole="button"
            accessibilityLabel={formatScriptureXrefLabel(ref, locale)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Text style={[styles.link, { fontSize: linkSize }]}>
              {formatScriptureXrefLabel(ref, locale)}
            </Text>
            {snippet ? (
              <Text style={[styles.snippet, { fontSize: snippetSize, lineHeight: snippetLine }]}>
                {snippet}
              </Text>
            ) : loading ? (
              <Text style={[styles.snippetMuted, { fontSize: Math.round(snippetSize * 0.9) }]}>
                …
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function ReadChapterVerseXrefSheet({
  visible,
  onClose,
  bookName,
  displayLocale,
  chapter,
  verse,
  bundle,
  bundleLoading = false,
}: Props) {
  const router = useRouter();
  const { locale } = useLocale();
  const sheetLocale = displayLocale ?? locale;
  const tx = useMemo(() => createT(sheetLocale), [sheetLocale]);
  const { primaryTranslationId } = useReadBibleTypography();
  const px = useReadBibleTypographyPx();

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
    const task = InteractionManager.runAfterInteractions(() => {
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
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [visible, primaryTranslationId, allRefs]);

  const openRef = (ref: ScriptureXrefTarget) => {
    onClose();
    InteractionManager.runAfterInteractions(() => {
      router.push({
        pathname: "/(tabs)/read/[bookId]/[chapter]",
        params: {
          bookId: ref.bookId,
          chapter: String(ref.chapter),
          verse: String(ref.verseStart),
        },
      });
    });
  };

  return (
    <ReadChapterBottomSheet
      visible={visible}
      onClose={onClose}
      title={tx("pages.read.verseXrefSheetTitle", {
        bookName,
        chapter: String(chapter),
        verse: String(verse),
      })}
      closeLabel={tx("pages.read.chapterJumpClose")}
      titleFontSize={Math.max(17, Math.round(px.verseFontSize * 0.95))}
      closeFontSize={Math.round(px.verseFontSize * 0.85)}
    >
      {bundleLoading ? (
        <Text style={[styles.snippetMuted, { fontSize: Math.round(px.verseFontSize * 0.9) }]}>
          …
        </Text>
      ) : null}
      <XrefListSection
        title={tx("pages.read.verseXrefIncoming")}
        refs={incoming}
        snippets={snippets}
        loading={loadingSnippets}
        locale={sheetLocale}
        px={px}
        onOpen={openRef}
      />
      <XrefListSection
        title={tx("pages.read.verseXrefOutgoing")}
        refs={outgoing}
        snippets={snippets}
        loading={loadingSnippets}
        locale={sheetLocale}
        px={px}
        onOpen={openRef}
      />
      {!incoming.length && !outgoing.length ? (
        <Text style={[styles.empty, { fontSize: px.verseFontSize }]}>
          {tx("pages.read.verseXrefEmpty")}
        </Text>
      ) : null}
    </ReadChapterBottomSheet>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: c.muted,
    marginBottom: 10,
  },
  row: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  link: {
    ...parchmentSans(600),
    color: c.accentOt,
    textDecorationLine: "none",
  },
  snippet: {
    marginTop: 6,
    ...parchmentSans(400),
    color: c.inkSoft,
  },
  snippetMuted: {
    marginTop: 6,
    color: c.muted,
  },
  pressed: {
    opacity: 0.7,
  },
  empty: {
    color: c.muted,
    paddingVertical: 10,
  },
});
