import Link from "next/link";
import { ADMIN_MAIN_CLASS } from "@/components/admin/admin-layout";

const overview: {
  title: string;
  items: { href: string; label: string; hint: string }[];
}[] = [
  {
    title: "系统",
    items: [
      { href: "/admin/studio", label: "studio", hint: "产品文档与本地讨论" },
      { href: "/admin/system/settings", label: "全局设置", hint: "顶栏 LOGO 与网站 / App 图标（分开上传）" },
      {
        href: "/admin/system/ai-api",
        label: "API 密钥",
        hint: "按网关 URL 或 Studio 连接自动注入 Bearer",
      },
      {
        href: "/admin/system/content-flags",
        label: "内容开关",
        hint: "移动端会员注册与远程内容 manifest 的可视化开关",
      },
      {
        href: "/admin/system/generation-roles",
        label: "生成角色",
        hint: "管理 V1 信息版等生成任务的 system 角色与默认项",
      },
      { href: "/admin/system/media-library", label: "上传资源库", hint: "扫描 public 下已上传的音视频与文档，预览并批量删除试验文件" },
      {
        href: "/admin/system/usage",
        label: "使用概览",
        hint: "匿名设备 DAU、页面/点击/自然场景统计（与信息版同盘）",
      },
    ],
  },
  {
    title: "音乐",
    items: [
      { href: "/admin/music", label: "曲库与配图", hint: "上传音频与背景图，写入 companion" },
      { href: "/admin/music/nature", label: "自然", hint: "全屏自然影片、专辑式预览与前台对照" },
    ],
  },
  {
    title: "旅程",
    items: [{ href: "/admin/journey", label: "旅程", hint: "旅程配置（占位）" }],
  },
  {
    title: "圣经",
    items: [
      { href: "/admin/read/versions", label: "译本与上传", hint: "上传 selah-bible-v1 JSON、设默认译本" },
      { href: "/admin/read/golden-verse-themes", label: "金句主题", hint: "BIBLE 主题标签墙（本地 SQLite，需先 import）" },
      {
        href: "/admin/read/verse-repeat-rank",
        label: "经节重复排行",
        hint: "主题库 12,585 去重节按收录次数排序（需先 import）",
      },
      { href: "/admin/read/golden-verses", label: "金句", hint: "首页轮播与主题分类经节（只读总览）" },
      {
        href: "/admin/read/verse-backgrounds",
        label: "金句页背景",
        hint: "上传 / 删除 /verse 页可选底图",
      },
      { href: "/admin/read/segments", label: "圣经分段", hint: "分段与结构（占位）" },
      {
        href: "/admin/read/info-edition-v1",
        label: "内容生成系统",
        hint: "按书卷章 + 描述规则，多连接 AI 对比生成",
      },
      {
        href: "/admin/read/info-edition-v4",
        label: "V4 经文汇编",
        hint: "按主题从经文汇编；格式与规则在「生成角色」V4 三项",
      },
    ],
  },
  {
    title: "探索",
    items: [{ href: "/admin/explore", label: "探索", hint: "探索模块（占位）" }],
  },
];

export default function AdminHomePage() {
  return (
    <div className={ADMIN_MAIN_CLASS}>
      <h1 className="text-[15px] font-medium tracking-tight text-adminFg">概览</h1>
      <p className="mt-2 max-w-prose text-[12px] leading-relaxed text-adminMuted">
        下列入口与侧栏一致；无卡片，便于桌面快速扫读。宽屏下右侧为常驻「手机预览」；窄屏下在页面底部查看。
      </p>

      <div className="mt-10 max-w-3xl space-y-10">
        {overview.map((block) => (
          <section key={block.title}>
            <h2 className="border-b border-adminLine pb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-adminMuted">
              {block.title}
            </h2>
            <ul className="mt-0 divide-y divide-adminLine border-b border-adminLine">
              {block.items.map((m) => (
                <li key={m.href}>
                  <Link
                    href={m.href}
                    className="flex flex-col gap-0.5 py-3 text-left transition hover:bg-adminFg/[0.04] sm:flex-row sm:items-baseline sm:gap-6 sm:py-2.5"
                  >
                    <span className="w-36 shrink-0 text-[13px] font-medium text-adminFg">{m.label}</span>
                    <span className="min-w-0 flex-1 text-[12px] leading-snug text-adminMuted">{m.hint}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
