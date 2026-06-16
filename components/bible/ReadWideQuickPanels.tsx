"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppShellModal } from "@/components/ui/AppShellModal";
import { ReadFavoritesClient } from "@/components/bible/ReadFavoritesClient";
import { ReadScriptureSearchClient } from "@/components/bible/ReadScriptureSearchClient";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useReadChapterSpreadLayout } from "@/hooks/useReadChapterSpreadLayout";

type ReadWideQuickPanel = "search" | "favorites" | null;

type ReadWideQuickPanelsContextValue = {
  isWideScreen: boolean;
  openPanel: (panel: Exclude<ReadWideQuickPanel, null>) => void;
  closePanel: () => void;
  isPanelOpen: (panel: Exclude<ReadWideQuickPanel, null>) => boolean;
};

const ReadWideQuickPanelsContext = createContext<ReadWideQuickPanelsContextValue | null>(null);

export function useReadWideQuickPanels(): ReadWideQuickPanelsContextValue {
  const ctx = useContext(ReadWideQuickPanelsContext);
  if (!ctx) throw new Error("useReadWideQuickPanels must be used within ReadWideQuickPanelsProvider");
  return ctx;
}

function PanelCard({
  title,
  titleId,
  onClose,
  children,
}: {
  title: string;
  titleId?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <section className="parchment-control-sheet relative w-[min(56rem,calc(100vw-1rem))] max-w-[56rem] overflow-hidden rounded-[1.35rem]">
      <header className="flex items-center justify-between gap-3 border-b border-[rgba(82,61,40,0.14)] px-5 py-4 dark:border-[rgba(244,235,225,0.1)]">
        <h2 id={titleId} className="text-[1rem] font-semibold tracking-[0.02em] text-[#1c1410] dark:text-stone-50">
          {title}
        </h2>
        <button
          type="button"
          className="rounded-full px-2.5 py-1 text-sm font-medium text-[#5c4030] transition hover:bg-black/5 dark:text-stone-300 dark:hover:bg-white/5"
          onClick={onClose}
        >
          关闭
        </button>
      </header>
      <div className="max-h-[min(78dvh,46rem)] overflow-y-auto px-5 py-5">{children}</div>
    </section>
  );
}

export function ReadWideQuickPanelsProvider({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  const isWideScreen = useReadChapterSpreadLayout();
  const pathname = usePathname();
  const [panel, setPanel] = useState<ReadWideQuickPanel>(null);

  const value = useMemo<ReadWideQuickPanelsContextValue>(
    () => ({
      isWideScreen,
      openPanel: (next) => setPanel(next),
      closePanel: () => setPanel(null),
      isPanelOpen: (next) => panel === next,
    }),
    [isWideScreen, panel],
  );

  useEffect(() => {
    setPanel(null);
  }, [isWideScreen, pathname]);

  const title =
    panel === "search"
      ? t("pages.read.scriptureSearchTitle")
      : panel === "favorites"
        ? t("pages.read.favoritesTitle")
        : "";
  const titleId = panel ? `read-wide-panel-${panel}-title` : undefined;

  return (
    <ReadWideQuickPanelsContext.Provider value={value}>
      {children}
      <AppShellModal
        open={isWideScreen && panel !== null}
        onDismiss={() => setPanel(null)}
        labelledBy={titleId}
        scrimLabel="关闭"
      >
        {panel ? (
          <PanelCard title={title} titleId={titleId} onClose={() => setPanel(null)}>
            {panel === "search" ? <ReadScriptureSearchClient /> : <ReadFavoritesClient />}
          </PanelCard>
        ) : null}
      </AppShellModal>
    </ReadWideQuickPanelsContext.Provider>
  );
}
