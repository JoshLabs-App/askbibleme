"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useAskbibleUser } from "@/components/auth/AskbibleUserProvider";
import { AuthParchmentChrome } from "@/components/shell/AuthParchmentChrome";
import { AuthParchmentFallback } from "@/components/auth/AuthParchmentFallback";
import { authInputClass, authLabelClass, authLinkClass, authSubmitClass, authTitleClass } from "@/components/auth/authFormSurface";
import { approveTvPair, fetchTvDevices, revokeTvDevice, sendTvCommand } from "@/lib/tv-relay/phoneClient";
import { makeCmdId, type TvDeviceInfo } from "@/lib/tv-relay/protocol";

function TvPairInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCode = (searchParams.get("code") ?? "").replace(/[^0-9]/g, "").slice(0, 6);
  const { bootstrapped, user } = useAskbibleUser();

  const [code, setCode] = useState(initialCode);
  const [tvName, setTvName] = useState("客厅电视");
  const [devices, setDevices] = useState<TvDeviceInfo[]>([]);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDevices = useCallback(async () => {
    const list = await fetchTvDevices();
    setDevices(list);
  }, []);

  useEffect(() => {
    if (!bootstrapped) return;
    if (!user) {
      const next = initialCode ? `/tv/pair?code=${encodeURIComponent(initialCode)}` : "/tv/pair";
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    void loadDevices();
  }, [bootstrapped, user, initialCode, router, loadDevices]);

  const onApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code.trim()) || pending) return;
    setPending(true);
    setError(null);
    setNotice(null);
    const res = await approveTvPair(code.trim(), tvName.trim() || "客厅电视");
    setPending(false);
    if (!res.ok) {
      setError(res.error === "pair_expired" ? "配对码已过期，请在电视上重新生成" : "配对失败，请确认 6 位码是否正确");
      return;
    }
    setCode("");
    setNotice(`已授权绑定：${res.device?.name ?? "客厅电视"}`);
    await loadDevices();
  };

  const onControl = async (deviceId: string, action: "play" | "pause" | "next" | "sceneNext") => {
    setError(null);
    const res = await sendTvCommand({ op: "control", cmdId: makeCmdId(), deviceId, action });
    if (!res.ok) setError("电视当前不在线");
  };

  const onStop = async (deviceId: string) => {
    setError(null);
    const res = await sendTvCommand({ op: "stop", cmdId: makeCmdId(), deviceId });
    if (!res.ok) setError("电视当前不在线");
  };

  const onUnbind = async (deviceId: string) => {
    const ok = await revokeTvDevice(deviceId);
    if (ok) {
      setNotice("已解绑该电视");
      await loadDevices();
    }
  };

  if (!bootstrapped || !user) return <AuthParchmentFallback />;

  return (
    <AuthParchmentChrome>
      <div className="narrow-parchment-root w-full px-1 py-8">
        <h1 className={authTitleClass}>连接电视</h1>
        <p className="mt-2 text-center text-[14px] text-[#2b1d15]/70 dark:text-stone-50/70">
          授权一次后，手机上的音乐、读经页与读经计划可直接投到电视接续播放。
        </p>

        <form className="mt-6 flex flex-col gap-4" onSubmit={(e) => void onApprove(e)}>
          <label className="flex flex-col gap-1.5">
            <span className={authLabelClass}>电视上的 6 位配对码</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="例如 472444"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
              className={authInputClass}
              disabled={pending}
              required
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={authLabelClass}>电视名称</span>
            <input
              type="text"
              value={tvName}
              onChange={(e) => setTvName(e.target.value.slice(0, 40))}
              className={authInputClass}
              disabled={pending}
            />
          </label>
          {error ? <p className="text-center text-[13px] text-red-700/90 dark:text-red-300">{error}</p> : null}
          {notice ? <p className="text-center text-[13px] text-emerald-700 dark:text-emerald-300">{notice}</p> : null}
          <button type="submit" disabled={pending || !/^\d{6}$/.test(code)} className={authSubmitClass}>
            {pending ? "授权中…" : "授权绑定这台电视"}
          </button>
        </form>

        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">我的电视</h2>
            <button type="button" onClick={() => void loadDevices()} className={`text-[13px] ${authLinkClass}`}>
              刷新状态
            </button>
          </div>
          {devices.length === 0 ? (
            <p className="text-[13px] text-[#2b1d15]/60 dark:text-stone-50/60">还没有绑定的电视。</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {devices.map((d) => (
                <li
                  key={d.id}
                  className="rounded-xl border border-[rgba(43,29,21,0.12)] bg-[rgba(43,29,21,0.03)] p-4 dark:border-stone-50/15 dark:bg-stone-50/5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[15px] font-semibold">{d.name}</p>
                      <p className="text-[12px] text-[#2b1d15]/65 dark:text-stone-50/65">
                        {d.online ? "● 在线" : "○ 离线"}
                        {d.state?.title ? ` · ${d.state.title}` : ""}
                      </p>
                    </div>
                    <button type="button" onClick={() => void onUnbind(d.id)} className="text-[12px] text-red-700/80 underline dark:text-red-300">
                      解绑
                    </button>
                  </div>
                  {d.online ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => void onControl(d.id, "play")} className="rounded-lg border border-current/20 px-3 py-1.5 text-[12px]">
                        播放
                      </button>
                      <button type="button" onClick={() => void onControl(d.id, "pause")} className="rounded-lg border border-current/20 px-3 py-1.5 text-[12px]">
                        暂停
                      </button>
                      <button type="button" onClick={() => void onControl(d.id, "next")} className="rounded-lg border border-current/20 px-3 py-1.5 text-[12px]">
                        下一首/章
                      </button>
                      <button type="button" onClick={() => void onControl(d.id, "sceneNext")} className="rounded-lg border border-current/20 px-3 py-1.5 text-[12px]">
                        换场景
                      </button>
                      <button type="button" onClick={() => void onStop(d.id)} className="rounded-lg border border-current/20 px-3 py-1.5 text-[12px]">
                        停止
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <Link href="/web" className={`mt-8 block text-center ${authLinkClass}`}>
          返回 AskBible
        </Link>
      </div>
    </AuthParchmentChrome>
  );
}

export default function TvPairPage() {
  return (
    <Suspense fallback={<AuthParchmentFallback />}>
      <TvPairInner />
    </Suspense>
  );
}
