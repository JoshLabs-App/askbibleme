import { Text } from "react-native";
import { useRouter } from "expo-router";
import { parseReadPath } from "../../../../lib/bible/parse-askbible-read-link";
import { splitCreedReadLinks } from "../../../../lib/explore/historical-creeds-scripture-links";
import { pushExploreReadChapter, useExploreReadReturnPath } from "./explore-read-chapter-nav";
import { historicalCreedsScreenStyles as styles } from "./ExploreHistoricalCreedsScreenStyles";

type Props = {
  text: string;
  bodyStyle?: object;
};

export function CreedScriptureRichText({ text, bodyStyle }: Props) {
  const router = useRouter();
  const exploreReturn = useExploreReadReturnPath();
  const segments = splitCreedReadLinks(text);
  const baseStyle = bodyStyle ?? styles.creedFullTextBody;

  return (
    <Text style={baseStyle}>
      {segments.map((segment, index) => {
        if (segment.type === "text") {
          return <Text key={index}>{segment.text}</Text>;
        }
        const parsed = parseReadPath(segment.href);
        return (
          <Text
            key={index}
            style={styles.creedScriptureLink}
            onPress={() => {
              if (!parsed) return;
              pushExploreReadChapter(
                router,
                {
                  bookId: parsed.bookId,
                  chapter: parsed.chapter,
                  verse: parsed.verse,
                },
                exploreReturn,
              );
            }}
          >
            {segment.text}
          </Text>
        );
      })}
    </Text>
  );
}
