import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { DEFAULT_LOGO_TEXT_ACCENT, readBrandingState } from "@/lib/site-branding";
import { isValidHex6 } from "@/lib/site-branding-colors";

const BRANDING_PUBLIC_DIR = path.resolve(process.cwd(), "public", "branding");
const MOBILE_ROOT = path.resolve(process.cwd(), "apps", "askbible-mobile");
const MOBILE_ASSETS_DIR = path.join(MOBILE_ROOT, "assets");
const MOBILE_APP_JSON = path.join(MOBILE_ROOT, "app.json");
const IOS_APP_ICON_SET = path.join(
  MOBILE_ROOT,
  "ios",
  "AskBible.me",
  "Images.xcassets",
  "AppIcon.appiconset",
);
const IOS_SPLASH_LEGACY = path.join(
  MOBILE_ROOT,
  "ios",
  "AskBible.me",
  "Images.xcassets",
  "SplashScreenLegacy.imageset",
);
const ANDROID_RES_DIR = path.join(MOBILE_ROOT, "android", "app", "src", "main", "res");
const ANDROID_COLORS_XML = path.join(ANDROID_RES_DIR, "values", "colors.xml");
const DEFAULT_NOTIFICATION_ICON_COLOR = "#ECD9B9";
const APP_ICON_MASTER = "app-icon.png";
const APP_ICON_MARK_SCALE = 0.78;

async function resolveSplashBackgroundHex(canvasHex: string, override?: string): Promise<string> {
  if (override && isValidHex6(override)) return override.trim().toUpperCase();
  const st = await readBrandingState();
  if (st?.logoBackground && isValidHex6(st.logoBackground)) {
    return st.logoBackground.trim().toUpperCase();
  }
  return canvasHex.trim().toUpperCase();
}

const ANDROID_LAUNCHER_PX = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
} as const;

const ANDROID_ADAPTIVE_FG_PX = {
  mdpi: 108,
  hdpi: 162,
  xhdpi: 216,
  xxhdpi: 324,
  xxxhdpi: 432,
} as const;

function parseRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace(/^#/, "");
  if (h.length !== 6) return { r: 244, g: 235, b: 217 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function rgbToHex6(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((x) => clampByte(x).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

/**
 * 从图标母版边沿采样主导底色。重绘 PWA / 桌面图标时用此色，避免品牌 `canvas`（常更浅）把母版洗浅。
 */
export async function sampleMasterIconBackgroundHex(
  from: Buffer,
  fallbackHex: string,
): Promise<string> {
  const size = 64;
  const { data, info } = await sharp(from)
    .resize(size, size, { fit: "cover", position: "centre" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const band = Math.max(2, Math.floor(size * 0.14));
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x >= band && x < w - band && y >= band && y < h - band) continue;
      const o = (y * w + x) * 4;
      const a = data[o + 3]!;
      if (a < 128) continue;
      const r = data[o]!;
      const g = data[o + 1]!;
      const b = data[o + 2]!;
      if (isWhiteLike(r, g, b, a)) continue;
      rs.push(r);
      gs.push(g);
      bs.push(b);
    }
  }

  if (rs.length < 8) return fallbackHex.trim().toUpperCase();

  const median = (arr: number[]) => {
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)]!;
  };
  return rgbToHex6(median(rs), median(gs), median(bs));
}

function colorDistance(r: number, g: number, b: number, bg: { r: number; g: number; b: number }): number {
  return Math.hypot(r - bg.r, g - bg.g, b - bg.b);
}

function isBackgroundLike(
  r: number,
  g: number,
  b: number,
  a: number,
  bg: { r: number; g: number; b: number },
  tolerance = 48,
): boolean {
  if (a < 16) return true;
  return colorDistance(r, g, b, bg) < tolerance;
}

function isWhiteLike(r: number, g: number, b: number, a: number): boolean {
  if (a < 128) return false;
  return r > 232 && g > 232 && b > 232;
}

/**
 * 母版常为「白形 + 与画布同色的镂空圆点」：只保留不透明白形，圆点处保持透明，铺底后圆点可见。
 */
async function monochromeWhiteMarkPng(from: Buffer, _canvasHex: string): Promise<Buffer> {
  const { data, info } = await sharp(from).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const n = w * h;

  const out = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const a = data[o + 3]!;
    const white = isWhiteLike(data[o]!, data[o + 1]!, data[o + 2]!, data[o + 3]!);
    if (a >= 16 && white) {
      out[o] = 255;
      out[o + 1] = 255;
      out[o + 2] = 255;
      out[o + 3] = 255;
    } else {
      // 画布色圆点等内孔：透明，合成时露出底色
      out[o + 3] = 0;
    }
  }

  return sharp(out, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

/** 品牌画布 + 居中纯白标记（legacy 方形图标 / PWA） */
async function whiteMarkOnCanvasPng(
  whiteMark: Buffer,
  canvasSize: number,
  bgHex: string,
  iconScale: number,
): Promise<Buffer> {
  const BG = parseRgb(bgHex);
  const inner = Math.max(1, Math.round(canvasSize * iconScale));
  const icon = await sharp(whiteMark)
    .resize(inner, inner, {
      fit: "contain",
      position: "center",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  return sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 4,
      background: { ...BG, alpha: 1 },
    },
  })
    .composite([{ input: icon, gravity: "center" }])
    .png()
    .toBuffer();
}

/** 透明底 + 居中纯白标记（Android adaptive 前景） */
async function whiteMarkOnTransparentPng(
  whiteMark: Buffer,
  canvasSize: number,
  iconScale: number,
): Promise<Buffer> {
  const inner = Math.max(1, Math.round(canvasSize * iconScale));
  const icon = await sharp(whiteMark)
    .resize(inner, inner, {
      fit: "contain",
      position: "center",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  return sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: icon, gravity: "center" }])
    .png()
    .toBuffer();
}

