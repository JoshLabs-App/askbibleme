"use client";

import { useState, type ReactNode } from "react";
import { AppSkinPickerModal } from "./AppSkinPickerModal";

type Props = {
  children: (open: () => void) => ReactNode;
};

/** 由子级渲染触发控件；弹层状态内聚，便于底栏 / 后台等多处复用 */
export function AppSkinTrigger({ children }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {children(() => setOpen(true))}
      <AppSkinPickerModal open={open} onDismiss={() => setOpen(false)} />
    </>
  );
}
