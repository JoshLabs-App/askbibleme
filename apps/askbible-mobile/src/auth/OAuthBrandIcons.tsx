import Svg, { Path } from "react-native-svg";
import {
  APPLE_BRAND_ICON_HEIGHT_PX,
  APPLE_BRAND_ICON_WIDTH_PX,
  APPLE_BRAND_VIEWBOX,
  APPLE_LOGO_PATH,
  GOOGLE_BRAND_ICON_PX,
  GOOGLE_BRAND_VIEWBOX,
  GOOGLE_G_PATHS,
} from "../../../../lib/oauth-brand-icon-paths";

type IconProps = {
  size?: number;
  color?: string;
};

export function GoogleBrandIcon({ size = GOOGLE_BRAND_ICON_PX }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox={GOOGLE_BRAND_VIEWBOX}>
      {GOOGLE_G_PATHS.map((segment) => (
        <Path key={segment.fill} fill={segment.fill} d={segment.d} />
      ))}
    </Svg>
  );
}

export function AppleBrandIcon({
  width = APPLE_BRAND_ICON_WIDTH_PX,
  height = APPLE_BRAND_ICON_HEIGHT_PX,
  color = "#ffffff",
}: IconProps & { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox={APPLE_BRAND_VIEWBOX}>
      <Path fill={color} fillRule="nonzero" d={APPLE_LOGO_PATH} />
    </Svg>
  );
}
