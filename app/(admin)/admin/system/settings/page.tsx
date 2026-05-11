import {
  brandingAssetsExist,
  brandingLogoExists,
  getResolvedBrandColors,
  readBrandingState,
} from "@/lib/site-branding";
import { AdminBrandingSettings } from "@/components/admin/AdminBrandingSettings";

export const metadata = { title: "全局设置" };

export default async function AdminSystemSettingsPage() {
  const state = await readBrandingState();
  const iconsReady = await brandingAssetsExist();
  const logoReady = await brandingLogoExists();
  const resolvedColors = await getResolvedBrandColors();
  const previewUrls =
    logoReady || iconsReady
      ? {
          ...(logoReady ? { logo: "/branding/logo.png" } : {}),
          ...(iconsReady
            ? {
                icon192: "/branding/icon-192.png",
                icon512: "/branding/icon-512.png",
                appleTouch: "/branding/apple-touch-icon.png",
                favicon32: "/branding/favicon-32.png",
              }
            : {}),
        }
      : null;
  const vectorUrl = state?.logoKind === "svg" ? "/branding/logo.svg" : null;

  return (
    <AdminBrandingSettings
      key={`${state?.updatedAt ?? "branding-initial"}-${state?.appIconsUpdatedAt ?? ""}`}
      initialState={state}
      iconsReady={iconsReady}
      logoReady={logoReady}
      previewUrls={previewUrls}
      resolvedColors={resolvedColors}
      vectorUrl={vectorUrl}
    />
  );
}
