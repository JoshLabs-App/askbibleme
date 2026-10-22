/**
 * 官网（`askbible.me/`）自己的文案：首屏、理念引子、各版本入口、页脚。
 *
 * 四条原则、「这会如何陪伴你」、「我们不是什么」三块**不在这里**，直接复用
 * `components/about/about-page-copy.ts`——那是已经对外的定稿，官网和「关于」页说的必须是同一套话。
 * 这里新增的句子只从 `docs/01-vision.md`、`04-ux-philosophy.md`、`05-emotional-design.md` 提炼，
 * 不另编卖点（`docs/DECISIONS.md` D-10）。繁体由 `toZhTwText` 从简体转。
 *
 * 「同系列工具」三张卡（D-21）的介绍也不是新编的：听到、查到照 joshlabs.app 首页上已经对外的那两段，
 * 诗歌（TovCore）照它自己官网的说明和下载页那句「像电影评级一样，看一首诗歌的神学」。
 * 2026-10-21 小小圣经换成诗歌、听到 / 查到补 App Store（D-42，和 App 内「更多 App」同一份清单 data/sibling-apps/apps.json）。
 */
export type SiteHomeVersionCopy = {
  title: string;
  body: string;
  action: string;
};

/** 首屏切到别的软件时换上的那一套（D-22）。`entries` 的顺序和 `SiteHome` 里各软件的入口一一对应 */
export type SiteHomeAppHeroCopy = {
  /** 切换条上的名字 */
  tab: string;
  title: string;
  sub: string;
  /** 手机模型里画面的说明（读屏用） */
  phoneAlt: string;
  entries: { name: string; sub: string }[];
};

export type SiteHomeCopy = {
  /** 首屏软件切换条（读屏用的名字） */
  appsLabel: string;
  appTabAskbible: string;
  heroTingdao: SiteHomeAppHeroCopy;
  heroChadao: SiteHomeAppHeroCopy;
  heroTovcore: SiteHomeAppHeroCopy;
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
  siblingsHeading: string;
  siblingsIntro: string;
  siblingTingdao: SiteHomeVersionCopy;
  siblingChadao: SiteHomeVersionCopy;
  siblingTovcore: SiteHomeVersionCopy;
  footerAbout: string;
  languageLabel: string;
};

export const SITE_HOME_COPY: Record<"zh-CN" | "en", SiteHomeCopy> = {
  "zh-CN": {
    appsLabel: "选择软件",
    appTabAskbible: "AskBible",
    heroTingdao: {
      tab: "听到",
      title: "世界各地的讲道，用中文听。",
      sub: "世界各地的查经与主日讲道，按圣经书卷编排，可边听边读。",
      phoneAlt: "听到 App 里的画面",
      entries: [
        { name: "App Store", sub: "iPhone / iPad" },
        { name: "打开网页版", sub: "无需安装" },
        { name: "安卓下载", sub: "Android" },
      ],
    },
    heroChadao: {
      tab: "查到",
      title: "小组查经，一套做完。",
      sub: "给小组长用的归纳法查经工具：读经、备课、带组、排期。工具只做参考，理念与方法全部公开。",
      phoneAlt: "查到 App 里的画面",
      entries: [
        { name: "App Store", sub: "iPhone / iPad" },
        { name: "安卓下载", sub: "Android" },
      ],
    },
    heroTovcore: {
      tab: "诗歌",
      title: "像电影评级一样，看一首诗歌的神学。",
      sub: "TovCore 基督教歌评：逐首给诗歌的神学打分；电台只放神学分 7 分以上的诗歌，越听越懂你。",
      phoneAlt: "诗歌（TovCore）App 里的画面",
      entries: [
        { name: "打开网页版", sub: "无需安装" },
        { name: "安卓下载", sub: "Android" },
      ],
    },
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
    siblingsHeading: "同系列工具",
    siblingsIntro: "我们做的另外几样，也都围着圣经。",
    siblingTingdao: {
      title: "听到",
      body: "世界各地的查经与主日讲道，用中文听；按圣经书卷编排，可边听边读。",
      action: "打开网页版",
    },
    siblingChadao: {
      title: "查到",
      body: "给小组长用的归纳法查经工具：读经、备课、带组、排期，一套做完。工具只做参考，理念与方法全部公开。iPhone 和安卓都有。",
      action: "下载",
    },
    siblingTovcore: {
      title: "诗歌",
      body: "TovCore 基督教歌评：像电影评级一样，逐首看一首诗歌的神学；电台只放神学分 7 分以上的诗歌。",
      action: "打开网页版",
    },
    footerAbout: "关于",
    languageLabel: "语言",
  },
  en: {
    appsLabel: "Choose an app",
    appTabAskbible: "AskBible",
    heroTingdao: {
      tab: "听到",
      title: "Sermons from around the world, in Chinese.",
      sub: "Bible studies and Sunday sermons, arranged by book of the Bible, with text to read along.",
      phoneAlt: "Inside the 听到 app",
      entries: [
        { name: "App Store", sub: "iPhone & iPad" },
        { name: "Open the web app", sub: "Nothing to install" },
        { name: "Android APK", sub: "Android" },
      ],
    },
    heroChadao: {
      tab: "查到",
      title: "Group Bible study, all in one place.",
      sub: "An inductive Bible study tool for small-group leaders: read, prepare, lead and schedule. Tools are for reference only — our convictions and method are open to all.",
      phoneAlt: "Inside the 查到 app",
      entries: [
        { name: "App Store", sub: "iPhone & iPad" },
        { name: "Android APK", sub: "Android" },
      ],
    },
    heroTovcore: {
      tab: "TovCore",
      title: "Worship songs, rated for their theology.",
      sub: "Like film ratings, song by song. The radio only plays songs with a theology score of 7 or higher, and learns your taste.",
      phoneAlt: "Inside the TovCore app",
      entries: [
        { name: "Open the web app", sub: "Nothing to install" },
        { name: "Android APK", sub: "Android" },
      ],
    },
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
    siblingsHeading: "More from us",
    siblingsIntro: "A few other things we make, all around Scripture.",
    siblingTingdao: {
      title: "听到 · Sermons",
      body: "Bible studies and Sunday sermons from around the world, in Chinese. Arranged by book of the Bible, with text to read along.",
      action: "Open the web app",
    },
    siblingChadao: {
      title: "查到 · Group Bible Study",
      body: "An inductive Bible study tool for small-group leaders: read, prepare, lead and schedule in one place. Tools are for reference only; our convictions and method are open to all. On iPhone and Android.",
      action: "Download",
    },
    siblingTovcore: {
      title: "TovCore",
      body: "Worship songs rated for their theology, like film ratings. The radio only plays songs scoring 7 or higher.",
      action: "Open the web app",
    },
    footerAbout: "About",
    languageLabel: "Language",
  },
};
