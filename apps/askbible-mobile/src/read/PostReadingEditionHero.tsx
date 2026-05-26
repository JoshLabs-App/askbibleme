import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { StyleSheet, Text, View } from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import type { InfoEditionReaderVariant } from "../bible/info-edition-types";
import { t } from "../i18n/site-copy";
import { postReadingTheme as pr } from "./postReadingTheme";

type Props = {
  variant: InfoEditionReaderVariant;
};

export function PostReadingEditionHero({ variant }: Props) {
  const isDiscover = variant === "guide";
  const tag = isDiscover
    ? t("pages.read.postReadingEditionGuideTag")
    : t("pages.read.postReadingEditionInfoTag");
  const icon: keyof typeof MaterialIcons.glyphMap = isDiscover ? "explore" : "menu-book";

  return (
    <View style={styles.hero} accessibilityRole="header" accessibilityLabel={tag}>
      <View style={[styles.badge, isDiscover ? styles.badgeDiscover : styles.badgeConsult]}>
        <MaterialIcons name={icon} size={16} color="#fffef8" />
        <Text style={styles.badgeText}>{tag}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    width: "100%",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  badgeDiscover: { backgroundColor: pr.discover },
  badgeConsult: { backgroundColor: pr.consult },
  badgeText: {
    fontSize: 14,
    ...parchmentSans(600),
    letterSpacing: 0.5,
    color: "#fffef8",
  },
});
