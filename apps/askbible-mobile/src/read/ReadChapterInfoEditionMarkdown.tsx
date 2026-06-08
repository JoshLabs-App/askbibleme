import Markdown from "react-native-markdown-display";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  INFO_EDITION_KEY_SCENES_HEADING_PATTERNS,
  normalizeInfoEditionCompareMarkdown,
  stripInfoEditionSectionByHeading,
} from "../bible/info-edition-format";
import type { InfoEditionReaderVariant } from "../bible/info-edition-types";
import { parchmentSans } from "../fonts/parchmentType";
import { useLocale } from "../i18n/LocaleProvider";
import { toZhTwText } from "../i18n/site-copy";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { postReadingTheme as pr } from "./postReadingTheme";
import { useReadBibleTypography } from "./ReadBibleTypographyContext";

type Props = {
  content: string;
  variant: InfoEditionReaderVariant;
  onLinkPress?: (url: string) => boolean | void;
};

function splitPrimaryHeading(markdown: string): { heading: string | null; body: string } {
  const lines = markdown.split(/\r?\n/);
  const firstMeaningful = lines.findIndex((line) => line.trim().length > 0);
  if (firstMeaningful < 0) return { heading: null, body: markdown };
  const m = lines[firstMeaningful].match(/^#\s+(.+)$/);
  if (!m) return { heading: null, body: markdown };

  const next = [...lines];
  next.splice(firstMeaningful, 1);
  if (firstMeaningful < next.length && next[firstMeaningful].trim() === "") {
    next.splice(firstMeaningful, 1);
  }
  return { heading: m[1].trim(), body: next.join("\n").trim() };
}

function markdownStylesFor(_variant: InfoEditionReaderVariant, textScale: number) {
  const accent = "#A56A2D";
  const sx = (n: number) => Math.max(1, Math.round(n * textScale * 10) / 10);
  const mx = (n: number) => Math.round(n * textScale * 10) / 10;

  return StyleSheet.create({
    titleWrap: {
      width: "100%",
      alignItems: "center",
      marginTop: mx(30),
      marginBottom: 22,
    },
    titleText: {
      color: accent,
      fontSize: sx(24),
      ...parchmentSans(700),
      lineHeight: sx(36),
      letterSpacing: 0.5,
      textAlign: "center",
      width: "100%",
    },
    body: {
      ...parchmentSans(400),
      color: pr.mdBody,
      fontSize: sx(16),
      lineHeight: sx(30),
    },
    heading1: {
      color: accent,
      fontSize: sx(20),
      ...parchmentSans(700),
      lineHeight: sx(32),
      letterSpacing: 0.5,
      width: "100%",
      alignSelf: "stretch",
      textAlign: "center",
      marginTop: 0,
      marginBottom: mx(22),
      paddingBottom: mx(8),
    },
    heading2: {
      color: accent,
      fontSize: sx(18),
      ...parchmentSans(700),
      lineHeight: sx(30),
      letterSpacing: 0.3,
      textAlign: "left",
      marginBottom: mx(14),
      marginTop: mx(24),
      paddingBottom: mx(5),
    },
    heading3: {
      color: accent,
      fontSize: sx(16),
      ...parchmentSans(600),
      lineHeight: sx(27),
      marginBottom: mx(10),
      marginTop: mx(22),
    },
    paragraph: { marginBottom: mx(18), marginTop: 0 },
    bullet_list: { marginBottom: mx(18), marginTop: mx(6), marginLeft: 0, paddingLeft: 0 },
    ordered_list: { marginBottom: mx(18), marginTop: mx(6), marginLeft: 0, paddingLeft: 0 },
    list_item: { marginBottom: mx(10), marginLeft: 0, paddingLeft: 0 },
    ordered_list_icon: {
      ...parchmentSans(500),
      color: accent,
      fontSize: sx(15),
      lineHeight: sx(30),
      minWidth: mx(18),
      marginRight: mx(4),
    },
    ordered_list_content: {
      flex: 1,
      marginLeft: 0,
      paddingLeft: 0,
    },
    bullet_list_icon: {
      color: accent,
      minWidth: 0,
      width: 0,
      marginRight: 0,
      // Android Fabric crashes when letterSpacing is resolved with a zero fontSize.
      // Keep a tiny non-zero font size and collapse layout via width/minWidth.
      fontSize: 1,
      lineHeight: 1,
    },
    bullet_list_content: {
      flex: 1,
      marginLeft: 0,
      paddingLeft: 0,
    },
    strong: { ...parchmentSans(600), color: accent },
    blockquote: {
      borderLeftWidth: 3,
      borderLeftColor: "#A56A2D",
      backgroundColor: "transparent",
      paddingLeft: mx(14),
      marginVertical: mx(16),
      color: "#8C562A",
      opacity: 1,
    },
    blockquote_content: {
      color: "#8C562A",
    },
    blockquote_text: {
      color: "#8C562A",
    },
    link: {
      color: accent,
      textDecorationLine: "underline",
      textDecorationColor: "rgba(165, 106, 45, 0.45)",
    },
    hr: {
      backgroundColor: "transparent",
      height: 0,
      marginVertical: 0,
    },
  });
}

export function ReadChapterInfoEditionMarkdown({ content, variant, onLinkPress }: Props) {
  const { locale } = useLocale();
  const localized = useMemo(() => {
    let text = normalizeInfoEditionCompareMarkdown(content);
    if (variant === "info") {
      text = stripInfoEditionSectionByHeading(text, INFO_EDITION_KEY_SCENES_HEADING_PATTERNS);
    }
    return locale === "zh-TW" ? toZhTwText(text) : text;
  }, [content, locale, variant]);
  const { heading, body } = useMemo(() => splitPrimaryHeading(localized), [localized]);
  const { px } = useReadBibleTypography();
  const textScale = useMemo(
    () => Math.max(0.8, Math.min(2.8, px.verseFontSize / 16)),
    [px.verseFontSize],
  );
  const markdownStyles = useMemo(() => markdownStylesFor(variant, textScale), [variant, textScale]);
  if (!localized) return null;

  return (
    <View>
      {heading ? (
        <View style={markdownStyles.titleWrap}>
          <Text style={markdownStyles.titleText}>{heading}</Text>
        </View>
      ) : null}
      <Markdown style={markdownStyles} onLinkPress={onLinkPress}>
        {body || localized}
      </Markdown>
    </View>
  );
}
