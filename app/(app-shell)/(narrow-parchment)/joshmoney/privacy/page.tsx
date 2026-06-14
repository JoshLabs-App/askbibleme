import { NarrowParchmentChrome } from "@/components/shell/NarrowParchmentChrome";
import { StaticParchmentPageFooter } from "@/components/shell/StaticParchmentPageFooter";

const PRODUCT_NAME = "JoshMoney";
const CONTACT_EMAIL = "josh.zeng.ca@gmail.com";
const EFFECTIVE_DATE = "June 12, 2026";

type Section = { title: string; paragraphs: string[]; bullets?: string[] };

const SECTIONS_ZH: Section[] = [
  {
    title: "概述",
    paragraphs: [
      `${PRODUCT_NAME} 面向加拿大个体经营者的离线记账 App（记一笔、发票、里程、GST/HST 与 T2125 导出）。核心功能无需登录；记账数据默认保存在你的设备上。`,
      "我们不会出售你的数据，也不使用第三方广告或跨 App 追踪。",
    ],
  },
  {
    title: "我们可能收集的信息",
    paragraphs: ["视你的使用方式，我们可能处理："],
    bullets: [
      "设备本地数据：交易、发票、客户、营业信息、分类、收据图片、里程等，保存在设备上的本地数据库中。",
      "你主动填写的内容：姓名、营业地址、电子邮件、电话（用于发票与报税设置）。",
      "财务信息：收入、支出、税额、发票金额及 T2125/GST 相关导出数据。",
      "照片：你拍摄或从相册选择的收据、发票附件。",
      "可选账号（Apple / Google 登录）：用户 ID、电子邮件、显示名称，用于可选的云备份与多设备同步。",
      "可选云备份：若你开启，备份数据会传输至我们使用的云服务商（如 Supabase、iCloud 或 Google Drive，取决于你的选择）。",
    ],
  },
  {
    title: "我们不收集的内容",
    paragraphs: ["我们不进行广告追踪，也不收集："],
    bullets: [
      "广告标识符或用于跨 App 定向广告的数据。",
      "精确 GPS 位置（里程功能使用你输入或选择的路程，不持续追踪位置）。",
      "与记账无关的通讯录、浏览历史或第三方 App 数据。",
    ],
  },
  {
    title: "信息用途",
    paragraphs: [
      "数据用于 App 功能：记账、开发票、收据管理、报税导出与可选云备份。",
      "可选登录仅在你主动使用时，用于身份验证与同步；不用于营销或广告。",
      "我们不会向第三方广告网络出售或共享个人数据。",
    ],
  },
  {
    title: "存储与保留",
    paragraphs: [
      "未开启云备份时，数据仅存储在你的设备上，直至你删除或卸载 App。",
      "开启云备份时，相关数据会存储在你选择的云服务中，保留至你删除账号、关闭备份或删除数据。",
      "我们不会在服务器上保留超出提供服务所需的副本。",
    ],
  },
  {
    title: "你的选择",
    paragraphs: ["你可以："],
    bullets: [
      "不登录即可使用核心记账功能。",
      "在设置中关闭或断开云备份（Apple / Google / iCloud / Google Drive）。",
      "导出或删除本地数据；卸载 App 可清除设备上的本地数据。",
    ],
  },
  {
    title: "儿童",
    paragraphs: [
      `${PRODUCT_NAME} 并非面向 13 岁以下儿童，我们也不会故意收集儿童的个人信息。`,
    ],
  },
  {
    title: "删除账号与数据",
    paragraphs: [
      `若你曾使用 Apple 或 Google 登录并开启云同步，请发邮件至 ${CONTACT_EMAIL}，主题为「JoshMoney 删除账号」，并注明登录邮箱。我们会在约 30 天内删除 Supabase 中的账号资料与已同步的营业信息备份。`,
      "设备上的本地记账数据不会上传至我们的服务器；卸载 App 即可清除。iCloud / Google Drive 中的收据备份请在你选择的云服务中自行删除。",
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
      `${PRODUCT_NAME} is an offline bookkeeping app for Canadian sole proprietors — transactions, invoices, mileage, and GST/HST / T2125 exports. Core features work without signing in; data is stored on your device by default.`,
      "We do not sell your data and do not use third-party advertising or cross-app tracking.",
    ],
  },
  {
    title: "What we collect",
    paragraphs: ["Depending on how you use the app, we may process:"],
    bullets: [
      "On-device data: transactions, invoices, clients, business profile, categories, receipt images, mileage, and related records in a local database on your device.",
      "Information you enter: name, business address, email, phone (for invoices and tax settings).",
      "Financial information: income, expenses, tax amounts, invoice totals, and T2125/GST export data.",
      "Photos: receipt or invoice images you capture or pick from your photo library.",
      "Optional account (Sign in with Apple / Google): user ID, email, and display name when you choose cloud backup or sync.",
      "Optional cloud backup: if enabled, backup data is sent to cloud providers you choose (e.g. Supabase, iCloud, or Google Drive).",
    ],
  },
  {
    title: "What we do not collect",
    paragraphs: ["We do not use your data for advertising tracking. We do not collect:"],
    bullets: [
      "Advertising identifiers or data for cross-app targeted ads.",
      "Precise GPS location (mileage uses distances you enter or select; we do not continuously track location).",
      "Contacts, browsing history, or data from unrelated third-party apps.",
    ],
  },
  {
    title: "How we use data",
    paragraphs: [
      "Data is used for app functionality: bookkeeping, invoicing, receipts, tax exports, and optional cloud backup.",
      "Optional sign-in is only for authentication and sync when you enable it — not for marketing or ads.",
      "We do not sell or share personal data with third-party ad networks.",
    ],
  },
  {
    title: "Storage & retention",
    paragraphs: [
      "Without cloud backup, data stays on your device until you delete it or uninstall the app.",
      "With cloud backup enabled, data is stored with the provider you choose until you delete your account, turn off backup, or remove the data.",
      "We do not retain server copies beyond what is needed to provide the service.",
    ],
  },
  {
    title: "Your choices",
    paragraphs: ["You can:"],
    bullets: [
      "Use core bookkeeping without signing in.",
      "Disable or disconnect cloud backup in Settings (Apple / Google / iCloud / Google Drive).",
      "Export or delete local data; uninstalling removes on-device data.",
    ],
  },
  {
    title: "Children",
    paragraphs: [
      `${PRODUCT_NAME} is not directed at children under 13. We do not knowingly collect personal information from children.`,
    ],
  },
  {
    title: "Account & data deletion",
    paragraphs: [
      `If you signed in with Apple or Google and enabled cloud sync, email ${CONTACT_EMAIL} with subject line "JoshMoney account deletion" and the email on your account. We delete your Supabase profile and synced business backup within about 30 days.`,
      "Local bookkeeping data on your device is not stored on our servers; uninstall the app to remove it. Receipt backups in iCloud or Google Drive are managed in those services.",
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
          <h2 className="font-serif text-[1.15rem] font-medium tracking-[0.02em] text-[#2b1d15]">
            {section.title}
          </h2>
          <div className="mt-3 space-y-3 text-[15px] leading-[1.75] text-[rgba(43,29,21,0.78)]">
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          {section.bullets?.length ? (
            <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-[1.75] text-[rgba(43,29,21,0.78)] marker:text-[rgba(77,53,34,0.35)]">
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

export default function JoshMoneyPrivacyPage() {
  return (
    <NarrowParchmentChrome>
      <div className="narrow-parchment-root select-text">
        <header className="border-b border-[rgba(120,53,15,0.12)] pb-8 text-center">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[rgba(77,53,34,0.55)]">
            Privacy Policy · 隐私政策
          </p>
          <h1 className="mt-3 font-serif text-[clamp(1.35rem,4.5vw,1.75rem)] font-medium tracking-[0.02em] text-[#2b1d15]">
            {PRODUCT_NAME}
          </h1>
          <p className="mt-4 text-[14px] leading-relaxed text-[rgba(43,29,21,0.68)]">
            Effective {EFFECTIVE_DATE} · 生效日期：{EFFECTIVE_DATE}
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-[rgba(43,29,21,0.68)]">
            iOS &amp; Android app · 加拿大个体户离线记账
          </p>
          <nav
            aria-label="Language sections"
            className="mt-6 flex flex-wrap justify-center gap-4 text-[14px] text-[rgba(77,53,34,0.62)]"
          >
            <a
              href="#zh"
              className="underline decoration-[rgba(77,53,34,0.25)] underline-offset-4 transition hover:text-[#2b1d15]"
            >
              中文
            </a>
            <a
              href="#en"
              className="underline decoration-[rgba(77,53,34,0.25)] underline-offset-4 transition hover:text-[#2b1d15]"
            >
              English
            </a>
          </nav>
        </header>

        <article className="mt-10 space-y-14">
          <div id="zh" className="scroll-mt-8">
            <h2 className="font-serif text-[1.35rem] font-medium tracking-[0.02em] text-[#2b1d15]">
              隐私政策
            </h2>
            <div className="mt-8">
              <PolicySections sections={SECTIONS_ZH} idPrefix="zh" />
            </div>
          </div>

          <hr className="border-[rgba(120,53,15,0.12)]" />

          <div id="en" className="scroll-mt-8">
            <h2 className="font-serif text-[1.35rem] font-medium tracking-[0.02em] text-[#2b1d15]">
              Privacy Policy
            </h2>
            <div className="mt-8">
              <PolicySections sections={SECTIONS_EN} idPrefix="en" />
            </div>
          </div>
        </article>

        <p className="mt-10 text-center text-[14px] leading-relaxed text-[rgba(43,29,21,0.68)]">
          Contact · 联系：{" "}
          <a
            className="underline decoration-[rgba(77,53,34,0.25)] underline-offset-4 transition hover:text-[#2b1d15]"
            href={`mailto:${CONTACT_EMAIL}`}
          >
            {CONTACT_EMAIL}
          </a>
        </p>

        <StaticParchmentPageFooter />
      </div>
    </NarrowParchmentChrome>
  );
}
