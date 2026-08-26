import type { ComponentProps } from "react";
import { ReadUiScaledText } from "../read/ReadUiScaledText";

type Props = Omit<ComponentProps<typeof ReadUiScaledText>, "sizeBump">;

/** 探索页文字：跟读经字号，并默认再放大一号。 */
export function ExploreText(props: Props) {
  return <ReadUiScaledText {...props} sizeBump={1} />;
}
