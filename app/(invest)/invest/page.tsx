import { InvestGoogleAccessGate } from "@/components/invest/InvestGoogleAccessGate";
import { InvestDashboard } from "@/components/invest/InvestDashboard";
import { InvestSignOutButton } from "@/components/invest/InvestSignOutButton";
import { getInvestAccessState } from "@/lib/invest-access";
import { getInvestTestnetSnapshot } from "@/lib/invest/binance-testnet";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function InvestPage() {
  const access = await getInvestAccessState();

  if (access.status !== "authorized") {
    return <InvestGoogleAccessGate status={access.status} />;
  }

  const snapshot = await getInvestTestnetSnapshot();

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

        <InvestDashboard initialSnapshot={snapshot} />
      </div>
    </main>
  );
}
