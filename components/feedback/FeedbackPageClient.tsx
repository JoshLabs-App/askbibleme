"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useAskbibleUser } from "@/components/auth/AskbibleUserProvider";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { StaticParchmentPageFooter } from "@/components/shell/StaticParchmentPageFooter";
import { PARCHMENT_CONTROL_SURFACE_CLASS } from "@/lib/shell/parchment-control-surface";

type FeedbackType = "bug" | "idea" | "content" | "other";

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string }
  | { kind: "success"; id: string };

const fieldClassName = PARCHMENT_CONTROL_SURFACE_CLASS.field;

export function FeedbackPageClient() {
  const pathname = usePathname() ?? "/feedback";
  const { user } = useAskbibleUser();
  const { locale } = useLocale();
  const isZh = locale === "zh-CN";

  const [feedbackType, setFeedbackType] = useState<FeedbackType>("idea");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [state, setState] = useState<SubmitState>({ kind: "idle" });

  const supportEmail = process.env.NEXT_PUBLIC_FEEDBACK_EMAIL?.trim() || "";
  const remain = Math.max(0, 1200 - message.length);

  const typeOptions = useMemo(
    () => [
      { value: "idea", label: isZh ? "想法建议" : "Idea" },
      { value: "bug", label: isZh ? "问题反馈" : "Bug report" },
      { value: "content", label: isZh ? "经文/内容相关" : "Content issue" },
      { value: "other", label: isZh ? "其他" : "Other" },
    ] as const,
    [isZh],
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!message.trim()) {
      setState({ kind: "error", message: isZh ? "请先填写反馈内容。" : "Please write your feedback first." });
      return;
    }
    setState({ kind: "submitting" });

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: feedbackType,
          message: message.trim(),
          email: email.trim() || undefined,
          page: pathname,
          locale,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
      };
      if (!res.ok || !data.id) {
        setState({
          kind: "error",
          message: data.error || (isZh ? "提交失败，请稍后重试。" : "Could not submit. Please try again."),
        });
        return;
      }
      setState({ kind: "success", id: data.id });
      setMessage("");
      setFeedbackType("idea");
    } catch {
      setState({
        kind: "error",
        message: isZh ? "网络异常，请稍后再试。" : "Network error. Please try again.",
      });
    }
  }

  return (
    <div className="narrow-parchment-root select-text">
      <header className="text-center">
        <h1 className="font-serif text-[clamp(1.35rem,4.5vw,1.75rem)] font-medium leading-snug tracking-[0.02em] text-[#2b1d15]">
          {isZh ? "意见反馈" : "Feedback"}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-[15px] leading-[1.75] text-[rgba(43,29,21,0.76)]">
          {isZh
            ? "你可以告诉我们遇到的问题、想法或期待的方向。每条反馈都会进入同一个队列，便于持续改进。"
            : "Share bugs, ideas, or requests. Every submission goes into a single queue so we can improve steadily."}
        </p>
      </header>

      <form className="mt-8 space-y-4" onSubmit={onSubmit}>
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.12em] text-[rgba(77,53,34,0.55)]">
            {isZh ? "反馈类型" : "Feedback type"}
          </span>
          <select
            value={feedbackType}
            onChange={(e) => setFeedbackType(e.target.value as FeedbackType)}
            className={fieldClassName}
          >
            {typeOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.12em] text-[rgba(77,53,34,0.55)]">
            {isZh ? "反馈内容" : "Message"}
          </span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={1200}
            required
            rows={8}
            placeholder={
              isZh ? "例如：在读经页切换章节时，偶尔会回到顶部。" : "Example: Chapter switch sometimes jumps to top."
            }
            className={`${fieldClassName} resize-y leading-relaxed`}
          />
          <p className="mt-1 text-right text-[12px] text-[rgba(77,53,34,0.55)]">
            {isZh ? `还可输入 ${remain} 字` : `${remain} characters left`}
          </p>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.12em] text-[rgba(77,53,34,0.55)]">
            {isZh ? "邮箱（可选）" : "Email (optional)"}
          </span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={isZh ? "用于回访或补充信息" : "If you want a follow-up"}
            className={fieldClassName}
          />
        </label>

        {state.kind === "error" ? (
          <p className="rounded-lg border border-red-300/40 bg-red-500/10 px-3 py-2 text-[13px] text-red-900">
            {state.message}
          </p>
        ) : null}
        {state.kind === "success" ? (
          <p className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-900">
            {isZh ? `提交成功，反馈编号：${state.id}` : `Submitted successfully. Feedback ID: ${state.id}`}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={state.kind === "submitting"}
          className="w-full rounded-full px-4 py-3 text-[15px] font-bold tracking-[0.02em] text-[#fffdf8] transition hover:brightness-[0.98] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
          style={{ backgroundColor: "#ffb101" }}
        >
          {state.kind === "submitting"
            ? isZh
              ? "提交中..."
              : "Submitting..."
            : isZh
              ? "提交反馈"
              : "Submit feedback"}
        </button>
      </form>

      {supportEmail ? (
        <p className="mt-6 text-center text-[12px] leading-relaxed text-[rgba(77,53,34,0.55)]">
          {isZh ? "也可直接邮件联系：" : "Or email us directly:"}{" "}
          <a
            className="underline decoration-[rgba(77,53,34,0.25)] underline-offset-4"
            href={`mailto:${supportEmail}`}
          >
            {supportEmail}
          </a>
        </p>
      ) : null}

      <StaticParchmentPageFooter />
    </div>
  );
}
