/**
 * 从 `public/branding/app-icon.png` 重新生成 Expo 原生图标（`apps/askbible-mobile/assets/*`）。
 * 后台上传「网站与 App 图标」时会自动执行；本脚本供本地 / CI 手动同步。
 */
import { regenerateBrandingIcons } from "../lib/branding-generate-icons";
import { readBrandingState } from "../lib/site-branding";
import { isValidHex6, normalizeBrandColors } from "../lib/site-branding-colors";

async function main() {
  const state = await readBrandingState();
  const canvas = normalizeBrandColors(state?.colors).canvas;
  const iconBg =
    state?.logoBackground && isValidHex6(state.logoBackground) ? state.logoBackground.trim().toUpperCase() : canvas;
  await regenerateBrandingIcons(canvas, iconBg, iconBg);
  console.log(`Mobile app icons synced from public/branding/app-icon.png (icon bg: ${iconBg})`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
