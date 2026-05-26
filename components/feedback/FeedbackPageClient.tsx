"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useAskbibleUser } from "@/components/auth/AskbibleUserProvider";
import { useLocale } from "@/components/i18n/LocaleProvider";

type FeedbackType = "bug" | "idea" | "content" | "other";

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string }
  | { kind: "success"; id: string };

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
    <div className="mx-auto w-full max-w-2xl flex-1 px-5 pb-24 pt-8 text-ink md:px-8">
      <header className="text-center">
        <h1 className="font-serif text-[clamp(1.35rem,4vw,1.85rem)] font-medium tracking-[0.03em] text-ink/90">
          {isZh ? "意见反馈" : "Feedback"}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-[14px] leading-relaxed text-ink/75 sm:text-[15px]">
          {isZh
            ? "你可以告诉我们遇到的问题、想法或期待的方向。每条反馈都会进入同一个队列，便于持续改进。"
            : "Share bugs, ideas, or requests. Every submission goes into a single queue so we can improve steadily."}
        </p>
      </header>

      <form className="mx-auto mt-8 max-w-xl space-y-4" onSubmit={onSubmit}>
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium uppercase tracking-wide text-ink/50">
            {isZh ? "反馈类型" : "Feedback type"}
          </span>
          <select
            value={feedbackType}
            onChange={(e) => setFeedbackType(e.target.value as FeedbackType)}
            className="w-full rounded-xl border border-ink/12 bg-canvas/70 px-3 py-2.5 text-[15px] text-ink outline-none transition focus:border-ink/30"
          >
            {typeOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium uppercase tracking-wide text-ink/50">
            {isZh ? "反馈内容" : "Message"}
          </span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={1200}
            required
            rows={8}
            placeholder={isZh ? "例如：在读经页切换章节时，偶尔会回到顶部。" : "Example: Chapter switch sometimes jumps to top."}
            className="w-full resize-y rounded-xl border border-ink/12 bg-canvas/70 px-3 py-2.5 text-[15px] leading-relaxed text-ink outline-none transition placeholder:text-ink/35 focus:border-ink/30"
          />
          <p className="mt-1 text-right text-[12px] text-ink/45">
            {isZh ? `还可输入 ${remain} 字` : `${remain} characters left`}
          </p>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium uppercase tracking-wide text-ink/50">
            {isZh ? "邮箱（可选）" : "Email (optional)"}
          </span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={isZh ? "用于回访或补充信息" : "If you want a follow-up"}
            className="w-full rounded-xl border border-ink/12 bg-canvas/70 px-3 py-2.5 text-[15px] text-ink outline-none transition placeholder:text-ink/35 focus:border-ink/30"
          />
        </label>

        {state.kind === "error" ? (
          <p className="rounded-lg border border-red-300/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-200">
            {state.message}
          </p>
        ) : null}
        {state.kind === "success" ? (
          <p className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-100">
            {isZh ? `提交成功，反馈编号：${state.id}` : `Submitted successfully. Feedback ID: ${state.id}`}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={state.kind === "submitting"}
          className="w-full rounded-xl bg-white/[0.14] px-4 py-3 text-[15px] font-medium text-ink transition hover:bg-white/[0.2] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
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
        <p className="mx-auto mt-6 max-w-xl text-center text-[12px] leading-relaxed text-ink/55">
          {isZh ? "也可直接邮件联系：" : "Or email us directly:"}{" "}
          <a className="underline decoration-ink/30 underline-offset-4" href={`mailto:${supportEmail}`}>
            {supportEmail}
          </a>
        </p>
      ) : null}
    </div>
  );
}
