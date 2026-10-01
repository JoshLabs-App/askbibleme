"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { ABOUT_PAGE_COPY } from "@/components/about/about-page-copy";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { SITE_HOME_COPY, type SiteHomeVersionCopy } from "@/components/site/site-home-copy";
import { SitePhoneLiveScreen } from "@/components/site/SitePhoneLiveScreen";
import { APP_INSTALL_ANDROID_URL, APP_INSTALL_IOS_URL } from "@/lib/app-install-urls";
import { ASKBIBLE_PRODUCT_NAME } from "@/lib/askbible-product-name";
import type { AppLocale } from "@/lib/i18n/config";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";
import { isDisplayStandalone } from "@/lib/pwa/display-mode";
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
  external = false,
}: {
  copy: SiteHomeVersionCopy;
  href: string;
  external?: boolean;
}) {
  const inner = (
    <>
      <span>
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
 * 首屏：一句话 + 四个版本入口排成一组（网页版是深色主入口，三个 App 下载同样大小），Josh 2026-10-01 定。
 */
export function SiteHome() {
  const { locale, setLocale } = useLocale();
  const router = useRouter();
  const isEn = locale === "en";

  const { copy, about } = useMemo(() => {
    if (isEn) return { copy: SITE_HOME_COPY.en, about: ABOUT_PAGE_COPY.en };
    const zh = { copy: SITE_HOME_COPY["zh-CN"], about: ABOUT_PAGE_COPY["zh-CN"] };
    return locale === "zh-TW" ? mapStrings(zh, toZhTwText) : zh;
  }, [isEn, locale]);

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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/branding/app-icon.png" alt="" width={30} height={30} />
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
          <section className="site-home__hero">
            <div className="site-home__hero-text">
            <div className="site-home__rule" aria-hidden />
            <h1 className="site-home__title font-serif">{copy.heroTitle}</h1>
            <p className="site-home__sub">{copy.heroSub}</p>
            {/*
              Josh 2026-10-01：各版本要在首屏直接看得到；「进入网页版」和几个 App 版本
              同一排、同样大小对齐，只用深色底标出它是主入口。
            */}
            <div className="site-home__stores-block">
              <div className="site-home__stores">
                <Link className="site-home__store site-home__store--primary" href={WEB_APP_HOME_PATH}>
                  <span className="site-home__store-name">{copy.ctaWeb}</span>
                  <span className="site-home__store-sub">{copy.storeWebSub}</span>
                </Link>
                <a
                  className="site-home__store"
                  href={APP_INSTALL_IOS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="site-home__store-name">App Store</span>
                  <span className="site-home__store-sub">{copy.storeIosSub}</span>
                </a>
                <a
                  className="site-home__store"
                  href={APP_INSTALL_ANDROID_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="site-home__store-name">Google Play</span>
                  <span className="site-home__store-sub">{copy.storePlaySub}</span>
                </a>
                <Link className="site-home__store" href={ANDROID_APK_PAGE_PATH}>
                  <span className="site-home__store-name">{copy.storeApkName}</span>
                  <span className="site-home__store-sub">{copy.storeApkSub}</span>
                </Link>
              </div>
            </div>
            </div>
            {/*
              手机模型（Josh 2026-10-01）：里面是真的网页版首页，不是一张图（DECISIONS D-15）。
              垫底的截图是 `public/site/app-screen-home.webp`，网页版没加载出来时才看得到。
            */}
            <div className="site-home__phone">
              <SitePhoneLiveScreen posterSrc={APP_SCREEN_IMAGE_SRC} alt={copy.phoneAlt} />
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
              <VersionEntry copy={copy.versionWeb} href={WEB_APP_HOME_PATH} />
              <VersionEntry copy={copy.versionIos} href={APP_INSTALL_IOS_URL} external />
              <VersionEntry copy={copy.versionPlay} href={APP_INSTALL_ANDROID_URL} external />
              <VersionEntry copy={copy.versionApk} href={ANDROID_APK_PAGE_PATH} />
            </div>
            <p className="site-home__closing">{about.closing}</p>
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
