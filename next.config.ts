import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp"],

  // 避免父目录存在其他 lockfile 时被误判为 monorepo 根
  outputFileTracingRoot: path.join(__dirname),

  /** 旧书签 `/music-visual-console` → 后台播放视觉 */
  async redirects() {
    return [{ source: "/music-visual-console", destination: "/admin/visual", permanent: true }];
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
