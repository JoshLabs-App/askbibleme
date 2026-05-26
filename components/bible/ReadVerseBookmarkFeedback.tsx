"use client";

import { useEffect, useState } from "react";

type Props = {
  message: string | null;
  onClear: () => void;
};

export function ReadVerseBookmarkFeedback({ message, onClear }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const timer = window.setTimeout(() => {
      setVisible(false);
      onClear();
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [message, onClear]);

  if (!visible || !message) return null;

  return (
    <div className="read-verse-bookmark-feedback" role="status" aria-live="polite">
      {message}
    </div>
  );
}
