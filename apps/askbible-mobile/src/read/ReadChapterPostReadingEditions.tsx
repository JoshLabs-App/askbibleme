import { useCallback, useRef, useState } from "react";
import { ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { InfoEditionReaderVariant } from "../bible/info-edition-types";
import { t } from "../i18n/site-copy";
import { ReadChapterInfoEditionBlock } from "./ReadChapterInfoEditionBlock";
import { postReadingTheme as pr } from "./postReadingTheme";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { useReadBibleTypography } from "./ReadBibleTypographyContext";

const discoverArt = require("../../assets/images/post-reading/discover-self.png");
const consultArt = require("../../assets/images/post-reading/consult-materials.png");

type Props = {
  bookId: string;
  chapter: number;
  infoRoleId?: string | null;
  guideRoleId?: string | null;
  onBackToTop?: () => void;
  onGoPrevChapter?: () => void;
  onGoNextChapter?: () => void;
};

type PanelDef = {
  variant: InfoEditionReaderVariant;
  art: number;
  title: string;
  blurb: string;
};

type PageSide = "left" | "right";

function PostReadingBookPage({
  panel,
  pageSide,
  isActive,
  onPress,
  textScale,
}: {
  panel: PanelDef;
  pageSide: PageSide;
  isActive: boolean;
  onPress: () => void;
  textScale: number;
}) {
  const isDiscover = panel.variant === "guide";
  const isLeft = pageSide === "left";
  const actionLabel = isActive
    ? t("pages.read.postReadingEditionSelected")
    : t("pages.read.postReadingEditionTapAction");

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pagePressable,
        isLeft ? styles.pagePressableLeft : styles.pagePressableRight,
        pressed && styles.pagePressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={panel.title}
      accessibilityHint={t("pages.read.postReadingEditionTapAction")}
    >
      <View
        style={[
          styles.page,
          isLeft ? styles.pageLeft : styles.pageRight,
          isDiscover
            ? isLeft
              ? styles.pageDiscoverLeft
              : styles.pageDiscoverRight
            : isLeft
              ? styles.pageConsultLeft
              : styles.pageConsultRight,
          isActive &&
            (isDiscover
              ? isLeft
                ? styles.pageDiscoverActiveLeft
                : styles.pageDiscoverActiveRight
              : isLeft
                ? styles.pageConsultActiveLeft
                : styles.pageConsultActiveRight),
        ]}
      >
        <ImageBackground
          source={panel.art}
          resizeMode="stretch"
          style={styles.pageArt}
          imageStyle={styles.pageArtImage}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <View style={styles.pageBody}>
          <Text
            style={[
              styles.pageTitle,
              {
                fontSize: Math.round(17 * textScale * 10) / 10,
                lineHeight: Math.round(24 * textScale * 10) / 10,
              },
            ]}
          >
            {panel.title}
          </Text>
          <Text
            style={[
              styles.pageBlurb,
              {
                fontSize: Math.round(11 * textScale * 10) / 10,
                lineHeight: Math.round(17 * textScale * 10) / 10,
              },
            ]}
          >
            {panel.blurb}
          </Text>
          <View style={styles.pageActionRow}>
            <Text style={styles.pageActionText}>{actionLabel}</Text>
            <MaterialIcons
              name={isActive ? "check-circle" : "chevron-right"}
              size={14}
              color={isActive ? "#7A633A" : "#8C5A2A"}
            />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export function ReadChapterPostReadingEditions({
  bookId,
  chapter,
  infoRoleId = null,
  guideRoleId = null,
  onBackToTop,
  onGoPrevChapter,
  onGoNextChapter,
}: Props) {
  const { px } = useReadBibleTypography();
  const textScale = Math.max(0.8, Math.min(2.8, px.verseFontSize / 16));
  const [active, setActive] = useState<InfoEditionReaderVariant | null>(null);
  const lastSelectAtRef = useRef(0);

  const selectVariant = useCallback((variant: InfoEditionReaderVariant) => {
    const now = Date.now();
    if (now - lastSelectAtRef.current < 280) return;
    lastSelectAtRef.current = now;
    setActive((current) => (current === variant ? current : variant));
  }, []);

  const panels: PanelDef[] = [
    {
      variant: "guide",
      art: discoverArt,
      title: t("pages.read.postReadingEditionGuideTitle"),
      blurb: t("pages.read.postReadingEditionGuideBlurb"),
    },
    {
      variant: "info",
      art: consultArt,
      title: t("pages.read.postReadingEditionInfoTitle"),
      blurb: t("pages.read.postReadingEditionInfoBlurb"),
    },
  ];

  return (
    <View style={styles.section} accessibilityLabel={t("pages.read.postReadingEditionsAriaLabel")}>
      <View style={styles.heading}>
        <Text
          style={[
            styles.headingText,
            {
              fontSize: Math.round(22 * textScale * 10) / 10,
              lineHeight: Math.round(30 * textScale * 10) / 10,
            },
          ]}
        >
          {t("pages.read.postReadingEditionsHeading")}
        </Text>
        <Text
          style={[
            styles.headingLead,
            {
              fontSize: Math.round(13 * textScale * 10) / 10,
              lineHeight: Math.round(21 * textScale * 10) / 10,
            },
          ]}
        >
          {t("pages.read.postReadingEditionsLead")}
        </Text>
        <Text
          style={[
            styles.headingTapHint,
            {
              fontSize: Math.round(12 * textScale * 10) / 10,
              lineHeight: Math.round(18 * textScale * 10) / 10,
            },
          ]}
        >
          {t("pages.read.postReadingEditionsTapHint")}
        </Text>
        <View style={styles.headingRule}>
          <View style={styles.headingRuleLine} />
        </View>
      </View>

      <View
        style={styles.bookSpread}
        accessibilityLabel={t("pages.read.postReadingEditionsChoicesAria")}
        accessibilityRole="none"
      >
        <View style={styles.bookInner}>
          <PostReadingBookPage
            panel={panels[0]}
            pageSide="left"
            isActive={active === "guide"}
            onPress={() => selectVariant("guide")}
            textScale={textScale}
          />
          <PostReadingBookPage
            panel={panels[1]}
            pageSide="right"
            isActive={active === "info"}
            onPress={() => selectVariant("info")}
            textScale={textScale}
          />
        </View>
      </View>

      {active === "guide" ? (
        <ReadChapterInfoEditionBlock
          key={`guide-${bookId}-${chapter}-${guideRoleId ?? "default"}`}
          variant="guide"
          bookId={bookId}
          chapter={chapter}
          roleId={guideRoleId}
          isActive
          onBack={() => setActive(null)}
        />
      ) : null}
      {active === "info" ? (
        <ReadChapterInfoEditionBlock
          key={`info-${bookId}-${chapter}-${infoRoleId ?? "default"}`}
          variant="info"
          bookId={bookId}
          chapter={chapter}
          roleId={infoRoleId}
          isActive
          onBack={() => setActive(null)}
        />
      ) : null}
      {active && onBackToTop ? (
        <View style={styles.bottomActionRow}>
          <View style={styles.bottomActionSide}>
            {onGoPrevChapter ? (
              <Pressable
                onPress={onGoPrevChapter}
                style={({ pressed }) => [styles.bottomNavBtn, pressed && styles.pagePressed]}
                accessibilityRole="button"
                accessibilityLabel={t("pages.read.chapterEndNavPrev")}
              >
                <View style={styles.bottomNavInner}>
                  <MaterialIcons name="chevron-left" size={16} color="#8C5A2A" />
                  <Text style={styles.bottomNavText}>{t("pages.read.chapterEndNavPrev")}</Text>
                </View>
              </Pressable>
            ) : null}
          </View>
          <Pressable
            onPress={onBackToTop}
            style={({ pressed }) => [styles.backToTopOuter, pressed && styles.pagePressed]}
            accessibilityRole="button"
            accessibilityLabel={t("pages.read.postReadingBackToTop")}
          >
            <Text
              style={[
                styles.backToTopOuterText,
                {
                  fontSize: Math.round(14 * textScale * 10) / 10,
                },
              ]}
            >
              {t("pages.read.postReadingBackToTop")}
            </Text>
          </Pressable>
          <View style={[styles.bottomActionSide, styles.bottomActionSideRight]}>
            {onGoNextChapter ? (
              <Pressable
                onPress={onGoNextChapter}
                style={({ pressed }) => [styles.bottomNavBtn, pressed && styles.pagePressed]}
                accessibilityRole="button"
                accessibilityLabel={t("pages.read.chapterEndNavNext")}
              >
                <View style={styles.bottomNavInner}>
                  <Text style={styles.bottomNavText}>{t("pages.read.chapterEndNavNext")}</Text>
                  <MaterialIcons name="chevron-right" size={16} color="#8C5A2A" />
                </View>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const BOOK_RADIUS = 12;

const styles = StyleSheet.create({
  section: {
    marginTop: 32,
    width: "100%",
    alignItems: "center",
  },
  heading: { marginBottom: 20, alignItems: "center", width: "100%" },
  headingText: {
    fontSize: 22,
    ...parchmentSans(600),
    letterSpacing: 0.8,
    lineHeight: 30,
    color: pr.heading,
    textAlign: "center",
    marginBottom: 10,
  },
  headingLead: {
    ...parchmentSans(400),
    color: "rgba(120, 75, 30, 0.9)",
    textAlign: "center",
    marginBottom: 10,
    paddingHorizontal: 18,
  },
  headingTapHint: {
    ...parchmentSans(500),
    color: "rgba(140, 90, 42, 0.92)",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  headingRule: {
    maxWidth: 224,
    width: "56%",
    alignSelf: "center",
  },
  headingRuleLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: pr.headingRule },
  bookSpread: {
    width: "100%",
    borderRadius: BOOK_RADIUS,
    borderWidth: 0,
    borderColor: "transparent",
    backgroundColor: "transparent",
    overflow: "hidden",
    shadowColor: "transparent",
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  bookInner: {
    flexDirection: "row",
    alignItems: "stretch",
    width: "100%",
    minHeight: 1,
    position: "relative",
  },
  pagePressable: {
    flex: 1,
    minWidth: 0,
    alignSelf: "stretch",
  },
  pagePressableLeft: {},
  pagePressableRight: {},
  pagePressed: { opacity: 0.92 },
  page: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "transparent",
    overflow: "hidden",
    position: "relative",
  },
  pageLeft: {
    borderTopLeftRadius: BOOK_RADIUS,
    borderBottomLeftRadius: BOOK_RADIUS,
  },
  pageRight: {
    borderTopRightRadius: BOOK_RADIUS,
    borderBottomRightRadius: BOOK_RADIUS,
  },
  pageDiscoverLeft: { backgroundColor: "transparent" },
  pageDiscoverRight: { backgroundColor: "transparent" },
  pageConsultLeft: { backgroundColor: "transparent" },
  pageConsultRight: { backgroundColor: "transparent" },
  pageDiscoverActiveLeft: {
    backgroundColor: "transparent",
  },
  pageDiscoverActiveRight: {
    backgroundColor: "transparent",
  },
  pageConsultActiveLeft: {
    backgroundColor: "transparent",
  },
  pageConsultActiveRight: {
    backgroundColor: "transparent",
  },
  pageArt: {
    width: "100%",
    aspectRatio: 1,
    flexShrink: 0,
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  pageArtImage: {
    width: "100%",
    height: "100%",
    opacity: 0.8,
  },
  pageBody: {
    flexGrow: 1,
    alignItems: "center",
    paddingTop: 4,
    paddingHorizontal: 12,
    paddingBottom: 14,
    gap: 7,
    backgroundColor: "transparent",
  },
  pageTitle: {
    fontSize: 17,
    ...parchmentSans(600),
    letterSpacing: 0.6,
    lineHeight: 24,
    textAlign: "center",
    color: "#A56A2D",
  },
  pageBlurb: {
    fontSize: 11,
    lineHeight: 17,
    color: "rgba(120, 75, 30, 0.86)",
    textAlign: "center",
    maxWidth: 168,
  },
  pageActionRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    minHeight: 18,
  },
  pageActionText: {
    ...parchmentSans(500),
    fontSize: 11,
    lineHeight: 16,
    color: "rgba(140, 90, 42, 0.92)",
    letterSpacing: 0.2,
  },
  bottomActionRow: {
    marginTop: 50,
    marginBottom: 50,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
  },
  bottomActionSide: {
    flex: 1,
    minWidth: 0,
  },
  bottomActionSideRight: {
    alignItems: "flex-end",
  },
  bottomNavBtn: {
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  bottomNavInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 1,
  },
  bottomNavText: {
    ...parchmentSans(500),
    fontSize: 13,
    color: "rgba(140, 90, 42, 0.88)",
    letterSpacing: 0.1,
  },
  backToTopOuter: {
    alignSelf: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  backToTopOuterText: {
    ...parchmentSans(500),
    color: "rgba(140, 90, 42, 0.84)",
    letterSpacing: 0.2,
  },
});
