/** 画布上 UI 字色/边线：与 `ShellTemplateDesignReference`、左抽屉主题卡共用 */

function parseHexRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.trim().replace(/^#/, "");
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return { r, g, b };
}

/** WCAG relative luminance (sRGB), 0–1 */
function relativeLuminance(hex: string): number {
  const rgb = parseHexRgb(hex);
  if (!rgb) return 0.45;
  const lin = (c: number) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  const R = lin(rgb.r);
  const G = lin(rgb.g);
  const B = lin(rgb.b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * 画布色铺满卡片时的字色与边框；与 `sand` 区分——`sand` 是点缀/链接色，
 * 深壳主题的「主调」在 `canvas`/`surface`。
 */
export function chromeOnCanvas(canvasHex: string): { fg: string; border: string } {
  const L = relativeLuminance(canvasHex);
  if (L > 0.52) {
    return {
      fg: "rgba(10, 18, 32, 0.94)",
      border: "rgba(10, 18, 32, 0.2)",
    };
  }
  return {
    fg: "rgba(248, 250, 252, 0.96)",
    border: "rgba(255, 255, 255, 0.28)",
  };
}

/** 画布是否偏浅（用于胶囊描边等） */
export function isLightBrandCanvas(canvasHex: string): boolean {
  return relativeLuminance(canvasHex) > 0.52;
}
