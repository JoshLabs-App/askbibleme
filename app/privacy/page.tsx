import Link from "next/link";
import {
  ASKBIBLE_PRODUCT_NAME,
  ASKBIBLE_PRODUCT_URL,
} from "@/lib/askbible-product-name";

const CONTACT_EMAIL = "askbibleme@gmail.com";
const EFFECTIVE_DATE = "June 6, 2026";

type Section = { title: string; paragraphs: string[]; bullets?: string[] };

const SECTIONS_ZH: Section[] = [
  {
    title: "概述",
    paragraphs: [
      `${ASKBIBLE_PRODUCT_NAME} 是一个让人安静回到经文的入口 — 读经、灵修计划、自然场景与音乐。我们尽量只收集必要信息，不出售你的数据，也不接入第三方广告追踪。`,
    ],
  },
  {
    title: "我们可能收集的信息",
    paragraphs: ["视你的使用方式，我们可能处理："],
    bullets: [
      "可选账号：若你注册，会保存邮箱、显示名称与经哈希处理的密码。",
      "可选反馈：仅在你主动提交时，保存反馈内容、可选邮箱、页面路径与语言。",
      "可选匿名使用统计（移动端默认关闭，需你同意后开启）：页面浏览、底部标签、部分按钮点击、打开的书卷与章号（不含经文正文）、音乐播放、自然场景查看或停留时长。",
      "统计附带的技术信息：平台（网页 / iOS / Android）、App 版本与语言（若可获取）。",
      "设备本地数据：阅读偏好、离线下载、播放状态等，保存在你的设备上。",
    ],
  },
  {
    title: "我们不收集的内容",
    paragraphs: ["我们不进行跨 App 广告追踪，也不收集："],
    bullets: [
      "用于统计的经文正文、搜索词、书签或阅读笔记。",
      "精确地理位置或广告标识符。",
      "麦克风录音（iOS 权限说明为预留未来功能，当前版本不使用录音）。",
    ],
  },
  {
    title: "信息用途",
    paragraphs: [
      "账号用于登录与会话保持；反馈用于改进产品；在你同意后的匿名统计，帮助我们了解哪些功能被使用，以便保持体验安静、专注。",
      "我们不会向第三方分析或广告网络出售或共享个人数据。",
    ],
  },
  {
    title: "存储与保留",
    paragraphs: [
      "服务器端的匿名统计按日聚合，在 AskBible.me 基础设施上保留约 90 天。",
      "账号与反馈记录在运营服务或回复你需要期间保留。",
      "大部分读经与媒体内容可离线使用；已下载文件留在你的设备上，直至你删除或卸载 App。",
    ],
  },
  {
    title: "你的选择",
    paragraphs: ["你可以："],
    bullets: [
      "在 App 侧栏的隐私设置中拒绝或关闭匿名统计。",
      "不注册账号 — 核心阅读与探索无需登录即可使用。",
      "卸载 App 以清除设备上的本地数据。",
    ],
  },
  {
    title: "儿童",
    paragraphs: [
      `${ASKBIBLE_PRODUCT_NAME} 并非面向 13 岁以下儿童，我们也不会故意收集儿童的个人信息。`,
    ],
  },
  {
    title: "更新与联系",
    paragraphs: [
      "随着产品演进，我们可能更新本政策；生效日期见页首。",
      `如有疑问，请联系：${CONTACT_EMAIL}`,
    ],
  },
];

