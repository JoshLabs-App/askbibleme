"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  APP_INSTALL_ANDROID_URL,
  APP_INSTALL_IOS_URL,
} from "@/lib/app-install-urls";
import { ASKBIBLE_PRODUCT_NAME } from "@/lib/askbible-product-name";

type Platform = "ios" | "android" | "other";

type PlatformGuide = {
  id: Platform;
  eyebrow: string;
  title: string;
  intro: string;
  steps: string[];
  actionLabel: string;
  href: string;
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
    <section className="rounded-2xl border border-ink/10 bg-canvas/60 px-5 py-6 md:px-6">
      <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-ink/45">
        {guide.eyebrow}
      </p>
      <h2 className="mt-2 font-serif text-[1.2rem] font-medium tracking-[0.02em] text-ink/90">
        {guide.title}
      </h2>
      <p className="mt-3 text-[15px] leading-[1.75] text-ink/75">{guide.intro}</p>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-[15px] leading-[1.75] text-ink/78 marker:text-ink/35">
        {guide.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <a
        href={guide.href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-ink/[0.08] px-4 py-3 text-[15px] font-medium text-ink transition hover:bg-ink/[0.12] active:scale-[0.99] sm:w-auto sm:min-w-[15rem]"
      >
        {guide.actionLabel}
      </a>
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
      title: isZh ? "通过 TestFlight 安装" : "Install with TestFlight",
      intro: isZh
        ? "这是 Apple 官方测试渠道。接受邀请后，可在 TestFlight 中安装与更新 AskBible.me 测试版。"
        : "Apple's official beta channel. After accepting the invite, install and update the AskBible.me beta in TestFlight.",
      steps: isZh
        ? [
            "点击下方按钮打开 TestFlight 邀请链接。",
            "若尚未安装 TestFlight，请先从 App Store 安装 TestFlight。",
            "在 TestFlight 中接受邀请，然后安装 AskBible.me。",
          ]
        : [
            "Tap the button below to open the TestFlight invite.",
            "Install TestFlight from the App Store first if you do not have it.",
            "Accept the invite in TestFlight, then install AskBible.me.",
          ],
      actionLabel: isZh ? "加入 TestFlight 测试" : "Join TestFlight beta",
      href: APP_INSTALL_IOS_URL,
    };

    const android: PlatformGuide = {
      id: "android",
      eyebrow: isZh ? "Android" : "Android",
      title: isZh ? "通过 Google Play 测试安装" : "Install via Google Play testing",
      intro: isZh
        ? "这是 Google Play 内部测试渠道。需使用受邀 Google 账号登录并接受测试后，才能从 Play 商店安装。"
        : "Google Play closed testing. Sign in with your invited Google account and opt in before installing from the Play Store.",
      steps: isZh
        ? [
            "点击下方按钮打开 Play 测试邀请页。",
            "使用受邀 Google 账号登录，并点击成为测试员。",
            "在 Play 商店搜索 AskBible.me 并完成安装。",
          ]
        : [
            "Tap the button below to open the Play testing invite.",
            "Sign in with your invited Google account and become a tester.",
            "Find AskBible.me in the Play Store and install it.",
          ],
      actionLabel: isZh ? "加入 Android 测试" : "Join Android beta",
      href: APP_INSTALL_ANDROID_URL,
    };

    if (platform === "android") return [android, ios];
    return [ios, android];
  }, [isZh, platform]);

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <div className="mx-auto w-full max-w-2xl px-5 pb-20 pt-10 md:px-8 md:pt-14">
        <header className="border-b border-ink/10 pb-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-[18px] border border-ink/10 bg-canvas shadow-[0_8px_24px_-12px_rgba(15,40,60,0.18)]">
            <Image
              src="/branding/app-icon.png"
              alt={ASKBIBLE_PRODUCT_NAME}
              width={64}
              height={64}
              className="h-full w-full object-cover"
              priority
            />
          </div>
          <p className="mt-5 text-[12px] font-medium uppercase tracking-[0.14em] text-ink/45">
            {isZh ? "测试版邀请" : "Beta invite"}
          </p>
          <h1 className="mt-3 font-serif text-[clamp(1.5rem,4.5vw,2rem)] font-medium tracking-[0.02em] text-ink/92">
            {ASKBIBLE_PRODUCT_NAME}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-ink/72">
            {isZh
              ? "安静回到经文的入口。请选择你的设备，按步骤加入测试并安装 App。"
              : "A quiet entry back into Scripture. Choose your device and follow the steps to join the beta."}
          </p>
        </header>

        <div className="mt-10 space-y-5">
          {guides.map((guide) => (
            <PlatformCard key={guide.id} guide={guide} />
          ))}
        </div>

        <p className="mt-8 text-center text-[14px] leading-relaxed text-ink/58">
          {isZh
            ? "测试版可能仍有未完成之处；欢迎通过反馈页告诉我们你的体验。"
            : "The beta may still be rough in places — we welcome your feedback."}
        </p>

        <footer className="mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-ink/10 pt-8 text-[14px] text-ink/62">
          <Link
            href="/feedback"
            className="underline decoration-ink/20 underline-offset-4 transition hover:text-ink/85"
          >
            {isZh ? "意见反馈" : "Feedback"}
          </Link>
          <Link
            href="/privacy"
            className="underline decoration-ink/20 underline-offset-4 transition hover:text-ink/85"
          >
            {isZh ? "隐私政策" : "Privacy"}
          </Link>
          <Link
            href="/"
            className="underline decoration-ink/20 underline-offset-4 transition hover:text-ink/85"
          >
            {isZh ? "继续使用网页版" : "Continue on web"}
          </Link>
        </footer>
      </div>
    </div>
  );
}
