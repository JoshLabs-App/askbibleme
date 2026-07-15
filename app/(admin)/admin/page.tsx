"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { ADMIN_MAIN_CLASS } from "@/components/admin/admin-layout";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";

type LocaleText = {
  zh: string;
  en: string;
};

type OverviewItem = {
  href: string;
  label: LocaleText;
  hint: LocaleText;
};

type OverviewBlock = {
  title: LocaleText;
  items: OverviewItem[];
};

function resolveLocaleText(locale: "en" | "zh-CN" | "zh-TW", text: LocaleText): string {
  if (locale === "en") return text.en;
  return locale === "zh-TW" ? toZhTwText(text.zh) : text.zh;
}

const OVERVIEW_BLOCKS: OverviewBlock[] = [
  {
    title: { zh: "系统", en: "System" },
    items: [
      {
        href: "/admin/studio",
        label: { zh: "studio", en: "Studio" },
        hint: { zh: "产品文档与本地讨论", en: "Product notes and local discussion" },
      },
      {
        href: "/admin/system/settings",
        label: { zh: "全局设置", en: "Global settings" },
        hint: {
          zh: "顶栏 LOGO 与网站 / App 图标（分开上传）",
          en: "Separate uploads for the top-bar logo, website icon, and app icon",
        },
      },
      {
        href: "/admin/system/ai-api",
        label: { zh: "API 密钥", en: "API keys" },
        hint: {
          zh: "按网关 URL 或 Studio 连接自动注入 Bearer",
          en: "Auto-inject Bearer tokens by gateway URL or Studio connection",
        },
      },
      {
        href: "/admin/system/content-flags",
        label: { zh: "内容开关", en: "Content toggles" },
        hint: {
          zh: "移动端会员注册与远程内容 manifest 的可视化开关",
          en: "Visual toggles for mobile member sign-up and remote content manifests",
        },
      },
      {
        href: "/admin/system/generation-roles",
        label: { zh: "生成角色", en: "Generation roles" },
        hint: {
          zh: "管理 V1 信息版等生成任务的 system 角色与默认项",
          en: "Manage system roles and defaults for V1 info-edition generation jobs",
        },
      },
      {
        href: "/admin/system/media-library",
        label: { zh: "上传资源库", en: "Upload library" },
        hint: {
          zh: "扫描 public 下已上传的音视频与文档，预览并批量删除试验文件",
          en: "Scan uploaded audio, video, and documents in public, preview them, and bulk delete test files",
        },
      },
      {
        href: "/admin/system/usage",
        label: { zh: "使用概览", en: "Usage overview" },
        hint: {
          zh: "匿名设备 DAU、页面/点击/自然场景统计（与信息版同盘）",
          en: "Anonymous device DAU plus page, click, and nature-scene stats",
        },
      },
    ],
  },
  {
    title: { zh: "音乐", en: "Music" },
    items: [
      {
        href: "/admin/music",
        label: { zh: "曲库与配图", en: "Music library and artwork" },
        hint: {
          zh: "上传音频与背景图，写入 companion",
          en: "Upload audio and background art for the companion layer",
        },
      },
      {
        href: "/admin/music/nature",
        label: { zh: "自然", en: "Nature" },
        hint: {
          zh: "全屏自然影片、专辑式预览与前台对照",
          en: "Fullscreen nature videos, album-style previews, and app-side comparison",
        },
      },
    ],
  },
  {
    title: { zh: "旅程", en: "Journey" },
    items: [
      {
        href: "/admin/journey",
        label: { zh: "旅程", en: "Journey" },
        hint: { zh: "旅程配置（占位）", en: "Journey settings placeholder" },
      },
    ],
  },
  {
    title: { zh: "圣经", en: "Bible" },
    items: [
      {
        href: "/admin/read/versions",
        label: { zh: "译本与上传", en: "Translations and uploads" },
        hint: { zh: "上传 selah-bible-v1 JSON、设默认译本", en: "Upload selah-bible-v1 JSON and set the default translation" },
      },
      {
        href: "/admin/read/golden-verse-themes",
        label: { zh: "金句主题", en: "Verse themes" },
        hint: {
          zh: "BIBLE 主题标签墙（本地 SQLite，需先 import）",
          en: "Bible theme tag wall backed by local SQLite; import first",
        },
      },
      {
        href: "/admin/read/verse-repeat-rank",
        label: { zh: "经节重复排行", en: "Verse repeat rank" },
        hint: {
          zh: "主题库 12,585 去重节按收录次数排序（需先 import）",
          en: "12,585 deduplicated verses sorted by inclusion count; import first",
        },
      },
      {
        href: "/admin/read/golden-verses",
        label: { zh: "金句", en: "Golden verses" },
        hint: {
          zh: "首页轮播与主题分类经节（只读总览）",
          en: "Read-only overview of homepage carousel and categorized verses",
        },
      },
      {
        href: "/admin/read/verse-backgrounds",
        label: { zh: "金句页背景", en: "Verse page backgrounds" },
        hint: {
          zh: "上传 / 删除 /verse 页可选底图",
          en: "Upload or delete optional backgrounds for /verse pages",
        },
      },
      {
        href: "/admin/read/segments",
        label: { zh: "圣经分段", en: "Bible segments" },
        hint: { zh: "分段与结构（占位）", en: "Segmentation and structure placeholder" },
      },
      {
        href: "/admin/read/info-edition-v1",
        label: { zh: "内容生成系统", en: "Content generation" },
        hint: {
          zh: "按书卷章 + 描述规则，多连接 AI 对比生成",
          en: "Generate by passage and prompt rules with side-by-side AI comparison",
        },
      },
      {
        href: "/admin/read/info-edition-v4",
        label: { zh: "V4 经文汇编", en: "V4 scripture compilation" },
        hint: {
          zh: "按主题从经文汇编；格式与规则在「生成角色」V4 三项",
          en: "Theme-based scripture compilation; format and rules live in the V4 generation-role entries",
        },
      },
    ],
  },
  {
    title: { zh: "探索", en: "Explore" },
    items: [
      {
        href: "/admin/explore",
        label: { zh: "探索", en: "Explore" },
        hint: { zh: "探索模块（占位）", en: "Explore module placeholder" },
      },
    ],
  },
];

