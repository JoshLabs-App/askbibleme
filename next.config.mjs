import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  /** Render 等小内存构建机：降低 webpack 峰值内存（略增编译时间） */
  experimental: {
    webpackMemoryOptimizations: true,
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

  serverExternalPackages: ["sharp", "sql.js"],

  /**
   * Vercel 等 Serverless：`readNatureSettings` 用动态路径读 `data/nature-settings.json`，
   * 自动 tracing 可能漏带，运行时回退空配置 → 首页误报「仍未配置背景影片」。
   */
  outputFileTracingIncludes: {
    "/*": ["./data/nature-settings.json"],
  },

  // 避免父目录存在其他 lockfile 时被误判为 monorepo 根
  outputFileTracingRoot: path.join(__dirname),

  /** 旧书签 `/music-visual-console` → 管理概览 */
  async redirects() {
    return [
      { source: "/music-visual-console", destination: "/admin", permanent: true },
      { source: "/joshmoney/privacy", destination: "/joshmoney/privacy/index.html", permanent: true },
      { source: "/JD", destination: "/jd/index.html", permanent: true },
      { source: "/jd", destination: "/jd/index.html", permanent: false },
    ];
  },

  /** 讲道分享链接 /jd/826 → 播放器 */
  async rewrites() {
    return [{ source: "/jd/:id(\\d+)", destination: "/jd/index.html" }];
  },

  /**
   * 旧版「编译指示」相关；黑色「N」DevTools 浮标另见
   * `scripts/write-next-devtools-config.mjs`（由 npm dev 脚本在启动前写入 `.next/cache`）。
   */
  devIndicators: false,

  /** 使用 webpack 开发时关闭缓存，减少「Cannot find module './xxx.js'」类陈旧 chunk 引用 */
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
