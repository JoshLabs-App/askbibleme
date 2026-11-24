"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useAskbibleUser } from "@/components/auth/AskbibleUserProvider";
import { useLocale } from "@/components/i18n/LocaleProvider";
import "./askbible-code-probe.css";

export type CodeProbeTier = "admin" | "muted";

export interface ProbeSnapshot {
  componentName: string;
  title: string;
  lines: string[];
  copyText: string;
  box?: { left: number; top: number; width: number; height: number };
}

function cleanText(raw: string | null | undefined, max = 26): string {
  const s = (raw ?? "").replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

type FiberFunctionType = ((...args: unknown[]) => unknown) & {
  displayName?: string;
  name?: string;
};

function inspectReactFiberFallback(el: Element | null): { comp: string; src: string } {
  if (!el) return { comp: "", src: "" };
  const record = el as unknown as Record<string, unknown>;
  const fiberKey = Object.keys(record).find((k) => k.startsWith("__reactFiber$"));
  if (!fiberKey) return { comp: "", src: "" };
  let fiber = record[fiberKey] as {
    return?: unknown;
    type?: FiberFunctionType | string | object;
    _debugSource?: { fileName?: string; lineNumber?: number };
  } | null;
  let comp = "";
  let src = "";
  let guard = 0;
  while (fiber && guard < 24) {
    guard += 1;
    if (!src && fiber._debugSource?.fileName && fiber._debugSource?.lineNumber) {
      const normalized = fiber._debugSource.fileName
        .replaceAll("\\", "/")
        .replace(/^.*\/01AskBible\//, "");
      src = `${normalized}:${fiber._debugSource.lineNumber}`;
    }
    if (!comp && typeof fiber.type === "function") {
      const fnType = fiber.type as FiberFunctionType;
      const candidate = fnType.displayName || fnType.name || "";
      if (candidate && /^[A-Z]/.test(candidate)) {
        comp = candidate;
      }
    }
    if (comp && src) break;
    fiber = (fiber.return ?? null) as typeof fiber;
  }
  return { comp, src };
}

function collectSrcAndComponent(
  start: Element | null,
  maxDepth = 3,
): { componentName: string; srcChain: string[] } {
  const srcChain: string[] = [];
  let componentName = "";
  let cur: Element | null = start;
  while (cur) {
    const comp = cur.getAttribute("data-ab-comp");
    if (!componentName && comp) componentName = comp;
    if (srcChain.length < maxDepth) {
      const src = cur.getAttribute("data-ab-src");
      if (src && !srcChain.includes(src)) srcChain.push(src);
    }
    if (componentName && srcChain.length >= maxDepth) break;
    cur = cur.parentElement;
  }
  if (!componentName || srcChain.length === 0) {
    const fb = inspectReactFiberFallback(start);
    if (!componentName && fb.comp) componentName = fb.comp;
    if (srcChain.length === 0 && fb.src) srcChain.push(fb.src);
  }
  return {
    componentName: componentName || "AppUI",
    srcChain,
  };
}

export function buildProbeSnapshotAt(el: Element | null): ProbeSnapshot | null {
  if (!el || el.closest("[data-ab-probe-ui]")) return null;
  const safeHash =
    typeof window !== "undefined" && !/token=|code=/i.test(window.location.hash)
      ? window.location.hash
      : "";
  const route =
    typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}${safeHash}`
      : "/";

  const interactive =
    el.closest(
      '[data-ab-src], button, a, summary, input, select, textarea, label, [role="button"], [data-verse]',
    ) ?? el;

  const tag = interactive.tagName.toLowerCase();
  const verse = interactive.getAttribute("data-verse") ?? el.closest("[data-verse]")?.getAttribute("data-verse") ?? "";
  const aria = cleanText(interactive.getAttribute("aria-label") ?? interactive.getAttribute("title"));
  const text = cleanText((interactive as HTMLElement).innerText || interactive.textContent);
  const cls = cleanText(
    typeof interactive.className === "string"
      ? interactive.className.split(/\s+/).filter(Boolean).slice(0, 2).join(".")
      : "",
    34,
  );
  const { componentName, srcChain } = collectSrcAndComponent(interactive, 3);
  const primarySrc = srcChain[0] || `${route} (DOM)`;
  const srcText = srcChain.join(" <- ") || primarySrc;
  const label = aria || text;
  const elemDesc = [
    `<${tag}>`,
    verse ? `v.${verse}` : "",
    label ? `"${label}"` : "",
    cls ? `.${cls}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const rect = interactive.getBoundingClientRect();
  return {
    componentName,
    title: `<${componentName}> · ${elemDesc}`,
    lines: [primarySrc, ...(srcChain.length > 1 ? [`↳ ${srcChain.slice(1).join(" <- ")}`] : [])],
    copyText: `[AskBible 定位] route=${route} | 组件=${componentName} | 元素=${elemDesc} | 源码=${srcText}`,
    ...(rect.width > 0 && rect.height > 0
      ? { box: { left: rect.left, top: rect.top, width: rect.width, height: rect.height } }
      : {}),
  };
}

async function writeClipboardText(text: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    /* fallback below */
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  ta.remove();
}

export function isCodeProbeAuthorized(
  isAdmin: boolean | undefined,
  isDev = process.env.NODE_ENV === "development",
): boolean {
  return Boolean(isDev || isAdmin);
}

export function resolveCodeProbeTier(
  isAdmin: boolean | undefined,
  isDev = process.env.NODE_ENV === "development",
): CodeProbeTier {
  return isCodeProbeAuthorized(isAdmin, isDev) ? "admin" : "muted";
}

type CodeProbeContextValue = {
  tier: CodeProbeTier;
  active: boolean;
  onTriggerButton: () => void;
};

const CodeProbeContext = createContext<CodeProbeContextValue | null>(null);

export function CodeProbeProvider({
  children,
  isAdminOverride,
  isDevOverride,
}: {
  children: ReactNode;
  isAdminOverride?: boolean;
  isDevOverride?: boolean;
}) {
  const { isAdmin } = useAskbibleUser();
  const { locale } = useLocale();
  const isEn = locale === "en";
  const effectiveAdmin = isAdminOverride === undefined ? isAdmin : isAdminOverride;
  const tier = resolveCodeProbeTier(effectiveAdmin, isDevOverride);
  const allowed = tier === "admin";

  const [active, setActive] = useState(false);
  const [hover, setHover] = useState<{ snap: ProbeSnapshot; x: number; y: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showVisitorNotice = useCallback(() => {
    setToast(
      isEn
        ? "Admin-only locator tool · Sign in as admin to inspect & copy file:line"
        : "管理员专属定位工具 · 登录管理员账号后可点选复制源码行号",
    );
  }, [isEn]);

  const onTriggerButton = useCallback(() => {
    if (!allowed) {
      showVisitorNotice();
      return;
    }
    setActive((v) => !v);
    setHover(null);
  }, [allowed, showVisitorNotice]);

  useEffect(() => {
    if (!allowed && active) {
      setActive(false);
      setHover(null);
    }
  }, [allowed, active]);

  useEffect(() => {
    const onShortcut = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && e.code === "KeyC") {
        e.preventDefault();
        if (!allowed) {
          showVisitorNotice();
          return;
        }
        setActive((v) => !v);
        setHover(null);
      } else if (e.key === "Escape" && active) {
        e.preventDefault();
        e.stopPropagation();
        setActive(false);
        setHover(null);
      }
    };
    window.addEventListener("keydown", onShortcut, true);
    return () => window.removeEventListener("keydown", onShortcut, true);
  }, [allowed, active, showVisitorNotice]);

  useEffect(() => {
    if (!active || !allowed) {
      delete document.documentElement.dataset.abCodeProbe;
      setHover(null);
      return;
    }
    document.documentElement.dataset.abCodeProbe = "1";
    const onMove = (e: PointerEvent) => {
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const snap = buildProbeSnapshotAt(target);
      setHover(snap ? { snap, x: e.clientX, y: e.clientY } : null);
    };
    const swallow = (e: Event) => {
      const target = e.target as Element | null;
      if (target?.closest("[data-ab-probe-ui]")) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) {
        setActive(false);
        return;
      }
      const target = document.elementFromPoint(e.clientX, e.clientY);
      if (target?.closest("[data-ab-probe-ui]")) return;
      swallow(e);
      const snap = buildProbeSnapshotAt(target);
      if (snap) {
        void writeClipboardText(snap.copyText);
        setToast(
          `${isEn ? "✓ Copied locator: " : "✓ 已复制源码定位："}${snap.componentName} (${snap.lines[0] ?? ""})`,
        );
      }
      if (!e.shiftKey) {
        setActive(false);
        setHover(null);
      }
    };
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointerup", swallow, true);
    window.addEventListener("click", swallow, true);
    return () => {
      delete document.documentElement.dataset.abCodeProbe;
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointerup", swallow, true);
      window.removeEventListener("click", swallow, true);
    };
  }, [active, allowed, isEn]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const hudLeft = hover
    ? Math.min(Math.max(12, hover.x + 14), Math.max(12, window.innerWidth - 440))
    : 12;
  const hudTop = hover
    ? hover.y > window.innerHeight - 150
      ? Math.max(12, hover.y - 98)
      : hover.y + 16
    : 12;

  const value = useMemo(
    () => ({ tier, active, onTriggerButton }),
    [tier, active, onTriggerButton],
  );

  return (
    <CodeProbeContext.Provider value={value}>
      {children}
      {typeof document !== "undefined" &&
        active &&
        allowed &&
        hover &&
        createPortal(
          <>
            {hover.snap.box ? (
              <div
                className="ab-code-probe-frame"
                data-ab-probe-ui=""
                style={{
                  left: Math.round(hover.snap.box.left),
                  top: Math.round(hover.snap.box.top),
                  width: Math.round(hover.snap.box.width),
                  height: Math.round(hover.snap.box.height),
                }}
              />
            ) : null}
            <div
              className="ab-code-probe-hud"
              data-ab-probe-ui=""
              style={{ left: Math.round(hudLeft), top: Math.round(hudTop) }}
            >
              <div className="ab-code-probe-hud__title">{hover.snap.title}</div>
              {hover.snap.lines.map((line, idx) => (
                <div key={idx} className="ab-code-probe-hud__src">
                  {line}
                </div>
              ))}
              <div className="ab-code-probe-hud__hint">
                {isEn
                  ? "Click to copy file:line · Shift+Click keep open · Esc exit"
                  : "左键点击复制精确 file:line · Shift+点击连续复制 · Esc 退出"}
              </div>
            </div>
          </>,
          document.body,
        )}
      {typeof document !== "undefined" &&
        toast &&
        createPortal(
          <div className="ab-code-probe-toast" role="status" data-ab-probe-ui="">
            {toast}
          </div>,
          document.body,
        )}
    </CodeProbeContext.Provider>
  );
}

