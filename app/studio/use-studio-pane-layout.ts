"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { STUDIO_DISCUSSION_FOCUS_ONLY_KEY } from "@/lib/studio-config";

export const STUDIO_LAYOUT_STORAGE_KEY = "askbible-studio-layout-v1";
export const LAYOUT_DEFAULT_LEFT_PX = 268;
export const LAYOUT_DEFAULT_RIGHT_PX = 380;
export const RESIZER_WIDTH_PX = 6;

export function useStudioPaneLayout() {
  const [leftColPx, setLeftColPx] = useState(LAYOUT_DEFAULT_LEFT_PX);
  const [rightColPx, setRightColPx] = useState(LAYOUT_DEFAULT_RIGHT_PX);
  const mainRowRef = useRef<HTMLDivElement>(null);
  /** 仅显示右侧 AI 讨论区（全宽）；首屏须与 SSR 一致，在 useLayoutEffect 中再读 localStorage */
  const [discussionFocusOnly, setDiscussionFocusOnly] = useState(false);

  useLayoutEffect(() => {
    try {
      if (localStorage.getItem(STUDIO_DISCUSSION_FOCUS_ONLY_KEY) === "1") {
        setDiscussionFocusOnly(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      const lay = localStorage.getItem(STUDIO_LAYOUT_STORAGE_KEY);
      if (lay) {
        const p = JSON.parse(lay) as {
          left?: unknown;
          right?: unknown;
        };
        if (typeof p.left === "number" && p.left >= 0) {
          setLeftColPx(p.left);
        }
        if (typeof p.right === "number" && p.right >= 0) {
          setRightColPx(p.right);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STUDIO_DISCUSSION_FOCUS_ONLY_KEY,
        discussionFocusOnly ? "1" : "0",
      );
    } catch {
      /* ignore */
    }
  }, [discussionFocusOnly]);

  const persistLayoutSizes = useCallback((left: number, right: number) => {
    try {
      localStorage.setItem(
        STUDIO_LAYOUT_STORAGE_KEY,
        JSON.stringify({ version: 1, left, right }),
      );
    } catch {
      /* ignore */
    }
  }, []);

  const beginResizeLeftDivider = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const row = mainRowRef.current;
      const el = e.currentTarget;
      if (!row) return;
      const startX = e.clientX;
      const startLeft = leftColPx;
      const otherRight = rightColPx;
      let lastLeft = startLeft;
      el.setPointerCapture(e.pointerId);
      const onMove = (ev: PointerEvent) => {
        const w = row.offsetWidth;
        const dx = ev.clientX - startX;
        const maxL = Math.max(0, w - otherRight - 2 * RESIZER_WIDTH_PX);
        lastLeft = Math.min(Math.max(0, startLeft + dx), maxL);
        setLeftColPx(lastLeft);
      };
      const done = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        try {
          el.releasePointerCapture(ev.pointerId);
        } catch {
          /* ignore */
        }
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", done);
        el.removeEventListener("pointercancel", done);
        persistLayoutSizes(lastLeft, otherRight);
      };
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", done);
      el.addEventListener("pointercancel", done);
    },
    [leftColPx, rightColPx, persistLayoutSizes],
  );

  const beginResizeRightDivider = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const row = mainRowRef.current;
      const el = e.currentTarget;
      if (!row) return;
      const startX = e.clientX;
      const otherLeft = leftColPx;
      const startRight = rightColPx;
      let lastRight = startRight;
      el.setPointerCapture(e.pointerId);
      const onMove = (ev: PointerEvent) => {
        const w = row.offsetWidth;
        const dx = ev.clientX - startX;
        const maxR = Math.max(0, w - otherLeft - 2 * RESIZER_WIDTH_PX);
        lastRight = Math.min(Math.max(0, startRight - dx), maxR);
        setRightColPx(lastRight);
      };
      const done = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        try {
          el.releasePointerCapture(ev.pointerId);
        } catch {
          /* ignore */
        }
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", done);
        el.removeEventListener("pointercancel", done);
        persistLayoutSizes(otherLeft, lastRight);
      };
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", done);
      el.addEventListener("pointercancel", done);
    },
    [leftColPx, rightColPx, persistLayoutSizes],
  );

  return {
    mainRowRef,
    leftColPx,
    rightColPx,
    discussionFocusOnly,
    setDiscussionFocusOnly,
    beginResizeLeftDivider,
    beginResizeRightDivider,
  };
}
