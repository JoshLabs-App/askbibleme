"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { LocaleTrigger } from "@/components/i18n/LocaleTrigger";
import { AppSkinTrigger } from "@/components/theme/AppSkinTrigger";
import { SITE_METADATA_DEFAULT_TITLE } from "@/lib/site-metadata-defaults";

const ADMIN_SIDEBAR_WIDTH_KEY = "selah-admin-sidebar-width-v1";
/** 默认 ≈ 15.75rem */
const SIDEBAR_DEFAULT_PX = 252;
const SIDEBAR_MIN_PX = 152;
const SIDEBAR_MAX_CAP_PX = 1400;

function sidebarMaxPx(): number {
  if (typeof window === "undefined") return SIDEBAR_MAX_CAP_PX;
  return Math.min(SIDEBAR_MAX_CAP_PX, Math.floor(window.innerWidth * 0.96));
}

function clampSidebarWidth(w: number): number {
  const max = sidebarMaxPx();
  return Math.min(max, Math.max(SIDEBAR_MIN_PX, Math.round(w)));
}

type NavLeaf = { href: string; labelKey: string };

type NavSection =
  | { kind: "group"; id: string; labelKey: string; items: NavLeaf[] }
  | { kind: "leaf"; id: string; href: string; labelKey: string };

/** 与产品后台信息架构一致：一级分类 → 二级入口（无二级则为单层链接） */
const SECTIONS: NavSection[] = [
  {
    kind: "group",
    id: "system",
    labelKey: "admin.groups.system",
    items: [
      { href: "/admin/studio", labelKey: "admin.items.studio" },
      { href: "/admin/system/settings", labelKey: "admin.items.settings" },
      { href: "/admin/system/shell-chrome", labelKey: "admin.items.shellChrome" },
      { href: "/admin/system/media-library", labelKey: "admin.items.mediaLibrary" },
    ],
  },
  {
    kind: "group",
    id: "music",
    labelKey: "admin.groups.music",
    items: [
      { href: "/admin/music", labelKey: "admin.items.musicLibrary" },
      { href: "/admin/music/nature", labelKey: "admin.items.natureProduct" },
    ],
  },
  { kind: "leaf", id: "journey", href: "/admin/journey", labelKey: "admin.items.journey" },
  {
    kind: "group",
    id: "bible",
    labelKey: "admin.groups.bible",
    items: [
      { href: "/admin/read/versions", labelKey: "admin.items.bibleVersions" },
      { href: "/admin/read/golden-verse-themes", labelKey: "admin.items.goldenVerseThemes" },
      { href: "/admin/read/golden-verses", labelKey: "admin.items.goldenVerses" },
      { href: "/admin/read/segments", labelKey: "admin.items.readSegments" },
    ],
  },
  { kind: "leaf", id: "explore", href: "/admin/explore", labelKey: "admin.items.explore" },
];

const INITIAL_GROUP_OPEN: Record<string, boolean> = {};
for (const s of SECTIONS) {
  if (s.kind === "group") INITIAL_GROUP_OPEN[s.id] = true;
}

function leafActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  /** `/admin/music` 与 `/admin/music/nature` 为并列子页，仅精确匹配高亮曲库 */
  if (href === "/admin/music") return false;
  return pathname.startsWith(`${href}/`);
}

function groupHasActive(pathname: string, items: NavLeaf[]): boolean {
  return items.some((i) => leafActive(pathname, i.href));
}

function navLeafClass(active: boolean) {
  return [
    "block rounded-md py-1 pl-2.5 pr-2 text-[12px] font-normal tracking-[0.01em] transition-colors md:pl-3",
    active
      ? "bg-adminFg/[0.08] text-adminFg"
      : "text-adminMuted hover:bg-adminFg/[0.05] hover:text-adminFg/90",
  ].join(" ");
}

function navOverviewClass(active: boolean) {
  return [
    "block rounded-md px-2.5 py-1.5 text-[12px] font-normal tracking-[0.01em] transition-colors",
    active
      ? "bg-adminFg/[0.08] text-adminFg"
      : "text-adminMuted hover:bg-adminFg/[0.05] hover:text-adminFg/90",
  ].join(" ");
}

