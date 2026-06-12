import {
  APPLE_BRAND_ICON_HEIGHT_PX,
  APPLE_BRAND_ICON_WIDTH_PX,
  APPLE_BRAND_VIEWBOX,
  APPLE_LOGO_PATH,
  GOOGLE_BRAND_ICON_PX,
  GOOGLE_BRAND_VIEWBOX,
  GOOGLE_G_PATHS,
} from "@/lib/oauth-brand-icon-paths";

type IconProps = {
  size?: number;
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
};

export function GoogleBrandIcon({
  size = GOOGLE_BRAND_ICON_PX,
  className,
  "aria-hidden": ariaHidden = true,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={GOOGLE_BRAND_VIEWBOX}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={ariaHidden}
    >
      {GOOGLE_G_PATHS.map((segment) => (
        <path key={segment.fill} fill={segment.fill} d={segment.d} />
      ))}
    </svg>
  );
}

export function AppleBrandIcon({
  width = APPLE_BRAND_ICON_WIDTH_PX,
  height = APPLE_BRAND_ICON_HEIGHT_PX,
  className,
  color = "currentColor",
  "aria-hidden": ariaHidden = true,
}: IconProps & { color?: string; width?: number; height?: number }) {
  return (
    <svg
      width={width}
      height={height}
      viewBox={APPLE_BRAND_VIEWBOX}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={ariaHidden}
    >
      <path fill={color} fillRule="nonzero" d={APPLE_LOGO_PATH} />
    </svg>
  );
}
