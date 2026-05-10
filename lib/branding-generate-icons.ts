import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const BRANDING_PUBLIC_DIR = path.resolve(process.cwd(), "public", "branding");

function parseRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace(/^#/, "");
  if (h.length !== 6) return { r: 244, g: 235, b: 217 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

async function squarePng(from: Buffer, size: number, bgHex: string): Promise<Buffer> {
  const BG = parseRgb(bgHex);
  return sharp(from)
    .resize(size, size, {
      fit: "contain",
      position: "center",
      background: { ...BG, alpha: 1 },
    })
    .png()
    .toBuffer();
}

/** 粗检 SVG，阻挡常见脚本注入（仍需栅格化后才对外展示 PNG）。 */
export function assertSafeSvgText(buf: Buffer): void {
  const head = buf.subarray(0, Math.min(buf.length, 120_000)).toString("utf8");
  if (
    /<script[\s>]|<iframe|javascript:|data:text\/html|on\w+\s*=/i.test(head)
  ) {
    throw new Error("SVG 含有不安全内容，请移除脚本与事件属性后重试。");
  }
}

async function loadRasterInput(dir: string): Promise<{ buf: Buffer; kind: "svg" | "raster" }> {
  const svgPath = path.join(dir, "logo.svg");
  const pngPath = path.join(dir, "logo.png");
  try {
    await fs.access(svgPath);
    const buf = await fs.readFile(svgPath);
    assertSafeSvgText(buf);
    return { buf, kind: "svg" };
  } catch {
    /* no svg */
  }
  try {
    await fs.access(pngPath);
    const buf = await fs.readFile(pngPath);
    return { buf, kind: "raster" };
  } catch {
    throw new Error("缺少 logo.svg 或 logo.png，请先上传 LOGO。");
  }
}

function sharpFromLogo(buf: Buffer, kind: "svg" | "raster") {
  return kind === "svg" ? sharp(buf, { density: 240 }) : sharp(buf);
}

/**
 * 从 `public/branding/logo.svg`（优先）或 `logo.png` 生成各尺寸 PNG，底色用品牌 canvas。
 */
export async function regenerateBrandingIcons(canvasHex: string): Promise<void> {
  const dir = BRANDING_PUBLIC_DIR;
  const { buf, kind } = await loadRasterInput(dir);

  const logoPath = path.join(dir, "logo.png");
  const resolvedLogo = path.resolve(logoPath);
  const relLogo = path.relative(dir, resolvedLogo);
  if (relLogo.startsWith("..") || path.isAbsolute(relLogo)) {
    throw new Error("路径校验失败。");
  }

  const base = await sharpFromLogo(buf, kind).rotate().png().toBuffer();

  await sharp(base)
    .resize({
      width: 1024,
      height: 1024,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png({ compressionLevel: 9 })
    .toFile(resolvedLogo);

  const [icon192, icon512, apple180, fav32] = await Promise.all([
    squarePng(base, 192, canvasHex),
    squarePng(base, 512, canvasHex),
    squarePng(base, 180, canvasHex),
    squarePng(base, 32, canvasHex),
  ]);

  await Promise.all([
    fs.writeFile(path.join(dir, "icon-192.png"), icon192),
    fs.writeFile(path.join(dir, "icon-512.png"), icon512),
    fs.writeFile(path.join(dir, "apple-touch-icon.png"), apple180),
    fs.writeFile(path.join(dir, "favicon-32.png"), fav32),
  ]);
}