/**
 * 统一后台壳层：一级分类 + 二级入口分层侧栏；克制动效与对比。
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const { t } = useLocale();

  const [open, setOpen] = useState<Record<string, boolean>>(() => ({ ...INITIAL_GROUP_OPEN }));
  const [sidebarPx, setSidebarPx] = useState(SIDEBAR_DEFAULT_PX);
  const [sidebarDragging, setSidebarDragging] = useState(false);
  const sidebarPxRef = useRef(sidebarPx);
  const dragStartRef = useRef({ x: 0, w: 0 });

  sidebarPxRef.current = sidebarPx;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ADMIN_SIDEBAR_WIDTH_KEY);
      if (!raw) return;
      const n = Number.parseInt(raw, 10);
      if (Number.isFinite(n)) setSidebarPx(clampSidebarWidth(n));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const onResize = () => setSidebarPx((w) => clampSidebarWidth(w));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!sidebarDragging) return;
    const onMove = (e: PointerEvent) => {
      const { x, w } = dragStartRef.current;
      setSidebarPx(clampSidebarWidth(w + (e.clientX - x)));
    };
    const end = () => {
      setSidebarDragging(false);
      try {
        localStorage.setItem(ADMIN_SIDEBAR_WIDTH_KEY, String(sidebarPxRef.current));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [sidebarDragging]);

  useEffect(() => {
    if (!sidebarDragging) return;
    const prev = document.body.style.cursor;
    document.body.style.cursor = "col-resize";
    return () => {
      document.body.style.cursor = prev;
    };
  }, [sidebarDragging]);

  useEffect(() => {
    setOpen((prev) => {
      const next = { ...prev };
      for (const s of SECTIONS) {
        if (s.kind === "group" && groupHasActive(pathname, s.items)) next[s.id] = true;
      }
      return next;
    });
  }, [pathname]);

  const toggleGroup = useCallback((id: string) => {
    setOpen((p) => ({ ...p, [id]: !p[id] }));
  }, []);

  const onSidebarResizePointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    dragStartRef.current = { x: e.clientX, w: sidebarPxRef.current };
    setSidebarDragging(true);
  }, []);

  if (pathname === "/admin/login") {
    return (
      <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto bg-adminBg text-adminFg">
        {children}
      </div>
    );
  }

  const asideInner = (
    <>
      <div className="px-1 pb-3 md:pb-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-adminMuted">{SITE_METADATA_DEFAULT_TITLE}</p>
        <p className="mt-0.5 text-[13px] font-medium tracking-tight text-adminFg">{t("admin.title")}</p>
      </div>

      <Link href="/admin" className={`${navOverviewClass(pathname === "/admin")} mb-3 md:mb-4`}>
        {t("admin.overview")}
      </Link>

      <nav className="flex flex-col gap-4 md:gap-5" aria-label={t("admin.navLabel")}>
        {SECTIONS.map((section) => {
          if (section.kind === "leaf") {
            const active = leafActive(pathname, section.href);
            return (
              <div key={section.id}>
                <Link href={section.href} className={navOverviewClass(active)}>
                  {t(section.labelKey)}
                </Link>
              </div>
            );
          }

          const expanded = open[section.id] !== false;
          const childActive = groupHasActive(pathname, section.items);
          const groupTitle = t(section.labelKey);

          return (
            <div key={section.id} className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => toggleGroup(section.id)}
                aria-expanded={expanded}
                className={`flex w-full items-center justify-between gap-2 rounded-md px-1 py-0.5 text-left text-[11px] font-medium tracking-[0.06em] text-adminFg/75 transition hover:text-adminFg ${
                  childActive ? "text-adminFg" : ""
                }`}
              >
                <span>{groupTitle}</span>
                <span
                  className={`select-none text-[10px] font-normal text-adminMuted transition-transform duration-200 ${
                    expanded ? "rotate-0" : "-rotate-90"
                  }`}
                  aria-hidden
                >
                  ▾
                </span>
              </button>
              {expanded ? (
                <div
                  className="flex flex-col gap-0.5 border-l border-adminLine pl-2.5 md:pl-3"
                  role="group"
                  aria-label={t("admin.groupChildItems", { group: groupTitle })}
                >
                  {section.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={navLeafClass(leafActive(pathname, item.href))}
                    >
                      {t(item.labelKey)}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="mt-auto hidden flex-col gap-1 pt-8 md:flex">
        <LocaleTrigger>
          {(open) => (
            <button
              type="button"
              onClick={open}
              className="block w-full rounded-md px-2.5 py-1.5 text-left text-[11px] text-adminMuted transition-colors hover:bg-adminFg/[0.05] hover:text-adminFg/85"
            >
              {t("admin.language")}
            </button>
          )}
        </LocaleTrigger>
        <AppSkinTrigger>
          {(open) => (
            <button
              type="button"
              onClick={open}
              className="block w-full rounded-md px-2.5 py-1.5 text-left text-[11px] text-adminMuted transition-colors hover:bg-adminFg/[0.05] hover:text-adminFg/85"
            >
              {t("admin.appearance")}
            </button>
          )}
        </AppSkinTrigger>
        <button
          type="button"
          onClick={async () => {
            try {
              if (process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
                const { createSupabaseBrowserClient } = await import("@/lib/supabase/browser");
                await createSupabaseBrowserClient().auth.signOut();
              }
            } catch {
              /* ignore */
            }
            try {
              await fetch("/api/admin/auth", { method: "DELETE" });
            } catch {
              /* ignore */
            }
            window.location.href = "/";
          }}
          className="block w-full rounded-md px-2.5 py-1.5 text-left text-[11px] text-adminMuted transition-colors hover:bg-adminFg/[0.05] hover:text-adminFg/85"
        >
          {t("admin.login.signOut")}
        </button>
        <Link
          href="/"
          className="block rounded-md px-2.5 py-1.5 text-[11px] text-adminMuted transition-colors hover:bg-adminFg/[0.05] hover:text-adminFg/85"
        >
          {t("admin.backToApp")}
        </Link>
      </div>
    </>
  );

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-adminBg text-adminFg md:flex-row md:overflow-hidden">
      {/* 移动端：整宽底边分隔 */}
      <aside className="flex w-full shrink-0 flex-col border-b border-adminLine bg-adminPanel px-3 py-4 md:hidden">
        {asideInner}
      </aside>

      {/* 桌面端：可拖宽度 + 向右阴影 */}
      <div className="relative hidden min-h-0 shrink-0 self-stretch md:flex md:flex-row">
        <aside
          className="flex max-h-full min-h-0 flex-col overflow-y-auto overscroll-y-contain border-r border-adminLine/90 bg-adminPanel px-3 py-6 shadow-[4px_0_28px_-16px_rgba(15,15,15,0.07)]"
          style={{ width: sidebarPx }}
        >
          {asideInner}
        </aside>
        <button
          type="button"
          aria-label={t("admin.resizeSidebar")}
          onPointerDown={onSidebarResizePointerDown}
          className="group relative z-10 w-[10px] shrink-0 cursor-col-resize touch-none select-none self-stretch border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-adminFg/15 focus-visible:ring-offset-2 focus-visible:ring-offset-adminPanel"
        >
          <span
            className={`pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-adminLine/45 transition-colors ${
              sidebarDragging ? "bg-adminLine/95" : "group-hover:bg-adminLine/85"
            }`}
            aria-hidden
          />
        </button>
      </div>

      {/* 桌面端原先 md:overflow-hidden 会吃掉主区滚动；内层单独 overflow-y-auto，Studio 等全高页仍可用 flex-1 + min-h-0 撑满 */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-hidden bg-adminBg">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain bg-adminBg [-webkit-overflow-scrolling:touch]">
          {children}
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-adminLine px-4 py-3 md:hidden">
        <LocaleTrigger>
          {(open) => (
            <button
              type="button"
              onClick={open}
              className="text-left text-[11px] text-adminMuted hover:text-adminFg/85"
            >
              {t("admin.language")}
            </button>
          )}
        </LocaleTrigger>
        <AppSkinTrigger>
          {(open) => (
            <button
              type="button"
              onClick={open}
              className="text-left text-[11px] text-adminMuted hover:text-adminFg/85"
            >
              {t("admin.appearance")}
            </button>
          )}
        </AppSkinTrigger>
        <button
          type="button"
          onClick={async () => {
            try {
              if (process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
                const { createSupabaseBrowserClient } = await import("@/lib/supabase/browser");
                await createSupabaseBrowserClient().auth.signOut();
              }
            } catch {
              /* ignore */
            }
            try {
              await fetch("/api/admin/auth", { method: "DELETE" });
            } catch {
              /* ignore */
            }
            window.location.href = "/";
          }}
          className="text-left text-[11px] text-adminMuted hover:text-adminFg/85"
        >
          {t("admin.login.signOut")}
        </button>
        <Link href="/" className="text-[11px] text-adminMuted hover:text-adminFg/85">
          {t("admin.backToApp")}
        </Link>
      </div>
    </div>
  );
}
