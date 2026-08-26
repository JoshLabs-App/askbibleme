import { SHELL_TAB_BAR_ICON } from "./shellChromeIcons";
import { ShellMaterialIcon } from "./ShellMaterialIcon";
import { t } from "../i18n/site-copy";
import { SPLASH_BACKGROUND as LOGO_COLOR } from "./splash-branding.generated";

type TabKey = "index" | "music" | "read" | "explore";

export const TAB_ICON_SIZE = 36;
export const PLAY_ICON_SIZE = 28;

export function tabTelemetryName(routeName: string): "home" | "music" | "read" | "explore" | null {
  switch (routeName as TabKey) {
    case "index":
      return "home";
    case "music":
      return "music";
    case "read":
      return "read";
    case "explore":
      return "explore";
    default:
      return null;
  }
}

export function tabLabel(routeName: string): string {
  switch (routeName as TabKey) {
    case "index":
      return t("nav.home");
    case "music":
      return t("nav.music");
    case "read":
      return t("nav.read");
    case "explore":
      return t("nav.explore");
    default:
      return routeName;
  }
}

export function tabIcon(routeName: string, active: boolean) {
  const color = active ? LOGO_COLOR : SHELL_TAB_BAR_ICON;
  switch (routeName as TabKey) {
    case "index":
      return <ShellMaterialIcon name="home" size={TAB_ICON_SIZE} color={color} />;
    case "music":
      return <ShellMaterialIcon name="music-note" size={TAB_ICON_SIZE} color={color} />;
    case "read":
      return <ShellMaterialIcon name="menu-book" size={TAB_ICON_SIZE} color={color} />;
    case "explore":
      return <ShellMaterialIcon name="explore" size={TAB_ICON_SIZE} color={color} />;
    default:
      return <ShellMaterialIcon name="circle" size={TAB_ICON_SIZE} color={color} />;
  }
}
