import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

type Props = {
  status: "misconfigured" | "unauthenticated" | "forbidden";
};

const COPY = {
  misconfigured: {
    eyebrow: "PRIVATE ACCESS",
    title: "投资入口尚未完成配置",
    description: "Google 登录或允许账户尚未配置。当前不会显示账户、策略或交易数据。",
  },
  unauthenticated: {
    eyebrow: "PRIVATE ACCESS",
    title: "使用 Google 账户验证",
    description: "这是私人投资控制台。验证通过后才能查看和操作测试网账户。",
  },
  forbidden: {
    eyebrow: "ACCESS DENIED",
    title: "这个 Google 账户没有权限",
    description: "请切换到已获准的 Google 账户。当前账户无法读取任何投资数据。",
  },
} as const;

export function InvestGoogleAccessGate({ status }: Props) {
  const copy = COPY[status];

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#090b0f] px-5 py-12 text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        aria-hidden
        style={{
          background:
            "radial-gradient(circle at 20% 0%, rgba(243,186,47,0.16), transparent 34%), radial-gradient(circle at 90% 90%, rgba(52,211,153,0.08), transparent 32%)",
        }}
      />
      <section className="relative w-full max-w-md rounded-[28px] border border-white/10 bg-white/[0.055] p-7 shadow-[0_28px_100px_-40px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:p-9">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f3ba2f] text-xl font-black text-[#141414]">
            ₿
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold tracking-[0.18em] text-white/50">
            TESTNET
          </span>
        </div>

        <p className="text-[11px] font-semibold tracking-[0.2em] text-[#f3ba2f]/85">
          {copy.eyebrow}
        </p>
        <h1 className="mt-3 text-[28px] font-semibold tracking-[-0.035em] text-white">
          {copy.title}
        </h1>
        <p className="mt-4 text-[14px] leading-7 text-white/58">{copy.description}</p>

        {status === "misconfigured" ? (
          <div className="mt-8 rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] px-4 py-3 text-[12px] leading-6 text-amber-100/70">
            为保护账户，配置缺失时系统默认拒绝所有访问。
          </div>
        ) : (
          <GoogleSignInButton
            nextPath="/invest"
            className="mt-8 [&_button]:border-white/10 [&_button]:bg-white [&_button]:text-[#171717]"
          />
        )}

        <div className="mt-8 flex items-center gap-2 text-[11px] text-white/34">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" aria-hidden />
          <span>服务器验证 · 账户白名单 · 不向搜索引擎公开</span>
        </div>
      </section>
    </main>
  );
}
