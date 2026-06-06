import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  loadOrGenerateInfoEdition,
  publishedFromPayload,
} from "../api/infoEditionReader";
import type {
  InfoEditionReaderVariant,
  InfoEditionV1PublishedChapter,
} from "../bible/info-edition-types";
import type { AppLocale } from "../i18n/config";
import { createT } from "../i18n/site-copy";
import { getLocale } from "../i18n/locale-store";
import { ReadChapterInfoEditionMarkdown } from "./ReadChapterInfoEditionMarkdown";
import { postReadingTheme as pr } from "./postReadingTheme";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { useReadBibleTypography } from "./ReadBibleTypographyContext";

type Props = {
  variant: InfoEditionReaderVariant;
  bookId: string;
  chapter: number;
  displayLocale?: AppLocale;
  roleId?: string | null;
  isActive: boolean;
  onBack?: () => void;
};

type PanelPhase = "idle" | "loading" | "ready" | "error";

function formatInfoEditionError(raw: string | undefined, t: (key: string) => string): string {
  if (!raw?.trim()) return t("pages.read.infoEditionLoadFailed");
  if (/EACCES|permission denied|EPERM|EROFS|不可写|mkdir|Render 提示/i.test(raw)) {
    return raw;
  }
  return raw;
}

export function ReadChapterInfoEditionBlock({
  variant,
  bookId,
  chapter,
  displayLocale = getLocale(),
  roleId = null,
  isActive,
  onBack,
}: Props) {
  const t = useMemo(() => createT(displayLocale), [displayLocale]);
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const { px } = useReadBibleTypography();
  const textScale = Math.max(0.8, Math.min(2.8, px.verseFontSize / 16));
  const [phase, setPhase] = useState<PanelPhase>("idle");
  const [published, setPublished] = useState<InfoEditionV1PublishedChapter | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [hostWidth, setHostWidth] = useState<number | null>(null);
  const loadStartedRef = useRef(false);

  const disclaimer =
    variant === "guide"
      ? t("pages.read.guideEditionDisclaimer")
      : t("pages.read.infoEditionDisclaimer");

  const loadOrGenerate = useCallback(async () => {
    setErr(null);
    setPhase("loading");
    try {
      const result = await loadOrGenerateInfoEdition(bookId, chapter, variant, roleId);
      const ready = publishedFromPayload(result);
      if (ready) {
        setPublished(ready);
        setPhase("ready");
        return;
      }
      if (result.status === "failed") {
        setErr(formatInfoEditionError(result.error, t));
        setPhase("error");
        return;
      }
      if (result.error === "timeout") {
        setErr(t("pages.read.infoEditionTimeout"));
        setPhase("error");
        return;
      }
      setErr(t("pages.read.infoEditionLoadFailed"));
      setPhase("error");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }, [bookId, chapter, variant, roleId]);

  useEffect(() => {
    loadStartedRef.current = false;
    setPhase("idle");
    setPublished(null);
    setErr(null);
  }, [bookId, chapter, variant, roleId]);

  useEffect(() => {
    if (!isActive) return;
    if (phase === "ready" || phase === "error") return;
    if (loadStartedRef.current) return;
    loadStartedRef.current = true;
    void loadOrGenerate();
  }, [isActive, loadOrGenerate, phase]);

  if (!isActive) return null;

  const isDiscover = variant === "guide";
  const fullBleedStyle =
    hostWidth && hostWidth > 0
      ? { width: viewportWidth, marginLeft: (hostWidth - viewportWidth) / 2 }
      : null;
  const topGradientStop = Math.min(1, 15 / Math.max(viewportHeight, 1));
  const topGradientColors: [string, string, string, string] = [
    "rgba(42,24,13,0.48)",
    "rgba(29,18,10,0.31)",
    "rgba(18,10,5,0)",
    "rgba(18,10,5,0)",
  ];
  const topGradientLocations: [number, number, number, number] = [
    0,
    Math.min(1, topGradientStop * 0.45),
    topGradientStop,
    1,
  ];

  return (
    <View style={styles.wrap} accessibilityLabel={t(variant === "guide" ? "pages.read.guideEditionAriaLabel" : "pages.read.infoEditionAriaLabel")}>
      <View
        style={[styles.edition, isDiscover ? styles.editionDiscover : styles.editionConsult]}
        onLayout={(e) => setHostWidth(e.nativeEvent.layout.width)}
      >
        <View style={styles.headerZone}>
          <Text
            style={[
              styles.disclaimer,
              {
                fontSize: Math.round(12 * textScale * 10) / 10,
                lineHeight: Math.round(19 * textScale * 10) / 10,
              },
            ]}
          >
            {disclaimer}
          </Text>
        </View>

        {phase === "error" && err ? (
          <LinearGradient
            colors={topGradientColors}
            locations={topGradientLocations}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[styles.bodyFullscreenShell, { minHeight: viewportHeight }, fullBleedStyle]}
          >
            <View style={styles.bodyPanel}>
              <View style={styles.bodyPaper}>
                <View style={styles.bodyPaperContent}>
                  <Text
                    style={[
                      styles.errorText,
                      {
                        fontSize: Math.round(13 * textScale * 10) / 10,
                        lineHeight: Math.round(20 * textScale * 10) / 10,
                      },
                    ]}
                  >
                    {err}
                  </Text>
                  <Pressable
                    onPress={() => {
                      loadStartedRef.current = true;
                      void loadOrGenerate();
                    }}
                    style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}
                  >
                    <Text
                      style={[
                        styles.retryText,
                        {
                          fontSize: Math.round(14 * textScale * 10) / 10,
                        },
                      ]}
                    >
                      {t("pages.read.infoEditionRetry")}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </LinearGradient>
        ) : null}

        {phase === "loading" ? (
          <LinearGradient
            colors={topGradientColors}
            locations={topGradientLocations}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[styles.bodyFullscreenShell, { minHeight: viewportHeight }, fullBleedStyle]}
          >
            <View style={styles.bodyPanel}>
              <View style={styles.bodyPaper}>
                <View style={styles.bodyPaperContent}>
                  <ActivityIndicator color={isDiscover ? pr.discover : pr.consult} style={{ marginVertical: 12 }} />
                  <Text
                    style={[
                      styles.loadingText,
                      {
                        fontSize: Math.round(12 * textScale * 10) / 10,
                        lineHeight: Math.round(20 * textScale * 10) / 10,
                      },
                    ]}
                  >
                    {t("pages.read.infoEditionGenerating")}
                  </Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        ) : null}

        {phase === "ready" && published ? (
          <LinearGradient
            colors={topGradientColors}
            locations={topGradientLocations}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[styles.bodyFullscreenShell, { minHeight: viewportHeight }, fullBleedStyle]}
          >
            <View style={styles.bodyPanel}>
              <View style={styles.bodyPaper}>
                <View style={styles.bodyPaperContent}>
                  <ReadChapterInfoEditionMarkdown content={published.markdown} variant={variant} />
                  {onBack ? (
                    <Pressable
                      onPress={onBack}
                      style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityLabel={t("pages.read.postReadingBack")}
                    >
                      <Text
                        style={[
                          styles.backBtnText,
                          {
                            fontSize: Math.round(14 * textScale * 10) / 10,
                          },
                        ]}
                      >
                        {t("pages.read.postReadingBack")}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </View>
          </LinearGradient>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 24, width: "100%" },
  edition: { width: "100%" },
  editionDiscover: {},
  editionConsult: {},
  headerZone: {
    alignItems: "center",
    paddingBottom: 14,
    marginBottom: 4,
  },
  disclaimer: {
    fontSize: 12,
    lineHeight: 19,
    color: c.muted,
    textAlign: "center",
    marginTop: 10,
    maxWidth: 320,
    paddingHorizontal: 8,
  },
  bodyFullscreenShell: {
    position: "relative",
    width: "100%",
    backgroundColor: "transparent",
    borderRadius: 0,
    borderTopWidth: 0,
    borderBottomWidth: 0,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 14,
    justifyContent: "flex-start",
  },
  bodyPanel: {
    position: "relative",
    zIndex: 1,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(150, 112, 64, 0.18)",
    backgroundColor: "#F2E4CF",
    flexDirection: "row",
    alignItems: "stretch",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  bodyPaper: {
    flex: 1,
    position: "relative",
    backgroundColor: "#F2E4CF",
    borderLeftWidth: 0,
    zIndex: 1,
    overflow: "hidden",
  },
  bodyPaperContent: {
    flex: 1,
    zIndex: 1,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 22,
  },
  loadingText: {
    fontSize: 12,
    lineHeight: 20,
    color: c.muted,
    textAlign: "center",
    marginBottom: 8,
  },
  errorText: { fontSize: 13, lineHeight: 20, color: c.muted, textAlign: "center" },
  retryBtn: {
    alignSelf: "center",
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  retryText: { fontSize: 14, ...parchmentSans(600), color: c.ink },
  backBtn: {
    alignSelf: "center",
    marginTop: 50,
    marginBottom: 100,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  backBtnText: {
    ...parchmentSans(600),
    color: "#8C5A2A",
    letterSpacing: 0.3,
  },
  pressed: { opacity: 0.88 },
});
