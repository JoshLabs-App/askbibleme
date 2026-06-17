import { Text } from "react-native";
import { readScriptureSearchScreenStyles as styles } from "./readScriptureSearchScreenStyles";

export function renderScriptureSearchHitText(text: string, query: string) {
  const keyword = query.trim();
  if (!keyword) return text;
  const parts = text.split(keyword);
  if (parts.length <= 1) return text;
  return parts.map((part, idx) => (
    <Text key={`${part}-${idx}`}>
      {part}
      {idx < parts.length - 1 ? <Text style={styles.hitTextHighlight}>{keyword}</Text> : null}
    </Text>
  ));
}
