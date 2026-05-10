import type { MetadataRoute } from "next";

/** PWA：安装到主屏幕后以 fullscreen 显示（尽量占满可用显示区域）。图标可在 `public/` 补充后再写入 icons。 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Selah.my",
    short_name: "Selah.my",
    description: "安静回到经文的入口 — 正在成型。",
    start_url: "/",
    display: "fullscreen",
    background_color: "#F4EBD9",
    theme_color: "#F4EBD9",
  };
}