/**
 * 底栏显式「定位」探针按钮（快捷键 Alt+Shift+C）：
 * - 管理员态：完整高亮开启，悬停显示组件名与 `file:line`，点击一键复制。
 * - 普通访客态：低饱和度弱化态常驻展示（绝不隐藏消失），悬停/轻点温和提示“管理员专属定位工具”。
 */
export function AskBibleCodeProbeButton() {
  const ctx = useContext(CodeProbeContext);
  const { locale } = useLocale();
  const isEn = locale === "en";
  const tier = ctx?.tier ?? "muted";
  const active = ctx?.active ?? false;
  const allowed = tier === "admin";

  const tooltip = active
    ? isEn
      ? "Exit code locator (Esc)"
      : "退出源码定位（Esc）"
    : allowed
      ? isEn
        ? "Locate component & file:line (Alt+Shift+C)"
        : "定位 · 悬停显示组件与源码文件:行号，点击一键复制（Alt+Shift+C）"
      : isEn
        ? "Admin-only locator tool (Alt+Shift+C)"
        : "管理员专属定位工具（Alt+Shift+C）";

  return (
    <button
      type="button"
      className="ab-code-probe-btn"
      data-ab-probe-ui=""
      data-ab-probe-tier={tier}
      data-ab-nav-id="code-probe"
      aria-pressed={allowed ? active : false}
      aria-disabled={!allowed || undefined}
      aria-label={active ? (isEn ? "Exit locate" : "退出定位") : isEn ? "Locate" : "定位"}
      title={tooltip}
      onClick={() => ctx?.onTriggerButton()}
    >
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="5.2" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M8 1v2.5M8 12.5V15M1 8h2.5M12.5 8H15"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="8" cy="8" r="1.4" fill="currentColor" />
      </svg>
      <span>{isEn ? "Locate" : "定位"}</span>
    </button>
  );
}
