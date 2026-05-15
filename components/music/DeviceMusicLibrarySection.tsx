"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  addDeviceTrackFromFile,
  deleteDeviceTrack,
  getDeviceTrackBlob,
  importAudioFilesFromDirectoryHandle,
  listDeviceTracks,
  type DeviceMusicTrackMeta,
} from "@/lib/music/device-library-db";

type Props = {
  /** 与音乐页主区衬底一致时用浅色文案 */
  tone?: "onLight";
};

export function DeviceMusicLibrarySection({ tone }: Props) {
  const { t } = useLocale();
  const {
    deviceLibraryPlayback,
    attachDeviceLibraryFromBlob,
    clearDeviceLibraryPlayback,
    canPickLocalAudioFolder,
  } = useMusicShellPlayback();

  const [tracks, setTracks] = useState<DeviceMusicTrackMeta[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const openInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await listDeviceTracks();
      setTracks(list);
    } catch {
      setTracks([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const muted = tone === "onLight" ? "text-ink/45" : "text-ink/50";
  const line = tone === "onLight" ? "text-ink/70" : "text-ink/65";

  const run = useCallback(async (fn: () => Promise<void>, okKey?: string) => {
    setNotice(null);
    setBusy(true);
    try {
      await fn();
      if (okKey) setNotice(t(okKey));
      await refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : t("music.deviceLibrary.errorGeneric"));
    } finally {
      setBusy(false);
    }
  }, [refresh, t]);

  const onOpenPicked = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      e.target.value = "";
      const file = files?.[0];
      if (!file) return;
      await run(async () => {
        const sid =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? `session:${crypto.randomUUID()}`
            : `session:${Date.now()}`;
        attachDeviceLibraryFromBlob(sid, file, { persistResume: false });
      });
    },
    [attachDeviceLibraryFromBlob, run],
  );

  const onImportPicked = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      e.target.value = "";
      if (!files?.length) return;
      await run(async () => {
        for (const f of Array.from(files)) {
          await addDeviceTrackFromFile(f);
        }
      }, "music.deviceLibrary.importedOk");
    },
    [run],
  );

  const pickFolder = useCallback(async () => {
    if (!canPickLocalAudioFolder || typeof window === "undefined") return;
    setNotice(null);
    setBusy(true);
    try {
      const picker = (
        window as unknown as {
          showDirectoryPicker?: (opts?: { mode?: string }) => Promise<FileSystemDirectoryHandle>;
        }
      ).showDirectoryPicker;
      if (!picker) return;
      const dir = await picker({ mode: "read" });
      const { imported, skipped } = await importAudioFilesFromDirectoryHandle(dir);
      await refresh();
      if (imported === 0) {
        setNotice(t("music.deviceLibrary.folderEmpty"));
      } else {
        setNotice(
          t("music.deviceLibrary.folderImported", {
            count: String(imported),
            skipped: String(skipped),
          }),
        );
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      setNotice(e instanceof Error ? e.message : t("music.deviceLibrary.errorGeneric"));
    } finally {
      setBusy(false);
    }
  }, [canPickLocalAudioFolder, refresh, t]);

  const playImported = useCallback(
    async (id: string) => {
      setNotice(null);
      try {
        const blob = await getDeviceTrackBlob(id);
        if (!blob) {
          setNotice(t("music.deviceLibrary.missingBlob"));
          await refresh();
          return;
        }
        attachDeviceLibraryFromBlob(id, blob, { persistResume: true });
      } catch (e) {
        setNotice(e instanceof Error ? e.message : t("music.deviceLibrary.errorGeneric"));
      }
    },
    [attachDeviceLibraryFromBlob, refresh, t],
  );

  const removeImported = useCallback(
    async (id: string) => {
      await run(async () => {
        if (deviceLibraryPlayback?.trackId === id) {
          clearDeviceLibraryPlayback();
        }
        await deleteDeviceTrack(id);
      });
    },
    [clearDeviceLibraryPlayback, deviceLibraryPlayback?.trackId, run],
  );

  return (
    <section
      className="mx-auto mt-4 w-full max-w-md shrink-0 border-t border-ink/10 px-2 pb-2 pt-4 sm:max-w-lg"
      aria-label={t("music.deviceLibrary.sectionAria")}
    >
      <h2 className={`mb-1 text-center text-[11px] font-medium uppercase tracking-[0.12em] ${muted}`}>
        {t("music.deviceLibrary.heading")}
      </h2>
      <p className={`mx-auto mb-3 max-w-sm text-center text-[11px] leading-relaxed sm:text-xs ${line}`}>
        {t("music.deviceLibrary.intro")}
      </p>

      <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
        <input
          ref={openInputRef}
          type="file"
          className="sr-only"
          accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.opus,.webm,.flac"
          onChange={onOpenPicked}
        />
        <input
          ref={importInputRef}
          type="file"
          className="sr-only"
          multiple
          accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.opus,.webm,.flac"
          onChange={onImportPicked}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => openInputRef.current?.click()}
          className="rounded-full border border-ink/15 bg-ink/[0.03] px-3 py-1.5 text-[12px] text-ink/80 transition hover:bg-ink/[0.06] disabled:opacity-40"
        >
          {t("music.deviceLibrary.openFile")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => importInputRef.current?.click()}
          className="rounded-full border border-ink/15 bg-ink/[0.03] px-3 py-1.5 text-[12px] text-ink/80 transition hover:bg-ink/[0.06] disabled:opacity-40"
        >
          {t("music.deviceLibrary.import")}
        </button>
        {canPickLocalAudioFolder ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void pickFolder()}
            className="rounded-full border border-ink/15 bg-ink/[0.03] px-3 py-1.5 text-[12px] text-ink/80 transition hover:bg-ink/[0.06] disabled:opacity-40"
          >
            {t("music.deviceLibrary.importFolder")}
          </button>
        ) : null}
      </div>

      {notice ? (
        <p className="mb-2 text-center text-[11px] leading-relaxed text-ink/55 sm:text-xs" role="status">
          {notice}
        </p>
      ) : null}

      {tracks.length === 0 ? (
        <p className={`text-center text-[11px] sm:text-xs ${muted}`}>{t("music.deviceLibrary.emptyList")}</p>
      ) : (
        <ul className="mx-auto max-h-[min(32dvh,14rem)] space-y-0.5 overflow-y-auto overscroll-y-contain text-center [-webkit-overflow-scrolling:touch]">
          {tracks.map((tr) => {
            const active = deviceLibraryPlayback?.trackId === tr.id;
            return (
              <li key={tr.id} className="flex items-center justify-center gap-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void playImported(tr.id)}
                  aria-current={active ? "true" : undefined}
                  className={[
                    "min-w-0 flex-1 truncate rounded-lg px-2 py-2 text-center text-[13px] transition sm:text-[14px]",
                    active ? "font-medium text-ink" : "text-ink/55 hover:text-ink/75",
                  ].join(" ")}
                >
                  {tr.name}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void removeImported(tr.id)}
                  className="shrink-0 rounded-lg px-2 py-2 text-[11px] text-ink/35 hover:text-ink/55"
                  aria-label={t("music.deviceLibrary.removeAria")}
                >
                  {t("music.deviceLibrary.remove")}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
