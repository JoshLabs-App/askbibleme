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
  ctaVersions: string;
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
    heroSub: "一个让人重新进入圣经的安静入口。不靠压力，不靠打卡。",
    ctaWeb: "进入网页版",
    ctaVersions: "下载 App",
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
      title: "Android",
      body: "在 Google Play 下载。",
      action: "前往 Google Play",
    },
    versionApk: {
      title: "Android 安装包",
      body: "用不了 Google Play 时，直接下载安装包。",
      action: "下载安装包",
    },
    footerAbout: "关于",
    languageLabel: "语言",
  },
  en: {
    heroTitle: "Quietly, back to Scripture.",
    heroSub: "A quiet entry back into Scripture. No pressure, no streaks.",
    ctaWeb: "Open the web app",
    ctaVersions: "Get the app",
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
      title: "Android",
      body: "Get it on Google Play.",
      action: "Go to Google Play",
    },
    versionApk: {
      title: "Android APK",
      body: "No Google Play? Download the installer directly.",
      action: "Download the APK",
    },
    footerAbout: "About",
    languageLabel: "Language",
  },
};
