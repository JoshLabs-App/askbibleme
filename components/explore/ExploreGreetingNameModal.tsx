"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  isValidExploreDisplayName,
  normalizeExploreDisplayName,
} from "@/lib/explore/explore-birth-year-prefs";

type Props = {
  open: boolean;
  initialName: string;
  onClose: () => void;
  onSave: (name: string) => void | Promise<void>;
};

/** 对齐 App `ExploreGreetingNameModal` */
export function ExploreGreetingNameModal({ open, initialName, onClose, onSave }: Props) {
  const { t } = useLocale();
  const [value, setValue] = useState(initialName);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setValue(initialName);
  }, [open, initialName]);

  const canSave = isValidExploreDisplayName(value) && !saving;

  const submit = () => {
    if (!canSave) return;
    void (async () => {
      setSaving(true);
      try {
        await onSave(value.trim());
      } finally {
        setSaving(false);
      }
    })();
  };

  if (!open) return null;

  return (
    <div className="explore-greeting-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="explore-greeting-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="explore-greeting-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="explore-greeting-modal-title" className="explore-greeting-modal-title">
          {t("pages.explore.greetingEditTitle")}
        </h2>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("pages.explore.birthYearModalNamePlaceholder")}
          className="explore-greeting-modal-input"
          maxLength={24}
          autoCorrect="off"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") onClose();
          }}
        />
        <div className="explore-greeting-modal-actions">
          <button type="button" className="explore-greeting-modal-btn" onClick={onClose}>
            {t("pages.explore.birthYearModalCancel")}
          </button>
          <button type="button" className="explore-greeting-modal-btn explore-greeting-modal-btn--primary" disabled={!canSave} onClick={submit}>
            {t("pages.explore.birthYearModalSave")}
          </button>
        </div>
      </div>
    </div>
  );
}
