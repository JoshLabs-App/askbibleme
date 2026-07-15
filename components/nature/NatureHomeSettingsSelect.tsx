"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ShellMaterialIcon } from "@/components/shell/ShellMaterialIcon";
import "./nature-home-settings-select.css";

export type NatureHomeSettingsSelectOption = {
  id: string;
  label: string;
  shortLabel?: string;
  language?: string;
};

type Props = {
  accessibilityLabel: string;
  value: string;
  options: NatureHomeSettingsSelectOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (id: string) => void;
  disabled?: boolean;
  className?: string;
  /** 自然首页紧凑行：固定窄宽，不随面板拉宽 */
  compact?: boolean;
};

/** 对齐 App `NatureHomeSettingsSelect`；下拉挂 body，避免面板 overflow 裁切 */
export function NatureHomeSettingsSelect({
  accessibilityLabel,
  value,
  options,
  open,
  onOpenChange,
  onSelect,
  disabled = false,
  className = "",
  compact = false,
}: Props) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [portalReady, setPortalReady] = useState(false);
  const [menuRect, setMenuRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const active = options.find((o) => o.id === value) ?? options[0];
  const display = active?.shortLabel ?? active?.label ?? "";

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setMenuRect(null);
      return;
    }
    const measure = () => {
      const node = anchorRef.current;
      if (!node) return;
      const r = node.getBoundingClientRect();
      setMenuRect({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onOpenChange]);

  const menu =
    open && !disabled && menuRect && portalReady
      ? createPortal(
          <div
            className="nature-home-settings-select-menu fixed z-[96] max-h-40 overflow-y-auto overscroll-y-contain rounded-[7px] border py-1 shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
            style={{
              top: menuRect.top,
              left: menuRect.left,
              width: menuRect.width,
            }}
            role="listbox"
            aria-label={accessibilityLabel}
          >
            {options.map((opt) => {
              const selected = opt.id === value;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => onSelect(opt.id)}
                  className={[
                    "nature-home-settings-select-option flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left text-[12px] transition",
                    selected ? "nature-home-settings-select-option--selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span className="nature-home-settings-select-option-label min-w-0 truncate">
                    {opt.label}
                  </span>
                  {selected ? (
                    <ShellMaterialIcon name="check" size={16} color="#d97707" />
                  ) : (
                    <span className="w-4 shrink-0" aria-hidden />
                  )}
                </button>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {menu}
      <div
        className={[
          "relative shrink-0",
          compact ? "w-[4.75rem]" : "min-w-0 flex-1",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <button
          ref={anchorRef}
          type="button"
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={accessibilityLabel}
          onClick={() => onOpenChange(!open)}
          className={[
            "nature-home-settings-select-trigger flex min-h-[38px] w-full items-center justify-between gap-0.5 rounded-[9px] border px-3 py-1.5 text-left transition",
            disabled ? "opacity-35" : "",
          ].join(" ")}
        >
          <span className="min-w-0 flex-1 truncate text-[14px] text-[#1c1410]">{display}</span>
          <ShellMaterialIcon
            name={open ? "expand_less" : "expand_more"}
            size={18}
            color={disabled ? "rgba(28,20,16,0.35)" : "#6e5240"}
          />
        </button>
      </div>
    </>
  );
}
