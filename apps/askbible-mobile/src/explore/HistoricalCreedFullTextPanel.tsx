import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import type { AppLocale } from "../../../../lib/i18n/config";
import {
  resolveHistoricalCreedBodyParagraphs,
  resolveInlineHistoricalCreedBodyParagraphs,
} from "../../../../lib/explore/historical-creeds-body-load";
import { t } from "../i18n/site-copy";
import { HistoricalCreedSectionedBody } from "./HistoricalCreedSectionedBody";
import { historicalCreedsScreenStyles as styles } from "./ExploreHistoricalCreedsScreenStyles";

type Props = {
  creedId: string;
  locale: AppLocale;
};

export function HistoricalCreedFullTextPanel({ creedId, locale }: Props) {
  const [paragraphs, setParagraphs] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const inline = resolveInlineHistoricalCreedBodyParagraphs(creedId, locale);
    if (inline) {
      setParagraphs(inline);
      setLoading(false);
      return;
    }

    setLoading(true);
    setParagraphs(null);
    resolveHistoricalCreedBodyParagraphs(creedId, locale)
      .then((body) => {
        if (!cancelled) {
          setParagraphs(body);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setParagraphs([]);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [creedId, locale]);

  if (loading) {
    return (
      <View style={styles.creedBodyLoadingWrap}>
        <ActivityIndicator size="small" />
        <Text style={styles.creedBodyLoadingText}>{t("pages.explore.historicalCreedsBodyLoading")}</Text>
      </View>
    );
  }

  if (!paragraphs || paragraphs.length === 0) {
    return (
      <Text style={styles.creedBodyLoadingText}>{t("pages.explore.historicalCreedsBodyUnavailable")}</Text>
    );
  }

  return (
    <HistoricalCreedSectionedBody
      creedId={creedId}
      paragraphs={paragraphs ?? []}
      locale={locale}
    />
  );
}
