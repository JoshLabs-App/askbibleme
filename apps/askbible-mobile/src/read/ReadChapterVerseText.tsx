import { useMemo } from "react";
import { Text, type TextStyle } from "react-native";
import type { VerseSpeechPart } from "../bible/verse-annotations";
import {
  type VerseTextHighlightKind,
  verseTextHighlightStyle,
} from "./goldenVerseMarkerStyle";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { readTypography } from "./readTypography";
import { useReadBibleTypography } from "./ReadBibleTypographyContext";

type Props = {
  text: string;
  parts: VerseSpeechPart[] | null;
  /** 嵌在父级 `Text` 内与节号同一行流动排版 */
  inline?: boolean;
  /** @deprecated 用 highlight */
  isGolden?: boolean;
  highlight?: VerseTextHighlightKind;
};

function speechSegmentStyle(kind: VerseSpeechPart["kind"]) {
  if (kind === "divine") return styles.divine;
  if (kind === "human") return styles.human;
  return undefined;
}

export function ReadChapterVerseText({
  text,
  parts,
  inline = false,
  isGolden = false,
  highlight,
}: Props) {
  const { px } = useReadBibleTypography();
  const kind = highlight ?? (isGolden ? "golden" : undefined);
  const marker = kind ? verseTextHighlightStyle(kind) : undefined;

  const baseStyle = useMemo(
    (): TextStyle => ({
      ...parchmentSans(readTypography.verseFontWeight),
      fontSize: px.verseFontSize,
      lineHeight: px.verseLineHeight,
      color: readTypography.verseColor,
    }),
    [px.verseFontSize, px.verseLineHeight],
  );

  const segments = useMemo(
    () =>
      parts?.map((seg, i) => (
        <Text key={i} style={speechSegmentStyle(seg.kind)}>
          {seg.text}
        </Text>
      )),
    [parts],
  );

  if (inline) {
    if (!parts?.length) {
      return marker ? <Text style={marker}>{text}</Text> : <Text>{text}</Text>;
    }
    if (marker) {
      return <Text style={marker}>{segments}</Text>;
    }
    return <Text>{segments}</Text>;
  }

  if (!parts?.length) {
    return <Text style={[baseStyle, marker]}>{text}</Text>;
  }

  // 金句底色包在外层 Text，避免 iOS 上分段各自铺底几乎看不见。
  return <Text style={[baseStyle, marker]}>{segments}</Text>;
}

const styles = {
  divine: {
    ...parchmentSans(700),
    color: c.divineSpeech,
  },
  human: {
    // Keep human speech in regular weight; only divine speech is bold.
    color: c.humanSpeech,
  },
};
