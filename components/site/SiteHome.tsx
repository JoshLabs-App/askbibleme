"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { ABOUT_PAGE_COPY } from "@/components/about/about-page-copy";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { SITE_HOME_COPY, type SiteHomeVersionCopy } from "@/components/site/site-home-copy";
import { SiteLogoMark } from "@/components/site/SiteLogoMark";
import { SitePhoneLiveScreen } from "@/components/site/SitePhoneLiveScreen";
import { SitePhoneLittleBible, SitePhoneSlides } from "@/components/site/SitePhoneShowcase";
import { ShellMaterialCommunityIcon } from "@/components/shell/ShellMaterialCommunityIcon";
import { APP_INSTALL_ANDROID_URL, APP_INSTALL_IOS_URL } from "@/lib/app-install-urls";
import { ASKBIBLE_PRODUCT_NAME } from "@/lib/askbible-product-name";
import type { AppLocale } from "@/lib/i18n/config";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";
import { isDisplayStandalone } from "@/lib/pwa/display-mode";
import {
  SIBLING_CHADAO_URL,
  SIBLING_LITTLE_BIBLE_URL,
  SIBLING_TINGDAO_ANDROID_URL,
  SIBLING_TINGDAO_URL,
} from "@/lib/sibling-app-urls";
import { WEB_APP_HOME_PATH } from "@/lib/web-app-home-path";
import "./site-home.css";

const LANGS: { locale: AppLocale; label: string }[] = [
  { locale: "zh-CN", label: "简体" },
  { locale: "zh-TW", label: "繁體" },
  { locale: "en", label: "EN" },
];

/** 安卓安装包走自己站上的下载页（地址印在分享图上，见 DECISIONS 2026-09-23） */
const ANDROID_APK_PAGE_PATH = "/app";

const APP_SCREEN_IMAGE_SRC = "/site/app-screen-home.webp";

/**
 * 各版本入口前面的图标（Josh 2026-10-01：「有图标的都把图标上」，DECISIONS D-16）：
 * 网页版用 AskBible 自己的图标，其余是 App 里同一套 MDI 图标字体里的苹果 / Google Play / 安卓标。
 */
type EntryIconKind = "web" | "ios" | "play" | "apk" | "youtube";

const ENTRY_MDI_ICON: Record<Exclude<EntryIconKind, "web">, string> = {
  ios: "apple",
  play: "google-play",
  apk: "android",
  youtube: "youtube",
};

/**
 * 首屏可以切换的几个软件（Josh 2026-10-01：「一开始就展示几个不同的软件……点不同的，里面的手机就切换不同的内容」，DECISIONS D-22）。
 * AskBible 是默认选中的那个，它的首屏内容还是原来那一套；另外三个各有自己的标题、入口和手机画面。
 */
type SiteAppId = "askbible" | "tingdao" | "chadao" | "littleBible";

/** 查到 2026-10-06 下架（D-37），2026-10-07 JOSHUA「在 askbible.me 首页也上架这个」放回（D-37 作废） */
const SITE_APP_ORDER: SiteAppId[] = ["askbible", "tingdao", "chadao", "littleBible"];

/** 首屏几个软件自动轮着展示，每个停这么久（Josh 2026-10-02：「首页 4 个，做成自动切换的」，DECISIONS D-25） */
const APP_AUTO_ROTATE_MS = 6500;

/** 切换条上放的是各软件的 App 图标；AskBible 用带黄底的那张（`app-icon.png` 是透明底白标，浅色底上看不见） */
const SITE_APP_ICON: Record<SiteAppId, string> = {
  askbible: "/branding/icon-512.png",
  tingdao: "/site/sibling-tingdao.png",
  chadao: "/site/sibling-chadao.png",
  littleBible: "/site/sibling-littlebible.jpg",
};

const screens = (name: string) => [1, 2, 3, 4].map((n) => `/site/${name}-screen-${n}.webp`);
const TINGDAO_SCREENS = screens("tingdao");
const CHADAO_SCREENS = screens("chadao");

type SiblingEntry = { href: string; icon: EntryIconKind | { src: string } };

