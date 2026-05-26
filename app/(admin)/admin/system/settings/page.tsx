import fs from "node:fs/promises";
import path from "node:path";
import { sampleMasterIconBackgroundHex } from "@/lib/branding-generate-icons";
import {
  BRANDING_PUBLIC_DIR,
  brandingAssetsExist,
  brandingLogoExists,
  brandingSplashExists,
  getResolvedBrandColors,
  getResolvedLogoBackground,
  getResolvedLogoTextAccent,
  readBrandingState,
} from "@/lib/site-branding";
import { AdminBrandingSettings } from "@/components/admin/AdminBrandingSettings";

export const metadata = { title: "全局设置" };

export default async function AdminSystemSettingsPage() {
  const state = await readBrandingState();
  const iconsReady = await brandingAssetsExist();
  const logoReady = await brandingLogoExists();
  const splashReady = await brandingSplashExists();
  const resolvedColors = await getResolvedBrandColors();
  const resolvedLogoBackground = await getResolvedLogoBackground();
  const resolvedLogoTextAccent = await getResolvedLogoTextAccent();
  let iconPreviewBackground = resolvedColors.canvas;
  if (iconsReady || logoReady) {
    for (const rel of ["app-icon.png", "logo.png"]) {
      try {
        const buf = await fs.readFile(path.join(BRANDING_PUBLIC_DIR, rel));
        iconPreviewBackground = await sampleMasterIconBackgroundHex(buf, resolvedColors.canvas);
        break;
      } catch {
        /* try next */
      }
    }
  }
  const previewUrls =
    logoReady || iconsReady || splashReady
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
          ...(splashReady ? { splash: "/branding/splash-icon.png" } : {}),
        }
      : null;
  const vectorUrl = state?.logoKind === "svg" ? "/branding/logo.svg" : null;

  return (
    <AdminBrandingSettings
      key={`${state?.updatedAt ?? "branding-initial"}-${state?.appIconsUpdatedAt ?? ""}`}
      initialState={state}
      iconsReady={iconsReady}
      logoReady={logoReady}
      splashReady={splashReady}
      previewUrls={previewUrls}
      resolvedColors={resolvedColors}
      resolvedLogoBackground={resolvedLogoBackground}
      resolvedLogoTextAccent={resolvedLogoTextAccent}
      iconPreviewBackground={iconPreviewBackground}
      vectorUrl={vectorUrl}
    />
  );
}
