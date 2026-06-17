import { Text, View } from "react-native";
import { t } from "../i18n/site-copy";
import { bibleCatalogOutlineStyles as styles } from "./bibleCatalogOutlineStyles";

export function BibleCatalogTestamentHeader({
  testament,
  compact = false,
  lockTextScale = true,
}: {
  testament: "old" | "new";
  compact?: boolean;
  lockTextScale?: boolean;
}) {
  const isOld = testament === "old";
  return (
    <View style={[styles.testamentHeaderWrap, compact && styles.testamentHeaderWrapCompact]} accessibilityRole="header">
      <Text
        style={[
          styles.testamentHeaderLabel,
          compact && styles.testamentHeaderLabelCompact,
          isOld ? styles.testamentHeaderLabelOt : styles.testamentHeaderLabelNt,
        ]}
        allowFontScaling={!lockTextScale}
        numberOfLines={1}
        maxFontSizeMultiplier={lockTextScale ? 1 : 1.1}
      >
        {isOld ? t("pages.read.catalogTestamentOld") : t("pages.read.catalogTestamentNew")}
      </Text>
    </View>
  );
}
