import {
  brandingAssetsExist,
  getResolvedBrandColors,
  readBrandingState,
} from "@/lib/site-branding";
import { AdminBrandingSettings } from "@/components/admin/AdminBrandingSettings";

export const metadata = { title: "全局设置" };

export default async function AdminSystemSettingsPage() {
  const state = await readBrandingState();
  const assetsReady = await brandingAssetsExist();
  const resolvedColors = await getResolvedBrandColors();
  const previewUrls = assetsReady
    ? {
        logo: "/branding/logo.png",
        icon192: "/branding/icon-192.png",
        icon512: "/branding/icon-512.png",
        appleTouch: "/branding/apple-touch-icon.png",
        favicon32: "/branding/favicon-32.png",
      }
    : null;
  const vectorUrl = state?.logoKind === "svg" ? "/branding/logo.svg" : null;

  return (
    <AdminBrandingSettings
      key={state?.updatedAt ?? "branding-initial"}
      initialState={state}
      assetsReady={assetsReady}
      previewUrls={previewUrls}
      resolvedColors={resolvedColors}
      vectorUrl={vectorUrl}
    />
  );
}
