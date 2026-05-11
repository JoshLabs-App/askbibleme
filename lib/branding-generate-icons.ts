import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const BRANDING_PUBLIC_DIR = path.resolve(process.cwd(), "public", "branding");
const APP_ICON_MASTER = "app-icon.png";

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

/** 粗检 SVG，阻挡常见脚本注入（顶栏 LOGO 用，不经此文件生成图标）。 */
export function assertSafeSvgText(buf: Buffer): void {
  const head = buf.subarray(0, Math.min(buf.length, 120_000)).toString("utf8");
  if (/<script[\s>]|<iframe|javascript:|data:text\/html|on\w+\s*=/i.test(head)) {
    throw new Error("SVG 含有不安全内容，请移除脚本与事件属性后重试。");
  }
}

/**
 * 读取「网站 / PWA 图标」母版 `app-icon.png`；若不存在则尝试从旧版单一的 `logo.png` 复制一次作为过渡。
 * 不读取顶栏 `logo.svg`（图标母版须为栅格）。
 */
async function readAppIconMasterBuffer(dir: string): Promise<Buffer> {
  const master = path.join(dir, APP_ICON_MASTER);
  try {
    return await fs.readFile(master);
  } catch {
    const legacyLogo = path.join(dir, "logo.png");
    try {
      const b = await fs.readFile(legacyLogo);
      await fs.writeFile(master, b);
      return await fs.readFile(master);
    } catch {
      throw new Error(
        "缺少网站与 App 图标母版：请在后台上传「网站与 App 图标」，或保留可读的 logo.png 作为一次性过渡。",
      );
    }
  }
}

/**
 * 从 `public/branding/app-icon.png` 生成 favicon / PWA / Apple 用 PNG；**不会**修改顶栏 `logo.png` / `logo.svg`。
 * 画布底色用品牌 `canvas`，用于圆角外留白。
 */
export async function regenerateBrandingIcons(canvasHex: string): Promise<void> {
  const dir = BRANDING_PUBLIC_DIR;
  const raw = await readAppIconMasterBuffer(dir);

  const base = await sharp(raw).rotate().png().toBuffer();

  const masterResolved = path.resolve(dir, APP_ICON_MASTER);
  const relMaster = path.relative(dir, masterResolved);
  if (relMaster.startsWith("..") || path.isAbsolute(relMaster)) {
    throw new Error("路径校验失败。");
  }

  await sharp(base)
    .resize({
      width: 1024,
      height: 1024,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png({ compressionLevel: 9 })
    .toFile(masterResolved);

  const normalized = await fs.readFile(masterResolved);

  const [icon192, icon512, apple180, fav32] = await Promise.all([
    squarePng(normalized, 192, canvasHex),
    squarePng(normalized, 512, canvasHex),
    squarePng(normalized, 180, canvasHex),
    squarePng(normalized, 32, canvasHex),
  ]);

  await Promise.all([
    fs.writeFile(path.join(dir, "icon-192.png"), icon192),
    fs.writeFile(path.join(dir, "icon-512.png"), icon512),
    fs.writeFile(path.join(dir, "apple-touch-icon.png"), apple180),
    fs.writeFile(path.join(dir, "favicon-32.png"), fav32),
  ]);
}

/**
 * 将用户上传的栅格写入 `app-icon.png`（旋转为正向 PNG），再生成全站图标包。
 */
export async function writeAppIconMasterFromRaster(fileBuf: Buffer, canvasHex: string): Promise<void> {
  const dir = BRANDING_PUBLIC_DIR;
  await fs.mkdir(dir, { recursive: true });
  const png = await sharp(fileBuf).rotate().png().toBuffer();
  const out = path.resolve(dir, APP_ICON_MASTER);
  const rel = path.relative(dir, out);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("路径校验失败。");
  }
  await fs.writeFile(out, png);
  await regenerateBrandingIcons(canvasHex);
}
