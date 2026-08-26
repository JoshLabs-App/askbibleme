import { StyleSheet, View } from "react-native";
import { ExploreText as Text } from "./ExploreText";
import { useLocale } from "../i18n/LocaleProvider";
import { exploreStyles as s } from "./exploreParchmentStyles";
import {
  filterEternityProse,
  filterEternityScriptures,
  formatScriptureBlockBody,
} from "./years-days-eternity-blocks";
import { getYearsDaysEternityEn, resolveYearsDaysEternityDocument } from "./years-days-eternity-content";

export function ExploreYearDayCountLifeExpectancyIntro() {
  const { locale } = useLocale();
  const doc = locale === "en" ? getYearsDaysEternityEn() : resolveYearsDaysEternityDocument(locale);

  return (
    <View style={s.yearDayCountBottomContext}>
      {filterEternityProse(doc.intro).map((lines, i) => (
        <Text key={`prose-${i}`} style={s.yearDayCountBottomParagraph}>
          {lines.join(locale === "en" ? " " : "")}
        </Text>
      ))}
      {filterEternityScriptures(doc.intro).map((block, i) => (
        <View key={`scripture-${i}`} style={styles.scriptureBlock}>
          <Text style={s.yearDayCountBottomParagraph}>{formatScriptureBlockBody(block.lines)}</Text>
          <Text style={s.yearDayCountBottomRefLine}>— {block.ref}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  scriptureBlock: {
    width: "100%",
    maxWidth: 380,
  },
});
