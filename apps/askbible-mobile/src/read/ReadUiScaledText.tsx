import { useContext, useMemo, type ComponentProps } from "react";
import { Text } from "react-native";
import { ReadBibleTypographyContext } from "./readBibleTypographyContextTypes";
import {
  defaultReadBibleTypographyPrefs,
  readBibleTypographyPx,
  stepReadBibleSize,
  type ReadBibleSizeId,
} from "./read-bible-typography-prefs";
import { readBibleUiTextScale, scaleTextStyle } from "./readBibleUiTextScale";

type Props = ComponentProps<typeof Text> & {
  /** 相对读经当前字号再偏一档（探索页默认 +1） */
  sizeBump?: -1 | 0 | 1;
};

function sizeWithBump(size: ReadBibleSizeId, bump: -1 | 0 | 1): ReadBibleSizeId {
  if (bump === 0) return size;
  return stepReadBibleSize(size, bump);
}

/** 字号跟随读经页「大 / 小」设置的 Text（探索等非章节页复用）。 */
export function ReadUiScaledText({ style, sizeBump = 0, ...rest }: Props) {
  const ctx = useContext(ReadBibleTypographyContext);
  const typography = ctx?.typography ?? defaultReadBibleTypographyPrefs();
  const basePx = ctx?.px ?? readBibleTypographyPx(typography.size);
  const scalePx = sizeBump === 0 ? basePx : readBibleTypographyPx(sizeWithBump(typography.size, sizeBump));
  const scale = readBibleUiTextScale(scalePx);
  const scaledStyle = useMemo(() => scaleTextStyle(style, scale), [scale, style]);
  return <Text {...rest} style={scaledStyle} />;
}