/** 各软件的入口按钮，顺序和文案里的 `entries` 一一对应；第一个是深色的主入口 */
const SIBLING_ENTRIES: Record<Exclude<SiteAppId, "askbible">, SiblingEntry[]> = {
  tingdao: [
    { href: SIBLING_TINGDAO_URL, icon: { src: SITE_APP_ICON.tingdao } },
    { href: SIBLING_TINGDAO_ANDROID_URL, icon: "apk" },
  ],
  chadao: [{ href: SIBLING_CHADAO_URL, icon: "apk" }],
  littleBible: [{ href: SIBLING_LITTLE_BIBLE_URL, icon: "youtube" }],
};

function EntryIcon({ kind, size }: { kind: EntryIconKind | { src: string }; size: number }) {
  /* 网页版入口：AskBible 的标志，和旁边的苹果 / 安卓标一样是单色、跟文字色 */
  if (kind === "web") return <SiteLogoMark className="site-home__entry-icon" size={size} />;
  if (typeof kind !== "string") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img className="site-home__entry-icon site-home__entry-icon--app" src={kind.src} alt="" width={size} height={size} />
    );
  }
  return <ShellMaterialCommunityIcon className="site-home__entry-icon" name={ENTRY_MDI_ICON[kind]} size={size} />;
}

function mapStrings<T>(value: T, fn: (text: string) => string): T {
  if (typeof value === "string") return fn(value) as T;
  if (Array.isArray(value)) return value.map((item) => mapStrings(item, fn)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, mapStrings(item, fn)]),
    ) as T;
  }
  return value;
}

function VersionEntry({
  copy,
  href,
  icon,
  external = false,
}: {
  copy: SiteHomeVersionCopy;
  href: string;
  /** 自家几个版本用图标种类；同系列的别的 App 直接给它自己的图标图片 */
  icon: EntryIconKind | { src: string };
  external?: boolean;
}) {
  const inner = (
    <>
      <EntryIcon kind={icon} size={34} />
      <span className="site-home__version-text">
        <span className="site-home__version-title font-serif">{copy.title}</span>
        <span className="site-home__version-body">{copy.body}</span>
      </span>
      <span className="site-home__version-action" aria-hidden>
        {copy.action} →
      </span>
    </>
  );
  if (external) {
    return (
      <a className="site-home__version" href={href} target="_blank" rel="noopener noreferrer">
        {inner}
      </a>
    );
  }
  return (
    <Link className="site-home__version" href={href}>
      {inner}
    </Link>
  );
}

/**
 * 官网 `askbible.me/`：一句话理念 + 各版本入口（D-10）。
 * 首屏：一排可切换的软件（D-22）+ 一句话 + 入口排成一组（主入口深色，其余同样大小），Josh 2026-10-01 定。
 */
