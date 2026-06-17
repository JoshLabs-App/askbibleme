import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { parchmentSans } from "../fonts/parchmentType";
import { useLocale } from "../i18n/LocaleProvider";
import { resolveUiText } from "../i18n/site-copy";
import { ParchmentBottomFadeScrollView } from "../read/ParchmentBottomFadeScrollView";
import { SHELL_TAB_SCROLL_FADE_PRESET } from "../read/readParchmentScrollMask";
import { readParchmentTheme as c } from "../read/readParchmentTheme";
import { resolveExploreStagedEntryLabel } from "./exploreHomeConfig";
import { getExploreStagedEntry, type ExploreStagedEntryId } from "./exploreStagedEntries";
import { exploreStyles as shared, useExploreScrollContentStyle } from "./exploreParchmentStyles";
import { useExploreModulesBundle } from "./useExploreModules";

const BOTTOM_PAD = 120;

type Props = {
  entryId: ExploreStagedEntryId;
};

/** 预埋探索入口：独立空白页，后续在此模块内填内容 */
export function ExploreStagedPlaceholderScreen({ entryId }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { locale } = useLocale();
  const bundle = useExploreModulesBundle();
  const entry = getExploreStagedEntry(entryId);
  const scrollContentStyle = useExploreScrollContentStyle({
    paddingTop: 8 + insets.top,
    paddingBottom: BOTTOM_PAD + insets.bottom,
  });

  const title = entry ? resolveExploreStagedEntryLabel(entry, locale, bundle) : entryId;
  const backLabel = resolveUiText(locale, "← 返回探索", "← Back to Explore");
  const placeholder = resolveUiText(locale, "内容筹备中。", "Coming soon.");

  return (
    <View style={shared.root}>
      <ParchmentBottomFadeScrollView
        fadePreset={SHELL_TAB_SCROLL_FADE_PRESET}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={scrollContentStyle}
      >
        <Pressable onPress={() => router.back()} style={shared.yearDayCountBackLink} accessibilityRole="button">
          <Text style={shared.backLinkText}>{backLabel}</Text>
        </Pressable>

        <Text style={styles.pageTitle}>{title}</Text>
        <Text style={styles.placeholder}>{placeholder}</Text>
      </ParchmentBottomFadeScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pageTitle: {
    marginTop: 10,
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: -0.45,
    ...parchmentSans(600),
    color: c.ink,
    textAlign: "center",
  },
  placeholder: {
    marginTop: 28,
    fontSize: 15,
    lineHeight: 23,
    letterSpacing: 0.1,
    ...parchmentSans(500),
    color: c.inkSoft,
    textAlign: "center",
  },
});
