import { InvestGoogleAccessGate } from "@/components/invest/InvestGoogleAccessGate";
import { InvestSignOutButton } from "@/components/invest/InvestSignOutButton";
import { getInvestAccessState } from "@/lib/invest-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const OVERVIEW = [
  {
    label: "当前收益",
    value: "—",
    detail: "等待云端测试网数据",
    tone: "text-emerald-300",
  },
  {
    label: "最新交易",
    value: "暂无",
    detail: "主网交易保持关闭",
    tone: "text-white",
  },
  {
    label: "当前策略",
    value: "现货测试",
    detail: "不用杠杆 · 风险优先",
    tone: "text-[#f3ba2f]",
  },
  {
    label: "下次检查",
    value: "待部署",
    detail: "后台定时器尚未接入",
    tone: "text-white",
  },
] as const;

export default async function InvestPage() {
  const access = await getInvestAccessState();

  if (access.status !== "authorized") {
    return <InvestGoogleAccessGate status={access.status} />;
  }

  return (
    <main className="min-h-dvh bg-[#090b0f] px-4 py-5 text-white sm:px-7 sm:py-7 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <header className="flex flex-col gap-5 border-b border-white/8 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f3ba2f] text-lg font-black text-[#141414]">
                ₿
              </div>
              <div>
                <p className="text-[10px] font-semibold tracking-[0.2em] text-white/36">
                  PRIVATE INVESTMENT CONSOLE
                </p>
                <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.035em]">
                  投资控制台
                </h1>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-emerald-400/15 bg-emerald-400/[0.07] px-3 py-2 text-[11px] font-medium text-emerald-300">
              Google 身份已验证
            </span>
            <InvestSignOutButton />
          </div>
        </header>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {OVERVIEW.map((item) => (
            <article
              key={item.label}
              className="rounded-3xl border border-white/8 bg-white/[0.035] p-5 shadow-[0_24px_70px_-42px_rgba(0,0,0,0.9)]"
            >
              <p className="text-[11px] font-medium tracking-[0.08em] text-white/38">{item.label}</p>
              <p className={`mt-5 text-[27px] font-semibold tracking-[-0.035em] ${item.tone}`}>
                {item.value}
              </p>
              <p className="mt-2 text-[12px] text-white/36">{item.detail}</p>
            </article>
          ))}
        </section>

        <section className="mt-5 rounded-3xl border border-[#f3ba2f]/12 bg-[#f3ba2f]/[0.045] p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.16em] text-[#f3ba2f]/70">
                TESTNET SAFETY
              </p>
              <h2 className="mt-2 text-[18px] font-semibold">安全入口已经就绪</h2>
              <p className="mt-2 max-w-3xl text-[13px] leading-6 text-white/45">
                当前页面只完成私人 Google 授权与安全外壳。云端 Binance
                测试网账户、交易记录和定时策略将在下一步接入；在此之前不会执行任何订单。
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-white/8 bg-black/20 px-4 py-2 text-[11px] font-medium text-white/42">
              LIVE TRADING OFF
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}
