/**
 * 官网（`askbible.me/`）自己的文案：首屏、理念引子、各版本入口、页脚。
 *
 * 四条原则、「这会如何陪伴你」、「我们不是什么」三块**不在这里**，直接复用
 * `components/about/about-page-copy.ts`——那是已经对外的定稿，官网和「关于」页说的必须是同一套话。
 * 这里新增的句子只从 `docs/01-vision.md`、`04-ux-philosophy.md`、`05-emotional-design.md` 提炼，
 * 不另编卖点（`docs/DECISIONS.md` D-10）。繁体由 `toZhTwText` 从简体转。
 */
export type SiteHomeVersionCopy = {
  title: string;
  body: string;
  action: string;
};

export type SiteHomeCopy = {
  heroTitle: string;
  heroSub: string;
  ctaWeb: string;
  storeWebSub: string;
  /** 首屏手机模型里那张图的说明（读屏用） */
  phoneAlt: string;
  storeIosSub: string;
  storePlaySub: string;
  storeApkName: string;
  storeApkSub: string;
  /** 首屏入口下面的一行小字：安卓两个版本二选一 */
  storesAndroidNote: string;
  quote: string;
  quoteNote: string;
  beliefsHeading: string;
  beliefsIntro: string;
  versionsHeading: string;
  versionsIntro: string;
  versionWeb: SiteHomeVersionCopy;
  versionIos: SiteHomeVersionCopy;
  versionPlay: SiteHomeVersionCopy;
  versionApk: SiteHomeVersionCopy;
  footerAbout: string;
  languageLabel: string;
};

export const SITE_HOME_COPY: Record<"zh-CN" | "en", SiteHomeCopy> = {
  "zh-CN": {
    heroTitle: "安静地，回到经文。",
    heroSub: "一个让人重新进入圣经的安静入口。",
    ctaWeb: "进入网页版",
    storeWebSub: "无需安装",
    phoneAlt: "AskBible.me App 打开后的画面",
    storeIosSub: "iPhone / iPad",
    storePlaySub: "Android 商店版",
    storeApkName: "安卓下载",
    storeApkSub: "最新版",
    storesAndroidNote: "安卓的商店版和最新版二选一，不能互相覆盖安装。",
    quote: "「我进去待一下。」",
    quoteNote: "而不是「我要开始学习」。",
    beliefsHeading: "我们的理念",
    beliefsIntro:
      "很多人不是不想读经，而是怕读不完、读不懂，怕中断之后的那种失败感。AskBible.me 不堆功能，只想把进入经文的门槛放低一点。",
    versionsHeading: "选择你的版本",
    versionsIntro: "网页、iPhone、iPad、Android 都可以用。",
    versionWeb: {
      title: "网页版",
      body: "浏览器里直接打开，不用安装。",
      action: "进入网页版",
    },
    versionIos: {
      title: "iPhone / iPad",
      body: "在 App Store 下载。",
      action: "前往 App Store",
    },
    versionPlay: {
      title: "Android 商店版",
      body: "在 Google Play 下载，由商店推送更新。和最新版二选一。",
      action: "前往 Google Play",
    },
    versionApk: {
      title: "Android 最新版",
      body: "直接下载安装，新版最先到，App 里会提示更新。和商店版二选一，不能互相覆盖安装。",
      action: "下载最新版",
    },
    footerAbout: "关于",
    languageLabel: "语言",
  },
  en: {
    heroTitle: "Quietly, back to Scripture.",
    heroSub: "A quiet entry back into Scripture.",
    ctaWeb: "Open the web app",
    storeWebSub: "Nothing to install",
    phoneAlt: "The AskBible.me app when you open it",
    storeIosSub: "iPhone / iPad",
    storePlaySub: "Android · store",
    storeApkName: "Android APK",
    storeApkSub: "Latest version",
    storesAndroidNote: "On Android, pick the store version or the latest version. One can't be installed over the other.",
    quote: "“I’ll just step in for a while.”",
    quoteNote: "Not “I have to start studying.”",
    beliefsHeading: "What we believe",
    beliefsIntro:
      "Many people don’t stay away from Scripture because they don’t care. They fear not finishing, not understanding, and the sense of failure after stopping. AskBible.me doesn’t pile on features; it simply lowers the threshold to begin again.",
    versionsHeading: "Choose your version",
    versionsIntro: "Available on the web, iPhone, iPad and Android.",
    versionWeb: {
      title: "Web",
      body: "Open it in your browser. Nothing to install.",
      action: "Open the web app",
    },
    versionIos: {
      title: "iPhone / iPad",
      body: "Download on the App Store.",
      action: "Go to the App Store",
    },
    versionPlay: {
      title: "Android · store version",
      body: "Get it on Google Play; updates come through the store. Choose this or the latest version, not both.",
      action: "Go to Google Play",
    },
    versionApk: {
      title: "Android · latest version",
      body: "Download and install it directly. New releases land here first and the app tells you when to update. It can't be installed over the store version.",
      action: "Download the latest",
    },
    footerAbout: "About",
    languageLabel: "Language",
  },
};
