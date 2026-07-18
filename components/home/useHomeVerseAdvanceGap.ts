"use client";

import { useEffect, useSyncExternalStore } from "react";

const STORAGE_KEY = "askbible-home-verse-advance-gap-sec-v1";
const UPDATED_EVENT = "askbible:home-verse-advance-gap-updated";
const OPTIONS = [3, 5, 7] as const;
const DEFAULT_GAP_SEC = 3;

let cached = DEFAULT_GAP_SEC;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* ignore */
    }
  });
}

function clamp(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n)) return DEFAULT_GAP_SEC;
  const rounded = Math.round(n);
  let nearest: number = OPTIONS[0];
  let best = Math.abs(rounded - nearest);
  for (const sec of OPTIONS) {
    const delta = Math.abs(rounded - sec);
    if (delta < best) {
      nearest = sec;
      best = delta;
    }
  }
  return nearest;
}

export function readHomeVerseAdvanceGapSec(): number {
  if (typeof window === "undefined") return DEFAULT_GAP_SEC;
  if (!hydrated) {
    try {
      cached = clamp(window.localStorage.getItem(STORAGE_KEY));
    } catch {
      cached = DEFAULT_GAP_SEC;
    }
    hydrated = true;
  }
  return cached;
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  const onStorage = (ev: StorageEvent) => {
    if (ev.key === STORAGE_KEY) onStoreChange();
  };
  const onCustom = () => onStoreChange();
  window.addEventListener("storage", onStorage);
  window.addEventListener(UPDATED_EVENT, onCustom);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(UPDATED_EVENT, onCustom);
  };
}

export function writeHomeVerseAdvanceGapSec(next: number): number {
  const clamped = clamp(next);
  cached = clamped;
  hydrated = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(clamped));
  } catch {
    /* ignore */
  }
  emit();
  window.dispatchEvent(new Event(UPDATED_EVENT));
  return clamped;
}

export function useHomeVerseAdvanceGapSec(): number {
  const gapSec = useSyncExternalStore(
    subscribe,
    readHomeVerseAdvanceGapSec,
    () => DEFAULT_GAP_SEC,
  );

  useEffect(() => {
    readHomeVerseAdvanceGapSec();
  }, []);

  return gapSec;
}
