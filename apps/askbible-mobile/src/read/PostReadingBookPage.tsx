import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ImageBackground, Pressable, Text, View } from "react-native";
import type { InfoEditionReaderVariant } from "../bible/info-edition-types";
import { readChapterPostReadingEditionsStyles as styles } from "./readChapterPostReadingEditionsStyles";

export type PostReadingPanelDef = {
  variant: InfoEditionReaderVariant;
  art: number;
  title: string;
  blurb: string;
};

type PageSide = "left" | "right";

export function PostReadingBookPage({
  panel,
  pageSide,
  isActive,
  onPress,
  textScale,
  tx,
}: {
  panel: PostReadingPanelDef;
  pageSide: PageSide;
  isActive: boolean;
  onPress: () => void;
  textScale: number;
  tx: (key: string) => string;
}) {
  const isDiscover = panel.variant === "guide";
  const isLeft = pageSide === "left";
  const actionLabel = isActive
    ? tx("pages.read.postReadingEditionSelected")
    : tx("pages.read.postReadingEditionTapAction");

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
      accessibilityHint={tx("pages.read.postReadingEditionTapAction")}
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