export function SiteHome() {
  const { locale, setLocale } = useLocale();
  const router = useRouter();
  const isEn = locale === "en";
  const [app, setApp] = useState<SiteAppId>("askbible");
  /** 自动轮播：自己点过切换条就不再自动换；鼠标停在首屏上、焦点在首屏里、首屏滑出视野、系统要求减少动效时先停着 */
  const [autoRotate, setAutoRotate] = useState(true);
  const [heroHeld, setHeroHeld] = useState(false);
  const [heroInView, setHeroInView] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(true);
  /** 轮到过的软件，手机画面留着不拆，下一轮直接淡入 */
  const [shown, setShown] = useState<Record<SiteAppId, boolean>>({
    askbible: true,
    tingdao: false,
    chadao: false,
    littleBible: false,
  });
  const heroRef = useRef<HTMLElement>(null);
  const rotating = autoRotate && !heroHeld && heroInView && !reducedMotion;

  const { copy, about } = useMemo(() => {
    if (isEn) return { copy: SITE_HOME_COPY.en, about: ABOUT_PAGE_COPY.en };
    const zh = { copy: SITE_HOME_COPY["zh-CN"], about: ABOUT_PAGE_COPY["zh-CN"] };
    return locale === "zh-TW" ? mapStrings(zh, toZhTwText) : zh;
  }, [isEn, locale]);

  const appTabs: Record<SiteAppId, string> = {
    askbible: copy.appTabAskbible,
    tingdao: copy.heroTingdao.tab,
    chadao: copy.heroChadao.tab,
    littleBible: copy.heroLittleBible.tab,
  };
  const sibling =
    app === "tingdao" ? copy.heroTingdao : app === "chadao" ? copy.heroChadao : app === "littleBible" ? copy.heroLittleBible : null;

  useEffect(() => {
    setShown((cur) => (cur[app] ? cur : { ...cur, [app]: true }));
  }, [app]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setHeroInView(entry.isIntersecting), { threshold: 0.35 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!rotating) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setApp((cur) => SITE_APP_ORDER[(SITE_APP_ORDER.indexOf(cur) + 1) % SITE_APP_ORDER.length]);
    }, APP_AUTO_ROTATE_MS);
    return () => window.clearInterval(id);
  }, [rotating]);

  /** 别的软件的第一张画面先悄悄取回来，点切换时不用等 */
  useEffect(() => {
    const id = window.setTimeout(() => {
      for (const src of [TINGDAO_SCREENS[0], CHADAO_SCREENS[0], "/site/littlebible-cover.webp"]) {
        new Image().src = src;
      }
    }, 2500);
    return () => window.clearTimeout(id);
  }, []);

  /** 已装到主屏的旧 PWA 仍从 `/` 启动：它要的是网页版，不是官网 */
  useEffect(() => {
    if (isDisplayStandalone()) router.replace(WEB_APP_HOME_PATH);
  }, [router]);

  /**
   * 根节点底色和浏览器顶栏色是全站按品牌画布色设的（浅羊皮）；官网深色时要跟着换，
   * 否则回弹露出的边和状态栏是浅的。离开时还原，不影响网页版。
   */
  useEffect(() => {
    const html = document.documentElement;
    const metas = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
    const prevBg = html.style.backgroundColor;
    const prevMetas = metas.map((m) => m.getAttribute("content"));
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const bg = mq.matches ? "#1a1512" : "#fbf6ec";
      html.style.backgroundColor = bg;
      metas.forEach((m) => m.setAttribute("content", bg));
    };
    apply();
    mq.addEventListener("change", apply);
    return () => {
      mq.removeEventListener("change", apply);
      html.style.backgroundColor = prevBg;
      metas.forEach((m, i) => {
        const prev = prevMetas[i];
        if (prev != null) m.setAttribute("content", prev);
      });
    };
  }, []);

  return (
    <div className={`site-home${isEn ? " site-home--en" : ""}`}>
      <div className="site-home__wrap">
        <header className="site-home__top">
          <span className="site-home__brand">
            {/* 顶栏用带黄底的 App 图标，和下面切换条里的那个一致（Josh 2026-10-02：「APP 图是金黄的，但最上面的标是黑的？」） */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={SITE_APP_ICON.askbible} alt="" width={30} height={30} />
            {ASKBIBLE_PRODUCT_NAME}
          </span>
          <div className="site-home__langs" role="group" aria-label={copy.languageLabel}>
            {LANGS.map((item) => (
              <button
                key={item.locale}
                type="button"
                className="site-home__lang"
                aria-pressed={locale === item.locale}
                onClick={() => setLocale(item.locale)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </header>

        <main>
          <section
            ref={heroRef}
            className="site-home__hero"
            onPointerEnter={(e) => {
              if (e.pointerType === "mouse") setHeroHeld(true);
            }}
            onPointerLeave={(e) => {
              if (e.pointerType === "mouse") setHeroHeld(false);
            }}
            onFocus={() => setHeroHeld(true)}
            onBlur={() => setHeroHeld(false)}
          >
            <div className="site-home__hero-text">
              <div
                className="site-home__apps"
                role="tablist"
                aria-label={copy.appsLabel}
                data-rotating={rotating ? "1" : "0"}
                style={{ "--sh-rotate-ms": `${APP_AUTO_ROTATE_MS}ms` } as CSSProperties}
              >
                {SITE_APP_ORDER.map((id) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    className="site-home__app"
                    aria-selected={app === id}
                    onClick={() => {
                      setAutoRotate(false);
                      setApp(id);
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={SITE_APP_ICON[id]} alt="" width={44} height={44} />
                    <span>{appTabs[id]}</span>
                  </button>
                ))}
              </div>
              <div className="site-home__rule" aria-hidden />
              {/* key 跟着选中的软件换：标题、介绍、入口整块重新淡入 */}
              <h1 key={`title-${app}`} className="site-home__title font-serif">
                {sibling ? sibling.title : copy.heroTitle}
              </h1>
              <p key={`sub-${app}`} className="site-home__sub">
                {sibling ? sibling.sub : copy.heroSub}
              </p>
              {sibling && app !== "askbible" ? (
                <div key={`stores-${app}`} className="site-home__stores-block">
                  <div className={`site-home__stores${sibling.entries.length === 1 ? " site-home__stores--one" : ""}`}>
                    {SIBLING_ENTRIES[app].map((entry, i) => (
                      <a
                        key={entry.href}
                        className={`site-home__store${i === 0 ? " site-home__store--primary" : ""}`}
                        href={entry.href}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <EntryIcon kind={entry.icon} size={26} />
                        <span className="site-home__store-text">
                          <span className="site-home__store-name">{sibling.entries[i]?.name}</span>
                          <span className="site-home__store-sub">{sibling.entries[i]?.sub}</span>
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              ) : (
                /*
                  Josh 2026-10-01：各版本要在首屏直接看得到；「进入网页版」和几个 App 版本
                  同一排、同样大小对齐，只用深色底标出它是主入口。
                */
                <div key="stores-askbible" className="site-home__stores-block">
                  <div className="site-home__stores">
                    <Link className="site-home__store site-home__store--primary" href={WEB_APP_HOME_PATH}>
                      <EntryIcon kind="web" size={26} />
                      <span className="site-home__store-text">
                        <span className="site-home__store-name">{copy.ctaWeb}</span>
                        <span className="site-home__store-sub">{copy.storeWebSub}</span>
                      </span>
                    </Link>
                    <a className="site-home__store" href={APP_INSTALL_IOS_URL} target="_blank" rel="noopener noreferrer">
                      <EntryIcon kind="ios" size={26} />
                      <span className="site-home__store-text">
                        <span className="site-home__store-name">App Store</span>
                        <span className="site-home__store-sub">{copy.storeIosSub}</span>
                      </span>
                    </a>
                    <a className="site-home__store" href={APP_INSTALL_ANDROID_URL} target="_blank" rel="noopener noreferrer">
                      <EntryIcon kind="play" size={26} />
                      <span className="site-home__store-text">
                        <span className="site-home__store-name">Google Play</span>
                        <span className="site-home__store-sub">{copy.storePlaySub}</span>
                      </span>
                    </a>
                    <Link className="site-home__store" href={ANDROID_APK_PAGE_PATH}>
                      <EntryIcon kind="apk" size={26} />
                      <span className="site-home__store-text">
                        <span className="site-home__store-name">{copy.storeApkName}</span>
                        <span className="site-home__store-sub">{copy.storeApkSub}</span>
                      </span>
                    </Link>
                  </div>
                  <p className="site-home__stores-note">{copy.storesAndroidNote}</p>
                </div>
              )}
            </div>
            {/*
              手机模型（Josh 2026-10-01）：AskBible 放的是真的网页版首页，不是一张图（DECISIONS D-15），
              垫底的截图是 `public/site/app-screen-home.webp`，网页版没加载出来时才看得到。
              切到别的软件时换成它的截图轮播 / 封面（D-22）。
            */}
            <div className="site-home__phone">
              {/* 几个软件的画面叠在一起，轮到谁谁淡入；AskBible 的网页版一直留着，免得每轮都重新加载 */}
              <div className="site-home__phone-stack">
                <div className="site-home__phone-layer" data-on={app === "askbible" ? "1" : "0"}>
                  <SitePhoneLiveScreen posterSrc={APP_SCREEN_IMAGE_SRC} alt={copy.phoneAlt} />
                </div>
                {shown.tingdao || app === "tingdao" ? (
                  <div className="site-home__phone-layer" data-on={app === "tingdao" ? "1" : "0"}>
                    <SitePhoneSlides
                      slides={TINGDAO_SCREENS}
                      href={SIBLING_TINGDAO_URL}
                      alt={copy.heroTingdao.phoneAlt}
                      active={app === "tingdao"}
                    />
                  </div>
                ) : null}
                {shown.chadao || app === "chadao" ? (
                  <div className="site-home__phone-layer" data-on={app === "chadao" ? "1" : "0"}>
                    <SitePhoneSlides
                      slides={CHADAO_SCREENS}
                      href={SIBLING_CHADAO_URL}
                      alt={copy.heroChadao.phoneAlt}
                      active={app === "chadao"}
                    />
                  </div>
                ) : null}
                {shown.littleBible || app === "littleBible" ? (
                  <div className="site-home__phone-layer" data-on={app === "littleBible" ? "1" : "0"}>
                    <SitePhoneLittleBible
                      href={SIBLING_LITTLE_BIBLE_URL}
                      alt={copy.heroLittleBible.phoneAlt}
                      name={copy.heroLittleBible.tab}
                      slogan={copy.heroLittleBible.title}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="site-home__quote">
            <p className="site-home__quote-main font-serif">{copy.quote}</p>
            <p className="site-home__quote-note">{copy.quoteNote}</p>
          </section>

          <section className="site-home__section" aria-labelledby="site-home-beliefs">
            <h2 id="site-home-beliefs" className="site-home__heading font-serif">
              {copy.beliefsHeading}
            </h2>
            <p className="site-home__intro">{copy.beliefsIntro}</p>
            <ol className="site-home__principles">
              {about.principles.map((item, index) => (
                <li key={item.title} className="site-home__principle">
                  <span className="site-home__num" aria-hidden>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="site-home__item-title font-serif">{item.title}</h3>
                  <p className="site-home__item-body">{item.body}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="site-home__section" aria-labelledby="site-home-companion">
            <h2 id="site-home-companion" className="site-home__heading font-serif">
              {about.highlightsHeading}
            </h2>
            <div className="site-home__highlights">
              {about.highlights.map((item) => (
                <article key={item.title}>
                  <span className="site-home__eyebrow">{item.eyebrow}</span>
                  <h3 className="site-home__item-title font-serif">{item.title}</h3>
                  <p className="site-home__item-body">{item.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="site-home__section" aria-labelledby="site-home-not">
            <h2 id="site-home-not" className="site-home__heading font-serif">
              {about.notHeading}
            </h2>
            <p className="site-home__intro">{about.notIntro}</p>
            <ul className="site-home__nots">
              {about.notItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section id="versions" className="site-home__section" aria-labelledby="site-home-versions">
            <h2 id="site-home-versions" className="site-home__heading font-serif">
              {copy.versionsHeading}
            </h2>
            <p className="site-home__intro">{copy.versionsIntro}</p>
            <div className="site-home__versions">
              <VersionEntry copy={copy.versionWeb} href={WEB_APP_HOME_PATH} icon="web" />
              <VersionEntry copy={copy.versionIos} href={APP_INSTALL_IOS_URL} icon="ios" external />
              <VersionEntry copy={copy.versionPlay} href={APP_INSTALL_ANDROID_URL} icon="play" external />
              <VersionEntry copy={copy.versionApk} href={ANDROID_APK_PAGE_PATH} icon="apk" />
            </div>
            <p className="site-home__closing">{about.closing}</p>
          </section>

          {/* 同系列工具（Josh 2026-10-01，DECISIONS D-21）：官网还是 AskBible 的，这一节只是把另外几样带一下 */}
          <section className="site-home__section" aria-labelledby="site-home-siblings">
            <h2 id="site-home-siblings" className="site-home__heading font-serif">
              {copy.siblingsHeading}
            </h2>
            <p className="site-home__intro">{copy.siblingsIntro}</p>
            <div className="site-home__versions site-home__versions--single">
              <VersionEntry copy={copy.siblingTingdao} href={SIBLING_TINGDAO_URL} icon={{ src: SITE_APP_ICON.tingdao }} external />
              <VersionEntry copy={copy.siblingChadao} href={SIBLING_CHADAO_URL} icon={{ src: "/site/sibling-chadao.png" }} external />
              <VersionEntry
                copy={copy.siblingLittleBible}
                href={SIBLING_LITTLE_BIBLE_URL}
                icon={{ src: "/site/sibling-littlebible.jpg" }}
                external
              />
            </div>
          </section>
        </main>

        <footer className="site-home__footer">
          <nav>
            <Link href="/about">{copy.footerAbout}</Link>
            <Link href="/feedback">{about.footerFeedback}</Link>
            <Link href="/privacy">{about.footerPrivacy}</Link>
          </nav>
          <span>© {ASKBIBLE_PRODUCT_NAME}</span>
        </footer>
      </div>
    </div>
  );
}
