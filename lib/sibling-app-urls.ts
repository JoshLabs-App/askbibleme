/**
 * 官网首屏的软件切换（DECISIONS D-22）和「同系列工具」一节（D-21）链出去的地址。
 * App 内「更多 App」用的是 data/sibling-apps/apps.json（D-42），两边改链接要一起改。都是别的项目的入口，换了域名要来这里改。
 */

/** 听到：网页版主入口（03MyClass，Cloudflare Pages；旧域 class.joshlabs.app 同时可用） */
export const SIBLING_TINGDAO_URL = "https://td.askbible.me/" as const;

/** 听到：安卓下载页 */
export const SIBLING_TINGDAO_ANDROID_URL = "https://my-class-media.joshlabs.app/download.html" as const;

/** 听到：App Store */
export const SIBLING_TINGDAO_IOS_URL = "https://apps.apple.com/app/id6812104595" as const;

/** 查到：App Store（2026-09 上架） */
export const SIBLING_CHADAO_IOS_URL = "https://apps.apple.com/app/id6815240486" as const;

/** 查到：官网 + 安卓下载页（01查经；2026-10-01 起用新域，旧地址 chadao-media.joshlabs.app/download.html 照常可用） */
export const SIBLING_CHADAO_URL = "https://cd.askbible.me/" as const;

/** 小小圣经：YouTube 频道。2026-10-21 官网不再展示（D-42 换成诗歌），地址留着 */
export const SIBLING_LITTLE_BIBLE_URL = "https://www.youtube.com/@LittleBibleEN" as const;

/** 诗歌（TovCore，01TovCore）：网页版；iOS 过审后在这里加 App Store 并补进 SiteHome 的入口 */
export const SIBLING_TOVCORE_URL = "https://tovcore.com/" as const;

/** 诗歌：安卓下载页 */
export const SIBLING_TOVCORE_ANDROID_URL = "https://tovcore.com/install/" as const;