export default function AdminHomePage() {
  const { locale } = useLocale();

  return (
    <div className={ADMIN_MAIN_CLASS}>
      <h1 className="text-[15px] font-medium tracking-tight text-adminFg">
        {resolveLocaleText(locale, { zh: "概览", en: "Overview" })}
      </h1>
      <p className="mt-2 max-w-prose text-[12px] leading-relaxed text-adminMuted">
        {resolveLocaleText(locale, {
          zh: "下列入口与侧栏一致；无卡片，便于桌面快速扫读。宽屏下右侧为常驻「手机预览」；窄屏下在页面底部查看。",
          en: "These entry points mirror the sidebar. The cards stay minimal for quick desktop scanning. On wide screens, a fixed phone preview sits on the right; on narrow screens, it moves to the bottom.",
        })}
      </p>

      <div className="mt-10 max-w-3xl space-y-10">
        {OVERVIEW_BLOCKS.map((block) => (
          <section key={block.title.zh}>
            <h2 className="border-b border-adminLine pb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-adminMuted">
              {resolveLocaleText(locale, block.title)}
            </h2>
            <ul className="mt-0 divide-y divide-adminLine border-b border-adminLine">
              {block.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex flex-col gap-0.5 py-3 text-left transition hover:bg-adminFg/[0.04] sm:flex-row sm:items-baseline sm:gap-6 sm:py-2.5"
                  >
                    <span className="w-36 shrink-0 text-[13px] font-medium text-adminFg">
                      {resolveLocaleText(locale, item.label)}
                    </span>
                    <span className="min-w-0 flex-1 text-[12px] leading-snug text-adminMuted">
                      {resolveLocaleText(locale, item.hint)}
                    </span>
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