const SECTIONS_EN: Section[] = [
  {
    title: "Overview",
    paragraphs: [
      `${ASKBIBLE_PRODUCT_NAME} is a quiet entry back into Scripture — reading, devotion plans, nature scenes, and music. We keep data collection minimal and do not sell your information or use third-party ad tracking.`,
    ],
  },
  {
    title: "What we collect",
    paragraphs: ["Depending on how you use the app or site, we may process:"],
    bullets: [
      "Optional account: email address, display name, and a hashed password if you register.",
      "Optional feedback: your message, optional email, page path, and language — only when you submit feedback.",
      "Optional anonymous usage analytics (off until you opt in on mobile): screen views, tab navigation, selected buttons, Bible book/chapter opened (not verse text), music track plays, and nature scene views or session length.",
      "Technical context with analytics: platform (web, iOS, or Android), app version, and language when available.",
      "On-device data: reading preferences, offline downloads, playback state, and similar settings stored locally on your device.",
    ],
  },
  {
    title: "What we do not collect",
    paragraphs: ["We do not use your data for cross-app advertising or tracking. We do not collect:"],
    bullets: [
      "Verse text, search queries, bookmarks, or reading notes for analytics.",
      "Precise location or advertising identifiers.",
      "Microphone audio (the iOS permission string is reserved for possible future features; recording is not used today).",
    ],
  },
  {
    title: "How we use data",
    paragraphs: [
      "Account data lets you sign in across sessions. Feedback helps us fix issues and improve the product. Anonymous analytics, when enabled, helps us understand which areas are used so we can keep the experience calm and focused.",
      "We do not share personal data with third-party analytics or ad networks.",
    ],
  },
  {
    title: "Storage & retention",
    paragraphs: [
      "Server-side anonymous analytics are aggregated by day and kept for about 90 days on AskBible.me infrastructure.",
      "Account and feedback records are stored on our servers while needed to operate the service or respond to you.",
      "Most reading and media content can work offline; downloaded files remain on your device until you remove them or uninstall the app.",
    ],
  },
  {
    title: "Your choices",
    paragraphs: ["You stay in control:"],
    bullets: [
      "Mobile app: decline or later disable anonymous analytics in the privacy section of the side menu.",
      "Account registration is optional — core reading and exploration work without signing in.",
      "You can uninstall the app to remove on-device data.",
    ],
  },
  {
    title: "Children",
    paragraphs: [
      `${ASKBIBLE_PRODUCT_NAME} is not directed at children under 13. We do not knowingly collect personal information from children.`,
    ],
  },
  {
    title: "Changes & contact",
    paragraphs: [
      "We may update this policy as the product evolves. The effective date appears at the top of this page.",
      `Questions: ${CONTACT_EMAIL}`,
    ],
  },
];

function PolicySections({ sections, idPrefix }: { sections: Section[]; idPrefix: string }) {
  return (
    <div className="space-y-10">
      {sections.map((section) => (
        <section key={`${idPrefix}-${section.title}`}>
          <h2 className="font-serif text-[1.15rem] font-medium tracking-[0.02em] text-ink/88">
            {section.title}
          </h2>
          <div className="mt-3 space-y-3 text-[15px] leading-[1.75] text-ink/78">
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          {section.bullets?.length ? (
            <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-[1.75] text-ink/78 marker:text-ink/35">
              {section.bullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <div className="mx-auto w-full max-w-2xl px-5 pb-20 pt-10 md:px-8 md:pt-14">
        <header className="border-b border-ink/10 pb-8">
          <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-ink/45">
            Privacy Policy · 隐私政策
          </p>
          <h1 className="mt-3 font-serif text-[clamp(1.5rem,4.5vw,2rem)] font-medium tracking-[0.02em] text-ink/92">
            {ASKBIBLE_PRODUCT_NAME}
          </h1>
          <p className="mt-4 text-[14px] leading-relaxed text-ink/68">
            Effective {EFFECTIVE_DATE} · 生效日期：{EFFECTIVE_DATE}
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-ink/68">
            This page describes how the {ASKBIBLE_PRODUCT_URL} website and iOS / Android apps handle data.
            本页说明网站与 App 如何处理数据。
          </p>
          <nav
            aria-label="Language sections"
            className="mt-6 flex flex-wrap gap-4 text-[14px] text-ink/62"
          >
            <a
              href="#zh"
              className="underline decoration-ink/20 underline-offset-4 transition hover:text-ink/88"
            >
              中文
            </a>
            <a
              href="#en"
              className="underline decoration-ink/20 underline-offset-4 transition hover:text-ink/88"
            >
              English
            </a>
          </nav>
        </header>

        <article className="mt-10 space-y-14">
          <div id="zh" className="scroll-mt-8">
            <h2 className="font-serif text-[1.35rem] font-medium tracking-[0.02em] text-ink/90">
              隐私政策
            </h2>
            <div className="mt-8">
              <PolicySections sections={SECTIONS_ZH} idPrefix="zh" />
            </div>
          </div>

          <hr className="border-ink/10" />

          <div id="en" className="scroll-mt-8">
            <h2 className="font-serif text-[1.35rem] font-medium tracking-[0.02em] text-ink/90">
              Privacy Policy
            </h2>
            <div className="mt-8">
              <PolicySections sections={SECTIONS_EN} idPrefix="en" />
            </div>
          </div>
        </article>

        <footer className="mt-14 border-t border-ink/10 pt-8 text-[14px] leading-relaxed text-ink/62">
          <p>
            Contact · 联系：{" "}
            <a
              className="underline decoration-ink/25 underline-offset-4 transition hover:text-ink/85"
              href={`mailto:${CONTACT_EMAIL}`}
            >
              {CONTACT_EMAIL}
            </a>
          </p>
          <Link
            href="/"
            className="mt-6 inline-block underline decoration-ink/20 underline-offset-4 transition hover:text-ink/85"
          >
            Back to home · 返回首页
          </Link>
        </footer>
      </div>
    </div>
  );
}
