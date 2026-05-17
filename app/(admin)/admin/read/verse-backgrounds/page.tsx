import Link from "next/link";
import { AdminGoldenVerseBackgroundsClient } from "@/components/admin/AdminGoldenVerseBackgroundsClient";
import { ADMIN_MAIN_CLASS } from "@/components/admin/admin-layout";

export const metadata = { title: "金句页背景" };

export default function AdminVerseBackgroundsPage() {
  return (
    <div className={ADMIN_MAIN_CLASS}>
      <h1 className="text-lg font-medium tracking-tight text-adminFg">金句页背景</h1>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-adminMuted">
        管理前台 <Link href="/verse" className="underline underline-offset-2">/verse</Link>{" "}
        可选底图：上传后写入{" "}
        <span className="font-mono text-[11px]">public/golden-verses/bg-uploads/</span> 与{" "}
        <span className="font-mono text-[11px]">data/golden-verses-settings.json</span>
        。用户可在金句页右上「页模板」切换；内置羊皮卷模板不受此处影响。
      </p>
      <AdminGoldenVerseBackgroundsClient />
    </div>
  );
}
