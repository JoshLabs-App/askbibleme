import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { InfoEditionReaderVariant } from "../bible/info-edition-types";
import type { AppLocale } from "../i18n/config";
import { createT } from "../i18n/site-copy";
import { getLocale } from "../i18n/locale-store";
import { ReadChapterInfoEditionBlock } from "./ReadChapterInfoEditionBlock";
import { PostReadingBookPage, type PostReadingPanelDef } from "./PostReadingBookPage";
import { readChapterPostReadingEditionsStyles as styles } from "./readChapterPostReadingEditionsStyles";
import { useReadBibleTypography } from "./ReadBibleTypographyContext";

const discoverArt = require("../../assets/images/post-reading/discover-self.png");
const consultArt = require("../../assets/images/post-reading/consult-materials.png");

type Props = {
  bookId: string;
  chapter: number;
  displayLocale?: AppLocale;
  infoRoleId?: string | null;
  guideRoleId?: string | null;
  onBackToTop?: () => void;
  onGoPrevChapter?: () => void;
  onGoNextChapter?: () => void;
  /** 宽屏右栏：同时展开导读 + 信息版（对齐网站 spread） */
  spreadLayout?: boolean;
};

export function ReadChapterPostReadingEditions({
  bookId,
  chapter,
  displayLocale = getLocale(),
  infoRoleId = null,
  guideRoleId = null,
  onBackToTop,
  onGoPrevChapter,
  onGoNextChapter,
  spreadLayout = false,
}: Props) {
  const t = useMemo(() => createT(displayLocale), [displayLocale]);
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

  const panels: PostReadingPanelDef[] = [
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

  if (spreadLayout) {
    return (
      <View
        style={[styles.section, styles.sectionSpread]}
        accessibilityLabel={t("pages.read.postReadingEditionsAriaLabel")}
      >
        <View style={[styles.heading, styles.headingSpread]}>
          <Text
            style={[
              styles.headingText,
              styles.headingTextSpread,
              {
                fontSize: Math.round(20 * textScale * 10) / 10,
                lineHeight: Math.round(28 * textScale * 10) / 10,
              },
            ]}
          >
            {t("pages.read.postReadingEditionsHeading")}
          </Text>
          <View style={styles.headingRule}>
            <View style={styles.headingRuleLine} />
          </View>
        </View>

        <View style={styles.spreadParts}>
          <View style={styles.spreadSection}>
            <Text style={styles.spreadSectionLabel}>{panels[0].title}</Text>
            <ReadChapterInfoEditionBlock
              key={`guide-${bookId}-${chapter}-${guideRoleId ?? "default"}`}
              variant="guide"
              bookId={bookId}
              chapter={chapter}
              displayLocale={displayLocale}
              roleId={guideRoleId}
              isActive
              columnLayout
            />
          </View>
          <View style={styles.spreadSection}>
            <Text style={styles.spreadSectionLabel}>{panels[1].title}</Text>
            <ReadChapterInfoEditionBlock
              key={`info-${bookId}-${chapter}-${infoRoleId ?? "default"}`}
              variant="info"
              bookId={bookId}
              chapter={chapter}
              displayLocale={displayLocale}
              roleId={infoRoleId}
              isActive
              columnLayout
            />
          </View>
        </View>
      </View>
    );
  }

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
            tx={t}
          />
          <PostReadingBookPage
            panel={panels[1]}
            pageSide="right"
            isActive={active === "info"}
            onPress={() => selectVariant("info")}
            textScale={textScale}
            tx={t}
          />
        </View>
      </View>

      {active === "guide" ? (
        <ReadChapterInfoEditionBlock
          key={`guide-${bookId}-${chapter}-${guideRoleId ?? "default"}`}
          variant="guide"
          bookId={bookId}
          chapter={chapter}
          displayLocale={displayLocale}
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
          displayLocale={displayLocale}
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