async function syncMobileAppJsonCanvasColor(canvasHex: string, splashBackgroundHex: string): Promise<void> {
  const raw = await fs.readFile(MOBILE_APP_JSON, "utf8");
  const json = JSON.parse(raw) as {
    expo?: {
      splash?: { backgroundColor?: string };
      android?: { adaptiveIcon?: { backgroundColor?: string } };
    };
  };
  if (!json.expo) return;
  json.expo.splash = { ...json.expo.splash, backgroundColor: splashBackgroundHex };
  const android = json.expo.android ?? {};
  json.expo.android = {
    ...android,
    adaptiveIcon: {
      ...android.adaptiveIcon,
      backgroundColor: canvasHex,
    },
  };
  await fs.writeFile(MOBILE_APP_JSON, `${JSON.stringify(json, null, 2)}\n`);
}

function mixHexLocal(a: string, b: string, t: number): string {
  const parse = (hex: string) => {
    const h = hex.replace(/^#/, "");
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  };
  const c0 = parse(a);
  const c1 = parse(b);
  const u = Math.max(0, Math.min(1, t));
  const ch = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${ch(c0.r + (c1.r - c0.r) * u)}${ch(c0.g + (c1.g - c0.g) * u)}${ch(c0.b + (c1.b - c0.b) * u)}`;
}

async function readMobileNotificationIconColor(): Promise<string> {
  try {
    const raw = await fs.readFile(MOBILE_APP_JSON, "utf8");
    const json = JSON.parse(raw) as {
      expo?: { plugins?: unknown[] };
    };
    for (const plugin of json.expo?.plugins ?? []) {
      if (Array.isArray(plugin) && plugin[0] === "expo-notifications") {
        const color = (plugin[1] as { color?: string } | undefined)?.color;
        if (color && isValidHex6(color)) return color.trim().toUpperCase();
      }
    }
  } catch {
    /* fall through */
  }
  return DEFAULT_NOTIFICATION_ICON_COLOR;
}

/** 已提交到仓库的 `ios/`、`android/` 原生资源（EAS 本地工程构建会读这里，不只读 Expo assets）。 */
async function syncNativeMobileAppIcons(opts: {
  icon1024: Buffer;
  adaptive1024: Buffer;
  splash1024: Buffer;
  canvasHex: string;
  splashBackgroundHex: string;
}): Promise<void> {
  const { icon1024, adaptive1024, splash1024, canvasHex, splashBackgroundHex } = opts;
  const canvas = canvasHex.toUpperCase();
  const splashBg = splashBackgroundHex.toUpperCase();
  const canvasDark = mixHexLocal(canvas, "#000000", 0.14).toLowerCase();
  const notificationIconColor = (await readMobileNotificationIconColor()).toLowerCase();

  try {
    await fs.mkdir(IOS_APP_ICON_SET, { recursive: true });
    await fs.writeFile(path.join(IOS_APP_ICON_SET, "App-Icon-1024x1024@1x.png"), icon1024);
  } catch {
    /* 无 ios 工程时跳过（仅 Expo Go） */
  }

  try {
    await fs.mkdir(IOS_SPLASH_LEGACY, { recursive: true });
    const splashNames = ["image.png", "image@2x.png", "image@3x.png"] as const;
    await Promise.all(
      splashNames.map((name) => fs.writeFile(path.join(IOS_SPLASH_LEGACY, name), splash1024)),
    );
  } catch {
    /* 同上 */
  }

  try {
    await fs.mkdir(path.dirname(ANDROID_COLORS_XML), { recursive: true });
    await fs.writeFile(
      ANDROID_COLORS_XML,
      `<?xml version="1.0" encoding="UTF-8"?>
<resources>
  <color name="splashscreen_background">${splashBg.toLowerCase()}</color>
  <color name="iconBackground">${canvas.toLowerCase()}</color>
  <color name="colorPrimary">${canvas.toLowerCase()}</color>
  <color name="colorPrimaryDark">${canvasDark}</color>
  <color name="notification_icon_color">${notificationIconColor}</color>
  <color name="parchment_window_fill">#faf3e1</color>
</resources>
`,
    );

    for (const density of Object.keys(ANDROID_LAUNCHER_PX) as (keyof typeof ANDROID_LAUNCHER_PX)[]) {
      const launcherPx = ANDROID_LAUNCHER_PX[density];
      const fgPx = ANDROID_ADAPTIVE_FG_PX[density];
      const mipmapDir = path.join(ANDROID_RES_DIR, `mipmap-${density}`);
      await fs.mkdir(mipmapDir, { recursive: true });
      const [launcher, fg] = await Promise.all([
        sharp(icon1024)
          .resize(launcherPx, launcherPx, {
            fit: "contain",
            position: "center",
            background: { ...parseRgb(canvasHex), alpha: 1 },
          })
          .png()
          .toBuffer(),
        sharp(adaptive1024)
          .resize(fgPx, fgPx, { fit: "contain", position: "center", background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer(),
      ]);
      await Promise.all([
        fs.writeFile(path.join(mipmapDir, "ic_launcher.png"), launcher),
        fs.writeFile(path.join(mipmapDir, "ic_launcher_round.png"), launcher),
        fs.writeFile(path.join(mipmapDir, "ic_launcher_foreground.png"), fg),
      ]);
    }
  } catch {
    /* 无 android 工程时跳过 */
  }
}

/** 仅更新 iOS / Android 启动屏资源，不改动 AppIcon / 桌面图标。 */
async function syncNativeSplashOnly(splash1024: Buffer, splashBackgroundHex: string): Promise<void> {
  const splashBg = splashBackgroundHex.toUpperCase();

  try {
    await fs.mkdir(IOS_SPLASH_LEGACY, { recursive: true });
    const splashNames = ["image.png", "image@2x.png", "image@3x.png"] as const;
    await Promise.all(
      splashNames.map((name) => fs.writeFile(path.join(IOS_SPLASH_LEGACY, name), splash1024)),
    );
  } catch {
    /* 无 ios 工程时跳过 */
  }

  try {
    const raw = await fs.readFile(ANDROID_COLORS_XML, "utf8");
    const next = raw.replace(
      /<color name="splashscreen_background">[^<]*<\/color>/,
      `<color name="splashscreen_background">${splashBg.toLowerCase()}</color>`,
    );
    if (next !== raw) await fs.writeFile(ANDROID_COLORS_XML, next);
  } catch {
    /* 无 android 工程时跳过 */
  }
}

/**
 * 从已规范化的图标母版写入 `apps/askbible-mobile/assets/*`（Expo / 原生安装包用）。
 * 须与 `regenerateBrandingIcons` 一并调用，保证与网站 PWA 同源。
 */
const MOBILE_SPLASH_BRANDING_TS = path.join(MOBILE_ROOT, "src", "shell", "splash-branding.generated.ts");
const PUBLIC_SPLASH_ICON = path.join(BRANDING_PUBLIC_DIR, "splash-icon.png");

async function writeMobileSplashBrandingTs(splashBackgroundHex: string): Promise<void> {
  const splashHex = splashBackgroundHex.toUpperCase();
  const state = await readBrandingState();
  const textAccentHex =
    state?.logoTextAccent && isValidHex6(state.logoTextAccent)
      ? state.logoTextAccent.trim().toUpperCase()
      : DEFAULT_LOGO_TEXT_ACCENT;
  await fs.mkdir(path.dirname(MOBILE_SPLASH_BRANDING_TS), { recursive: true });
  await fs.writeFile(
    MOBILE_SPLASH_BRANDING_TS,
    `/** 由后台品牌设置自动生成，请勿手改。 */\nexport const SPLASH_BACKGROUND = "${splashHex}";\nexport const LOGO_TEXT_ACCENT = "${textAccentHex}";\n`,
  );
}

export async function regenerateMobileAppIcons(
  normalizedMaster: Buffer,
  iconBackgroundHex: string,
  splashBackgroundHex?: string,
  brandCanvasHex?: string,
): Promise<void> {
  const iconBg = iconBackgroundHex.toUpperCase();
  const splashBg = (splashBackgroundHex ?? iconBg).toUpperCase();
  const brandCanvas = (brandCanvasHex ?? iconBg).toUpperCase();
  await fs.mkdir(MOBILE_ASSETS_DIR, { recursive: true });
  await fs.mkdir(BRANDING_PUBLIC_DIR, { recursive: true });

  const whiteMark = await monochromeWhiteMarkPng(normalizedMaster, iconBg);
  const [icon1024, adaptive1024, splash1024, favicon48] = await Promise.all([
    whiteMarkOnCanvasPng(whiteMark, 1024, iconBg, APP_ICON_MARK_SCALE),
    whiteMarkOnTransparentPng(whiteMark, 1024, APP_ICON_MARK_SCALE),
    whiteMarkOnCanvasPng(whiteMark, 1024, splashBg, 0.42),
    whiteMarkOnCanvasPng(whiteMark, 48, iconBg, APP_ICON_MARK_SCALE),
  ]);

  await Promise.all([
    fs.writeFile(path.join(MOBILE_ASSETS_DIR, "icon.png"), icon1024),
    fs.writeFile(path.join(MOBILE_ASSETS_DIR, "adaptive-icon.png"), adaptive1024),
    fs.writeFile(path.join(MOBILE_ASSETS_DIR, "splash-icon.png"), splash1024),
    fs.writeFile(path.join(MOBILE_ASSETS_DIR, "favicon.png"), favicon48),
    fs.writeFile(PUBLIC_SPLASH_ICON, splash1024),
  ]);

  await syncMobileAppJsonCanvasColor(brandCanvas, splashBg);
  await syncNativeMobileAppIcons({
    icon1024,
    adaptive1024,
    splash1024,
    canvasHex: iconBg,
    splashBackgroundHex: splashBg,
  });
  await writeMobileSplashBrandingTs(splashBg);
}

/**
 * 仅重绘启动屏（Expo / iOS / Android 冷启动 + App 内加载占位图），不改动网站 PWA 图标。
 */
export async function regenerateSplashPack(canvasHex: string, splashBackgroundHex: string): Promise<void> {
  const dir = BRANDING_PUBLIC_DIR;
  const raw = await readAppIconMasterBuffer(dir, canvasHex);
  const normalized = await sharp(raw).rotate().png().toBuffer();
  const splashBg = splashBackgroundHex.toUpperCase();
  const markBg = await sampleMasterIconBackgroundHex(raw, canvasHex);
  const whiteMark = await monochromeWhiteMarkPng(normalized, markBg);
  const splash1024 = await whiteMarkOnCanvasPng(whiteMark, 1024, splashBg, 0.42);

  await fs.mkdir(MOBILE_ASSETS_DIR, { recursive: true });
  await fs.mkdir(BRANDING_PUBLIC_DIR, { recursive: true });
  await fs.writeFile(path.join(MOBILE_ASSETS_DIR, "splash-icon.png"), splash1024);
  await fs.writeFile(PUBLIC_SPLASH_ICON, splash1024);

  await syncMobileAppJsonCanvasColor(canvasHex, splashBg);
  await syncNativeSplashOnly(splash1024, splashBg);
  await writeMobileSplashBrandingTs(splashBg);
}

/**
 * 读取顶栏 LOGO（`logo.png` 或栅格化 `logo.svg`），写入 App 图标母版并全量同步（含 iOS / Android 原生）。
 */
export async function syncAppIconsFromBarLogo(
  iconBackgroundHex: string,
  brandCanvasHex?: string,
): Promise<RegenerateBrandingIconsResult> {
  const dir = BRANDING_PUBLIC_DIR;
  await fs.mkdir(dir, { recursive: true });
  const pngPath = path.join(dir, "logo.png");
  const svgPath = path.join(dir, "logo.svg");

  let raster: Buffer;
  try {
    raster = await fs.readFile(pngPath);
  } catch {
    try {
      const svg = await fs.readFile(svgPath);
      assertSafeSvgText(svg);
      const BG = parseRgb(iconBackgroundHex);
      raster = await sharp(svg, { density: 400 })
        .resize(1024, 1024, {
          fit: "contain",
          position: "center",
          background: { ...BG, alpha: 1 },
        })
        .png()
        .toBuffer();
    } catch {
      throw new Error("请先上传 LOGO（SVG）。");
    }
  }

  return writeAppIconMasterFromRaster(raster, iconBackgroundHex, brandCanvasHex);
}

/** 从已保存的 SVG + 底色一键生成：顶栏 / PWA / 安装图标 / 启动屏。 */
export async function generateAllBrandAssets(
  logoBackgroundHex: string,
  brandCanvasHex: string,
): Promise<RegenerateBrandingIconsResult> {
  return syncAppIconsFromBarLogo(logoBackgroundHex, brandCanvasHex);
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
async function readAppIconMasterBuffer(dir: string, canvasHex: string): Promise<Buffer> {
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
      const svgPath = path.join(dir, "logo.svg");
      try {
        const svg = await fs.readFile(svgPath);
        assertSafeSvgText(svg);
        const BG = parseRgb(canvasHex);
        const b = await sharp(svg, { density: 400 })
          .resize(1024, 1024, {
            fit: "contain",
            position: "center",
            background: { ...BG, alpha: 1 },
          })
          .png()
          .toBuffer();
        await fs.writeFile(master, b);
        return b;
      } catch {
        throw new Error(
          "缺少 App 图标母版：请在后台上传「网站与 App 图标」，或先上传顶栏 LOGO（PNG / SVG）。",
        );
      }
    }
  }
}

export type RegenerateBrandingIconsResult = {
  /** 实际用于 PWA / 桌面图标铺底的采样色（来自母版边沿） */
  iconBackground: string;
  /** 品牌 canvas（manifest 等仍用此值） */
  brandCanvas: string;
};

/**
 * 从 `public/branding/app-icon.png` 生成 favicon / PWA / Apple 用 PNG；**不会**修改顶栏 `logo.png` / `logo.svg`。
 * 图标铺底色取自母版采样，避免比母版更浅。
 */
export async function regenerateBrandingIcons(
  canvasHex: string,
  splashBackgroundHex?: string,
  iconBackgroundOverride?: string,
): Promise<RegenerateBrandingIconsResult> {
  const brandCanvas = canvasHex.trim().toUpperCase();
  const splashBg = await resolveSplashBackgroundHex(brandCanvas, splashBackgroundHex);
  const dir = BRANDING_PUBLIC_DIR;
  const raw = await readAppIconMasterBuffer(dir, brandCanvas);
  const iconBgHex =
    iconBackgroundOverride && isValidHex6(iconBackgroundOverride)
      ? iconBackgroundOverride.trim().toUpperCase()
      : await sampleMasterIconBackgroundHex(raw, brandCanvas);

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
  const whiteMark = await monochromeWhiteMarkPng(normalized, iconBgHex);

  const [icon192, icon512, apple180, fav32] = await Promise.all([
    whiteMarkOnCanvasPng(whiteMark, 192, iconBgHex, APP_ICON_MARK_SCALE),
    whiteMarkOnCanvasPng(whiteMark, 512, iconBgHex, APP_ICON_MARK_SCALE),
    whiteMarkOnCanvasPng(whiteMark, 180, iconBgHex, APP_ICON_MARK_SCALE),
    whiteMarkOnCanvasPng(whiteMark, 32, iconBgHex, APP_ICON_MARK_SCALE),
  ]);

  await Promise.all([
    fs.writeFile(path.join(dir, "icon-192.png"), icon192),
    fs.writeFile(path.join(dir, "icon-512.png"), icon512),
    fs.writeFile(path.join(dir, "apple-touch-icon.png"), apple180),
    fs.writeFile(path.join(dir, "favicon-32.png"), fav32),
  ]);

  await regenerateMobileAppIcons(normalized, iconBgHex, splashBg, brandCanvas);
  return { iconBackground: iconBgHex, brandCanvas };
}

/**
 * 将用户上传的栅格写入 `app-icon.png`（旋转为正向 PNG），再生成全站图标包。
 */
export async function writeAppIconMasterFromRaster(
  fileBuf: Buffer,
  iconBackgroundHex: string,
  brandCanvasHex?: string,
): Promise<RegenerateBrandingIconsResult> {
  const dir = BRANDING_PUBLIC_DIR;
  await fs.mkdir(dir, { recursive: true });
  const png = await sharp(fileBuf).rotate().png().toBuffer();
  const out = path.resolve(dir, APP_ICON_MASTER);
  const rel = path.relative(dir, out);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("路径校验失败。");
  }
  await fs.writeFile(out, png);
  const brandCanvas = (brandCanvasHex ?? iconBackgroundHex).toUpperCase();
  return regenerateBrandingIcons(brandCanvas, iconBackgroundHex, iconBackgroundHex);
}
