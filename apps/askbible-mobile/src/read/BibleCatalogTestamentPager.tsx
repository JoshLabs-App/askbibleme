import { Pressable, Text, View } from "react-native";
import type { AppLocale } from "../i18n/config";
import { createT } from "../i18n/site-copy";
import { TESTAMENT_INTRO } from "./bibleCatalogOutlineConstants";
import { bibleCatalogOutlineStyles as styles } from "./bibleCatalogOutlineStyles";

type Props = {
  activeTestament: "old" | "new";
  onSelectTestament: (testament: "old" | "new") => void;
  catalogNarrowStyle: { maxWidth: number } | null;
  lockTextScale?: boolean;
  displayLocale?: AppLocale;
};

export function BibleCatalogTestamentPager({
  activeTestament,
  onSelectTestament,
  catalogNarrowStyle,
  lockTextScale = true,
  displayLocale = "zh-CN",
}: Props) {
  const t = createT(displayLocale);
  const allowFontScaling = !lockTextScale;
  const scaledMax = (value: number) => (lockTextScale ? 1 : value);

  return (
    <View style={[styles.testamentPagerWrap, catalogNarrowStyle]}>
      <View style={styles.testamentPager}>
        <Pressable
          onPress={() => onSelectTestament("old")}
          style={[
            styles.testamentPagerBtn,
            activeTestament === "old" && styles.testamentPagerBtnActive,
            activeTestament === "old" && styles.testamentPagerBtnOtActive,
          ]}
        >
          <Text
            style={[
              styles.testamentPagerText,
              activeTestament === "old" && styles.testamentPagerTextActive,
              activeTestament === "old" && styles.testamentPagerTextOtActive,
            ]}
            allowFontScaling={allowFontScaling}
            maxFontSizeMultiplier={scaledMax(1.1)}
          >
            {t("pages.read.catalogTestamentOld")}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onSelectTestament("new")}
          style={[
            styles.testamentPagerBtn,
            activeTestament === "new" && styles.testamentPagerBtnActive,
            activeTestament === "new" && styles.testamentPagerBtnNtActive,
          ]}
        >
          <Text
            style={[
              styles.testamentPagerText,
              styles.testamentPagerTextNt,
              activeTestament === "new" && styles.testamentPagerTextActive,
              activeTestament === "new" && styles.testamentPagerTextNtActive,
            ]}
            allowFontScaling={allowFontScaling}
            maxFontSizeMultiplier={scaledMax(1.1)}
          >
            {t("pages.read.catalogTestamentNew")}
          </Text>
        </Pressable>
      </View>
      <Text
        style={styles.testamentPagerIntro}
        allowFontScaling={allowFontScaling}
        maxFontSizeMultiplier={scaledMax(1.1)}
      >
        {TESTAMENT_INTRO[displayLocale][activeTestament]}
      </Text>
    </View>
  );
}
