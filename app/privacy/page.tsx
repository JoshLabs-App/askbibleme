import Link from "next/link";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

export const metadata = {
  title: sitePageTitle("隐私政策"),
  description: "AskBible.me 隐私政策（Privacy Policy）",
};

const UPDATED_AT = "2026-05-25";

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 text-[#2E261C]">
      <h1 className="text-3xl font-semibold tracking-tight">隐私政策 / Privacy Policy</h1>
      <p className="mt-2 text-sm text-[#6E5B46]">Last updated: {UPDATED_AT}</p>

      <section className="mt-8 space-y-4 rounded-2xl border border-[#E7D7C1] bg-[#FFF8EE] p-5 text-sm leading-7">
        <h2 className="text-lg font-semibold">中文（简体）</h2>
        <p>
          AskBible.me 尊重并保护你的个人信息。本政策说明我们在你使用 AskBible.me
          网站与移动应用时，可能收集哪些信息、如何使用这些信息，以及你可以如何联系我们。
        </p>
        <h3 className="font-semibold">1. 我们可能收集的信息</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>你主动提交的信息（例如反馈内容、可选邮箱地址）。</li>
          <li>基础使用信息（例如功能使用情况、错误与性能数据，用于改进产品稳定性与体验）。</li>
          <li>设备与网络基础信息（用于安全防护、请求限流与故障排查）。</li>
        </ul>
        <h3 className="font-semibold">2. 我们如何使用这些信息</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>提供与维护产品核心功能（读经、计划、内容同步等）。</li>
          <li>响应你的反馈请求并持续改进产品体验。</li>
          <li>进行安全审计、滥用防护与服务稳定性保障。</li>
        </ul>
        <h3 className="font-semibold">3. 信息共享与披露</h3>
        <p>
          除法律法规要求、保护用户与服务安全的必要场景外，我们不会将你的个人信息出售给第三方。
        </p>
        <h3 className="font-semibold">4. 数据保存与安全</h3>
        <p>
          我们会采取合理的技术与管理措施保护数据安全，并仅在实现本政策目的所需期间保留相关信息。
        </p>
        <h3 className="font-semibold">5. 你的选择与权利</h3>
        <p>
          你可通过停止使用相关功能、提交反馈或联系我们，了解、修改或删除你主动提交的信息（在法律允许范围内）。
        </p>
        <h3 className="font-semibold">6. 联系我们</h3>
        <p>
          如有隐私相关问题，请通过{" "}
          <Link className="underline underline-offset-2" href="/feedback">
            反馈页面
          </Link>{" "}
          与我们联系，或发送邮件至{" "}
          <a className="underline underline-offset-2" href="mailto:support@askbible.me">
            support@askbible.me
          </a>
          。
        </p>
      </section>

      <section className="mt-8 space-y-4 rounded-2xl border border-[#DDE4F2] bg-[#F7FAFF] p-5 text-sm leading-7">
        <h2 className="text-lg font-semibold">English</h2>
        <p>
          AskBible.me respects your privacy. This policy explains what information we may collect, how we use it, and
          how you can contact us when using AskBible.me on web and mobile platforms.
        </p>
        <h3 className="font-semibold">1. Information We May Collect</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>Information you provide directly (such as feedback messages and optional email address).</li>
          <li>Basic usage data (for product improvement, diagnostics, and reliability).</li>
          <li>Device and network metadata for security, rate limiting, and troubleshooting.</li>
        </ul>
        <h3 className="font-semibold">2. How We Use Information</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>To provide and maintain core app features.</li>
          <li>To respond to feedback and improve user experience.</li>
          <li>To protect service security and stability.</li>
        </ul>
        <h3 className="font-semibold">3. Sharing and Disclosure</h3>
        <p>
          We do not sell personal information. We may disclose data only when required by law or necessary for service
          security and abuse prevention.
        </p>
        <h3 className="font-semibold">4. Data Retention and Security</h3>
        <p>
          We apply reasonable technical and organizational safeguards and retain data only as long as needed for the
          purposes described in this policy.
        </p>
        <h3 className="font-semibold">5. Your Choices</h3>
        <p>
          You may contact us to request access, correction, or deletion of information you submitted, subject to
          applicable laws.
        </p>
        <h3 className="font-semibold">6. Contact</h3>
        <p>
          For privacy questions, please visit{" "}
          <Link className="underline underline-offset-2" href="/feedback">
            /feedback
          </Link>{" "}
          or email{" "}
          <a className="underline underline-offset-2" href="mailto:support@askbible.me">
            support@askbible.me
          </a>
          .
        </p>
      </section>
    </main>
  );
}
