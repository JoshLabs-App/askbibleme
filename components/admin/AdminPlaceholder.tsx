import { ADMIN_MAIN_CLASS } from "@/components/admin/admin-layout";

/** 后台占位页：统一文案与层级，后续再接真实配置 */
export function AdminPlaceholder({
  title,
  hint = "占位页面，后续接入配置与内容。",
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className={ADMIN_MAIN_CLASS}>
      <h1 className="text-[15px] font-medium tracking-tight text-adminFg">{title}</h1>
      <p className="mt-2 max-w-prose text-[12px] leading-relaxed text-adminMuted">{hint}</p>
    </div>
  );
}
