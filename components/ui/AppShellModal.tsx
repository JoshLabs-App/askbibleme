"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type AppShellModalProps = {
  open: boolean;
  onDismiss: () => void;
  /** 置于遮罩之上的内容（通常为一张卡片，建议自带 `relative z-[1]` 与宽度） */
  children: ReactNode;
  /** `role="dialog"` 的 `aria-labelledby` */
  labelledBy?: string;
  /** 点击遮罩关闭时，遮罩按钮的 `aria-label` */
  scrimLabel?: string;
  closeOnEscape?: boolean;
};

/**
 * 固定在视口、水平垂直居中的轻量弹层；通过 Portal 挂到 `document.body`，
 * 叠在 `(app-shell)` 底栏之上。新菜单/面板请复用此类 + `globals.css` 中 `.app-shell-modal-root`、`.app-shell-modal-scrim`、`.app-shell-modal-slot`。
 */
export function AppShellModal({
  open,
  onDismiss,
  children,
  labelledBy,
  scrimLabel = "关闭",
  closeOnEscape = true,
}: AppShellModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !closeOnEscape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeOnEscape, onDismiss]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="app-shell-modal-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <button type="button" className="app-shell-modal-scrim" aria-label={scrimLabel} onClick={onDismiss} />
      <div className="app-shell-modal-slot">{children}</div>
    </div>,
    document.body,
  );
}
