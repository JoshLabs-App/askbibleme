"use client";

import { useState, type ReactNode } from "react";
import { LocalePickerModal } from "./LocalePickerModal";

type Props = {
  children: (open: () => void) => ReactNode;
};

export function LocaleTrigger({ children }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {children(() => setOpen(true))}
      <LocalePickerModal open={open} onDismiss={() => setOpen(false)} />
    </>
  );
}
