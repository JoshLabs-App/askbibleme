"use client";

import { useEffect, useId, useRef } from "react";

export type ReadBibleSettingsSelectOption = {
  id: string;
  label: string;
  shortLabel?: string;
};

type BaseProps = {
  options: ReadBibleSettingsSelectOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emptyDisplay?: string;
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
};

type SingleProps = BaseProps & {
  value: string;
  onSelect: (id: string) => void;
};

type MultiProps = BaseProps & {
  values: string[];
  onToggleSelect: (id: string) => void;
};

function ChevronIcon({ up }: { up: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      aria-hidden
      className="shrink-0 text-amber-900/45 dark:text-stone-400"
    >
      <path
        d={up ? "m7 14 5-5 5 5" : "m7 10 5 5 5-5"}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 对齐 App `ReadSettingsSelect`：触发器 + 下拉列表（支持单选 / 多选勾选） */
export function ReadBibleSettingsSelect(props: SingleProps | MultiProps) {
  const multi = "values" in props;
  const { options, open, onOpenChange, emptyDisplay, disabled, ariaLabel, className } = props;
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selectedIds = multi ? props.values : [];
  const display = multi
    ? selectedIds
        .map((id) => {
          const item = options.find((opt) => opt.id === id);
          return item?.shortLabel ?? item?.label ?? "";
        })
        .filter(Boolean)
        .join(", ")
    : (() => {
        const active = options.find((o) => o.id === props.value) ?? options[0];
        return active?.shortLabel ?? active?.label ?? "";
      })();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, onOpenChange]);

  return (
    <div
      ref={rootRef}
      className={[
        "read-bible-settings-select",
        open ? "read-bible-settings-select--open" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        className="read-bible-settings-select__trigger"
        onClick={() => onOpenChange(!open)}
      >
        <span className="read-bible-settings-select__value">{display || emptyDisplay || ""}</span>
        <ChevronIcon up={open} />
      </button>
      {open && !disabled ? (
        <ul id={listId} role="listbox" aria-multiselectable={multi || undefined} className="read-bible-settings-select__menu">
          {options.map((opt) => {
            const selected = multi ? selectedIds.includes(opt.id) : opt.id === props.value;
            return (
              <li key={opt.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={[
                    "read-bible-settings-select__option",
                    selected ? "read-bible-settings-select__option--active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => {
                    if (multi) {
                      props.onToggleSelect(opt.id);
                      return;
                    }
                    props.onSelect(opt.id);
                    onOpenChange(false);
                  }}
                >
                  {multi ? <span className="read-bible-settings-select__check" aria-hidden /> : null}
                  <span className="read-bible-settings-select__option-label">{opt.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
