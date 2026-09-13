"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { StaticParchmentPageFooter } from "@/components/shell/StaticParchmentPageFooter";
import {
  APP_INSTALL_ANDROID_APK_URL,
  APP_INSTALL_ANDROID_URL,
  APP_INSTALL_IOS_URL,
} from "@/lib/app-install-urls";
import { ASKBIBLE_PRODUCT_NAME } from "@/lib/askbible-product-name";

const LOGO_GOLD = "#ffb101";

type Platform = "ios" | "android" | "other";

type PlatformGuide = {
  id: Platform;
  eyebrow: string;
  title: string;
  intro: string;
  steps: string[];
  actionLabel: string;
  href: string;
  external?: boolean;
  secondaryLabel?: string;
  secondaryHref?: string;
};

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

function PlatformCard({ guide }: { guide: PlatformGuide }) {
  return (
    <section className="rounded-[18px] border border-[rgba(120,53,15,0.2)] bg-[rgba(255,252,245,0.92)] px-4 py-5">
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[rgba(77,53,34,0.55)]">
        {guide.eyebrow}
      </p>
      <h2 className="mt-2 font-serif text-[1.15rem] font-medium tracking-[0.02em] text-[#2b1d15]">
        {guide.title}
      </h2>
      <p className="mt-3 text-[15px] leading-[1.75] text-[rgba(43,29,21,0.76)]">{guide.intro}</p>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-[15px] leading-[1.75] text-[rgba(43,29,21,0.78)] marker:text-[rgba(77,53,34,0.35)]">
        {guide.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <a
        href={guide.href}
        {...(guide.external
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {})}
        className="mt-6 inline-flex w-full items-center justify-center rounded-full border border-[rgba(120,53,15,0.22)] bg-[rgba(255,252,245,0.88)] px-4 py-3 text-[15px] font-semibold text-[#2b1d15] transition hover:border-[rgba(120,53,15,0.32)] active:scale-[0.99]"
      >
        {guide.actionLabel}
      </a>
      {guide.secondaryLabel && guide.secondaryHref ? (
        <a
          href={guide.secondaryHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2.5 inline-flex w-full items-center justify-center rounded-full border border-[rgba(120,53,15,0.14)] bg-transparent px-4 py-3 text-[14px] font-medium text-[rgba(43,29,21,0.72)] transition hover:border-[rgba(120,53,15,0.28)] hover:text-[#2b1d15] active:scale-[0.99]"
        >
          {guide.secondaryLabel}
        </a>
      ) : null}
    </section>
  );
}

export function AppInstallGuidePage() {
  const { locale } = useLocale();
  const isZh = locale === "zh-CN";
  const [platform, setPlatform] = useState<Platform>("other");

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  const guides = useMemo((): PlatformGuide[] => {
    const ios: PlatformGuide = {
      id: "ios",
      eyebrow: isZh ? "iPhone / iPad" : "iPhone / iPad",
      title: isZh ? "从 App Store 安装" : "Install from the App Store",
      intro: isZh
        ? "AskBible.me 已在 App Store 上架。可直接下载正式版，并在 App Store 中接收更新。"
        : "AskBible.me is live on the App Store. Download the release build and receive updates there.",
      steps: isZh
        ? [
            "点击下方按钮打开 App Store 页面。",
            "点击「获取」或「下载」完成安装。",
            "安装后打开 App，即可安静回到经文。",
          ]
        : [
            "Tap the button below to open the App Store listing.",
            "Tap Get or Download to install.",
            "Open the app when installation finishes.",
          ],
      actionLabel: isZh ? "前往 App Store" : "Open App Store",
      href: APP_INSTALL_IOS_URL,
      external: true,
    };

    const android: PlatformGuide = {
      id: "android",
      eyebrow: isZh ? "Android" : "Android",
      title: isZh ? "从 Google Play 安装" : "Install from Google Play",
      intro: isZh
        ? "AskBible.me 已在 Google Play 上架。可直接下载正式版；如所在地区无法访问 Google Play，也可在下方直接下载安装包（APK）手动安装。"
        : "AskBible.me is live on Google Play. Download the release build there, or install the APK directly below if Google Play isn't available where you are.",
      steps: isZh
        ? [
            "点击下方按钮打开 Google Play 页面。",
            "点击「安装」完成下载。",
            "安装后打开 App，即可安静回到经文。",
          ]
        : [
            "Tap the button below to open the Google Play listing.",
            "Tap Install to download.",
            "Open the app when installation finishes.",
          ],
      actionLabel: isZh ? "前往 Google Play" : "Open Google Play",
      href: APP_INSTALL_ANDROID_URL,
      external: true,
      secondaryLabel: isZh ? "直接下载 APK 安装包" : "Download the APK directly",
      secondaryHref: APP_INSTALL_ANDROID_APK_URL,
    };

    if (platform === "android") return [android, ios];
    return [ios, android];
  }, [isZh, platform]);

  return (
    <div className="narrow-parchment-root select-text">
      <header className="border-b border-[rgba(120,53,15,0.12)] pb-8 text-center">
        <div
          className="mx-auto flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-[18px] border border-[rgba(120,53,15,0.14)] shadow-[0_8px_24px_-12px_rgba(15,40,60,0.14)]"
          style={{ backgroundColor: LOGO_GOLD }}
        >
          <Image
            src="/branding/app-icon.png"
            alt={ASKBIBLE_PRODUCT_NAME}
            width={72}
            height={72}
            className="h-full w-full object-cover"
            priority
          />
        </div>
        <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[rgba(77,53,34,0.62)]">
          {isZh ? "安装 App" : "Install the app"}
        </p>
        <h1 className="mt-3 text-[18px] font-semibold tracking-[0.04em] text-[#4d3522]">
          {ASKBIBLE_PRODUCT_NAME}
        </h1>
        <div className="mx-auto mt-2 h-px w-[86px]" style={{ backgroundColor: "rgba(255,177,1,0.62)" }} />
        <p className="mx-auto mt-4 max-w-md text-[15px] leading-[1.75] text-[rgba(43,29,21,0.76)]">
          {isZh
            ? "安静回到经文的入口。请选择你的设备，按步骤安装 App。"
            : "A quiet entry back into Scripture. Choose your device and follow the steps below."}
        </p>
      </header>

      <div className="mt-10 space-y-2.5">
        {guides.map((guide) => (
          <PlatformCard key={guide.id} guide={guide} />
        ))}
      </div>

      <p className="mt-8 text-center text-[14px] leading-relaxed text-[rgba(43,29,21,0.68)]">
        {isZh
          ? "如有安装或使用问题，欢迎通过反馈页告诉我们。"
          : "If you run into install or usage issues, we welcome your feedback."}
      </p>

      <div className="mt-8 flex flex-col items-stretch gap-3">
        <Link
          href="/about"
          className="inline-flex min-h-[50px] items-center justify-center rounded-full px-5 text-[15px] font-bold tracking-[0.02em] text-[#fffdf8] transition hover:brightness-[0.98] active:scale-[0.99]"
          style={{ backgroundColor: LOGO_GOLD }}
        >
          {isZh ? "了解 AskBible.me" : "About AskBible.me"}
        </Link>
      </div>

      <StaticParchmentPageFooter />
    </div>
  );
}
