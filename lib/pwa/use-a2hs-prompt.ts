"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { markInstallCompleted } from "@/lib/pwa/install-prompt-persistence";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type A2hsState =
  | { status: "unavailable" }
  | { status: "ready"; trigger: () => Promise<void> }
  | { status: "installing" }
  | { status: "installed" };

/**
 * Captures the `beforeinstallprompt` event so we can trigger it on demand.
 * Only fires on browsers that support the native A2HS prompt (Chrome on Android, some Chromium desktops).
 * iOS does not fire this event; show manual instructions there instead.
 */
export function useA2hsPrompt(): A2hsState {
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [state, setState] = useState<A2hsState>({ status: "unavailable" });

  useEffect(() => {
    function onBeforeInstall(e: Event) {
      e.preventDefault();
      deferredRef.current = e as BeforeInstallPromptEvent;
      setState({
        status: "ready",
        trigger: async () => {
          const deferred = deferredRef.current;
          if (!deferred) return;
          setState({ status: "installing" });
          try {
            await deferred.prompt();
            const { outcome } = await deferred.userChoice;
            deferredRef.current = null;
            if (outcome === "accepted") {
              markInstallCompleted();
              setState({ status: "installed" });
            } else {
              setState({ status: "unavailable" });
            }
          } catch {
            setState({ status: "unavailable" });
          }
        },
      });
    }

    function onAppInstalled() {
      deferredRef.current = null;
      markInstallCompleted();
      setState({ status: "installed" });
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  return state;
}
