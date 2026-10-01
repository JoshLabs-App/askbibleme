import type { Metadata } from "next";
import { SiteHome } from "@/components/site/SiteHome";
import { ASKBIBLE_PRODUCT_NAME, ASKBIBLE_PRODUCT_URL } from "@/lib/askbible-product-name";
import { WEB_APP_HOME_PATH } from "@/lib/web-app-home-path";

/**
 * 官网：`askbible.me/`。
 *
 * 2026-10-01 之前根路径直接就是网页版首页；Josh 定为先进官网，点「网页版」才进（`docs/DECISIONS.md` D-10）。
 * 网页版首页在 `/web`（`app/(app-shell)/web/page.tsx`），其余路由没动。
 * 这一页不进 `(app-shell)`：不要底栏、播放条那套壳。
 */
const TITLE = `${ASKBIBLE_PRODUCT_NAME} · 安静地，回到经文`;
const DESCRIPTION =
  "一个让人重新进入圣经的安静入口。网页、iPhone、iPad、Android 都可以用。";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: `${ASKBIBLE_PRODUCT_URL}/` },
  openGraph: {
    type: "website",
    url: `${ASKBIBLE_PRODUCT_URL}/`,
    siteName: ASKBIBLE_PRODUCT_NAME,
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: `${ASKBIBLE_PRODUCT_URL}/branding/icon-512.png`, width: 512, height: 512 }],
  },
};

/**
 * 已装到主屏的 PWA（旧的 `start_url` 是 `/`，iOS 主屏图标永远不会更新）要的是网页版。
 * 放在正文之前、解析到就跳，免得先闪一下官网；客户端路由进来的情况由 `SiteHome` 里的 effect 兜。
 */
const STANDALONE_TO_WEB_APP_SCRIPT = `
(function () {
  try {
    var m = window.matchMedia;
    var standalone =
      (m && (m("(display-mode: standalone)").matches || m("(display-mode: fullscreen)").matches)) ||
      window.navigator.standalone === true;
    if (standalone) window.location.replace(${JSON.stringify(WEB_APP_HOME_PATH)});
  } catch (e) {}
})();
`.trim();

export default function SiteHomePage() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: STANDALONE_TO_WEB_APP_SCRIPT }} />
      <SiteHome />
    </>
  );
}
