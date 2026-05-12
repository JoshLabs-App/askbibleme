"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  newBackgroundId,
  newTrackId,
  nextDateNumberedImageUploadTitle,
  nextDateNumberedMusicUploadTitle,
  titleFromUploadFileName,
} from "@/lib/music-companion/track-naming";
import type { MusicCompanionStore } from "@/lib/music-companion/types";
import { primaryLocaleText } from "@/lib/i18n/localized-text";
import { ADMIN_MAIN_CLASS } from "@/components/admin/admin-layout";
import { diskAuthHeaders } from "@/lib/disk-auth-headers";

function primarySceneId(store: MusicCompanionStore): string | null {
  const ord = [...store.scenes].sort((a, b) => a.order - b.order);
  if (ord.length === 0) return null;
  if (store.defaultSceneId) {
    const hit = ord.find((x) => x.id === store.defaultSceneId);
    if (hit) return hit.id;
  }
  return ord[0]?.id ?? null;
}

function withNewAudioTrack(
  s: MusicCompanionStore,
  payload: { id: string; title: string; src: string; analysisSrc?: string },
): MusicCompanionStore {
  const pid = primarySceneId(s);
  const scenes = pid
    ? s.scenes.map((sc) => (sc.id === pid ? { ...sc, audioTrackId: payload.id } : sc))
    : s.scenes;
  const track: (typeof s.audioTracks)[number] = {
    id: payload.id,
    title: payload.title,
    src: payload.src,
    ...(payload.analysisSrc?.trim() ? { analysisSrc: payload.analysisSrc.trim() } : {}),
  };
  return {
    ...s,
    audioTracks: [...s.audioTracks, track],
    scenes,
  };
}

function withNewImageBackground(
  s: MusicCompanionStore,
  payload: { id: string; src: string; title?: string },
): MusicCompanionStore {
  const pid = primarySceneId(s);
  const scenes = pid
    ? s.scenes.map((sc) => (sc.id === pid ? { ...sc, backgroundVisualId: payload.id } : sc))
    : s.scenes;
  const visual: (typeof s.backgroundVisuals)[number] = {
    id: payload.id,
    type: "image" as const,
    imageSrc: payload.src,
    blur: false,
    ...(payload.title?.trim() ? { title: payload.title.trim() } : {}),
  };
  return {
    ...s,
    backgroundVisuals: [...s.backgroundVisuals, visual],
    scenes,
  };
}

async function postCompanionJson(
  store: MusicCompanionStore,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/music/companion", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...diskAuthHeaders(),
      },
      body: JSON.stringify(store),
    });
    const data = (await parseJsonBody(res)) as { ok?: boolean; error?: string };
    if (!res.ok) {
      return { ok: false, error: data.error ?? `写入失败（${res.status}）` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "写入请求失败" };
  }
}

async function parseJsonBody(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`服务器返回非 JSON（HTTP ${res.status}）。若为生产环境，请确认接口未返回 HTML 错误页。`);
  }
}

function disk403Hint(status: number, serverError: string): string {
  if (status !== 403) return "";
  if (!serverError.includes("未允许")) return "";
  return " 提示：使用 `next start` 时需在 Studio 填写与 STUDIO_WRITE_SECRET 相同的磁盘密钥，或本地使用 `npm run dev`。";
}

type UploadProgressPayload = { pct: number; awaitingServer: boolean };

function parseJsonFromBodyText(bodyText: string, httpStatus: number): Record<string, unknown> {
  if (!bodyText.trim()) return {};
  try {
    return JSON.parse(bodyText) as Record<string, unknown>;
  } catch {
    throw new Error(`服务器返回非 JSON（HTTP ${httpStatus}）。若为生产环境，请确认接口未返回 HTML 错误页。`);
  }
}

/** `fetch` 无法可靠报告 multipart 上传字节进度；用 XHR 的 `upload.onprogress`。 */
function xhrPostFormData(
  url: string,
  form: FormData,
  headers: Record<string, string>,
  onProgress: (p: UploadProgressPayload) => void,
  timeoutMs = 130_000,
): Promise<{ status: number; bodyText: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.timeout = timeoutMs;
    for (const [k, v] of Object.entries(headers)) {
      if (v) xhr.setRequestHeader(k, v);
    }
    let lastEmit = 0;
    const emit = (pct: number, awaitingServer: boolean) => {
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      if (!awaitingServer && pct < 100 && now - lastEmit < 90) return;
      lastEmit = now;
      onProgress({ pct: Math.min(100, Math.max(0, pct)), awaitingServer });
    };
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        emit(Math.floor((100 * e.loaded) / e.total), false);
      } else if (e.loaded > 0) {
        emit(1, false);
      }
    };
    xhr.upload.onload = () => {
      emit(100, true);
    };
    xhr.onload = () => resolve({ status: xhr.status, bodyText: xhr.responseText });
    xhr.onerror = () => reject(new Error("网络错误（XHR）"));
    xhr.ontimeout = () =>
      reject(
        new Error(
          `上传超时（>${Math.round(timeoutMs / 1000)}s）。大文件转码较慢时可设 MUSIC_UPLOAD_SKIP_TRANSCODE=1，或跳过能量分析 MUSIC_UPLOAD_SKIP_ANALYSIS=1。`,
        ),
      );
    xhr.onabort = () => reject(new Error("上传已中断"));
    xhr.send(form);
  });
}

/** 单入口上传：按 MIME / 扩展名自动分到音频或图片。 */
function mediaKind(file: File): "audio" | "image" | null {
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("image/")) return "image";
  const n = file.name.toLowerCase();
  if (/\.(mp3|m4a|aac|ogg|opus|wav|webm|flac)$/.test(n)) return "audio";
  if (/\.(jpe?g|png|webp|gif)$/.test(n)) return "image";
  return null;
}

export function MusicAdminClient() {
  const [store, setStore] = useState<MusicCompanionStore | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const persistIgnoreUntil = useRef(0);
  const storeRef = useRef<MusicCompanionStore | null>(null);
  storeRef.current = store;

  const getStoreSnapshot = useCallback(() => storeRef.current, []);

  const bumpPersistIgnore = useCallback((ms = 2800) => {
    persistIgnoreUntil.current = Date.now() + ms;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/music/companion");
      const data = (await parseJsonBody(res)) as MusicCompanionStore | { error?: string };
      if (!res.ok) {
        setMsg((data as { error?: string }).error ?? "加载失败");
        setStore(null);
        return;
      }
      setStore(data as MusicCompanionStore);
      persistIgnoreUntil.current = Date.now() + 1000;
    } catch {
      setMsg("网络错误");
      setStore(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** 上传等关键路径显式写入；列表编辑依赖下方防抖自动写入。 */
  const flushToDisk = useCallback(async (snapshot: MusicCompanionStore) => {
    try {
      const r = await postCompanionJson(snapshot);
      if (!r.ok) {
        setMsg(r.error);
        return false;
      }
      return true;
    } catch {
      setMsg("写入请求失败");
      return false;
    }
  }, []);

  useEffect(() => {
    if (loading || !store) return;
    const id = window.setTimeout(() => {
      if (Date.now() < persistIgnoreUntil.current) return;
      void (async () => {
        const r = await postCompanionJson(store);
        if (!r.ok) setMsg(r.error);
      })();
    }, 800);
    return () => window.clearTimeout(id);
  }, [store, loading]);

  if (loading) {
    return (
      <main className={`${ADMIN_MAIN_CLASS} text-[13px] text-adminMuted`}>加载中…</main>
    );
  }

  if (!store) {
    return (
      <main className={`${ADMIN_MAIN_CLASS}`}>
        <p className="text-[13px] text-adminMuted">{msg ?? "无数据"}</p>
        <button
          type="button"
          className="mt-4 rounded border border-adminLine px-3 py-1.5 text-[12px] text-adminFg transition hover:bg-ink/[0.05]"
          onClick={() => void load()}
        >
          重试
        </button>
      </main>
    );
  }

  return (
    <main className={`${ADMIN_MAIN_CLASS} text-adminFg`}>
      {msg ? (
        <p
          className={`mb-6 rounded-md border px-2.5 py-2 text-[12px] leading-snug ${
            msg.includes("已写入") || msg.includes("成功") || msg.includes("已完成")
              ? "border-emerald-600/25 bg-emerald-50 text-emerald-950"
              : "border-amber-600/25 bg-amber-50 text-amber-950"
          }`}
        >
          {msg}
        </p>
      ) : null}

      <header className="mb-10 border-b border-adminLine pb-6">
        <h1 className="text-[15px] font-medium tracking-tight text-adminFg">曲库与配图</h1>
        <p className="mt-1 max-w-prose text-[11px] leading-relaxed text-adminMuted">
          上传、曲目与背景图；写入 companion。自然全屏影片请至{" "}
          <Link href="/admin/music/nature" className="font-medium text-adminFg underline-offset-2 hover:underline">
            音乐 → 自然
          </Link>
          。
        </p>
      </header>

      <AdminMediaHub
        setStore={setStore}
        setMsg={setMsg}
        flushToDisk={flushToDisk}
        getStoreSnapshot={getStoreSnapshot}
        bumpPersistIgnore={bumpPersistIgnore}
      />
      <AudioTrackLibrary store={store} setStore={setStore} />
      <ImageBackgroundLibrary store={store} setStore={setStore} />
    </main>
  );
}

function AdminMediaHub({
  setStore,
  setMsg,
  flushToDisk,
  getStoreSnapshot,
  bumpPersistIgnore,
}: {
  setStore: React.Dispatch<React.SetStateAction<MusicCompanionStore | null>>;
  setMsg: React.Dispatch<React.SetStateAction<string | null>>;
  flushToDisk: (snapshot: MusicCompanionStore) => Promise<boolean>;
  getStoreSnapshot: () => MusicCompanionStore | null;
  bumpPersistIgnore: (ms?: number) => void;
}) {
  type UploadProgressState = {
    batchCur: number;
    batchTotal: number;
    fileName: string;
    fileUploadPct: number;
    awaitingServer: boolean;
  };

  const [uploadProgress, setUploadProgress] = useState<UploadProgressState | null>(null);
  const busy = uploadProgress !== null;
  const uploadInputId = useId();

  const runAudioUpload = useCallback(async (file: File, report: (p: UploadProgressPayload) => void) => {
    const fd = new FormData();
    fd.append("file", file);
    const headers = diskAuthHeaders() as Record<string, string>;
    const { status, bodyText } = await xhrPostFormData("/api/music/upload", fd, headers, report);
    const data = parseJsonFromBodyText(bodyText, status) as {
      ok?: boolean;
      url?: string;
      error?: string;
      transcoded?: boolean;
      bitrateK?: number | null;
      warning?: string;
      analysisUrl?: string;
    };
    if (status < 200 || status >= 300) {
      const err = typeof data.error === "string" ? data.error : `上传失败（${status}）`;
      throw new Error(err + disk403Hint(status, err));
    }
    const url = data.url;
    if (typeof url !== "string" || !url) {
      throw new Error("上传响应异常：缺少 url");
    }
    const analysisUrl =
      typeof data.analysisUrl === "string" && data.analysisUrl.trim() ? data.analysisUrl.trim() : undefined;
    report({ pct: 100, awaitingServer: false });
    return {
      url,
      transcoded: data.transcoded,
      bitrateK: data.bitrateK,
      warning: typeof data.warning === "string" ? data.warning : undefined,
      analysisUrl,
    };
  }, []);

  const runImageUpload = useCallback(async (file: File, report: (p: UploadProgressPayload) => void) => {
    const fd = new FormData();
    fd.append("file", file);
    const headers = diskAuthHeaders() as Record<string, string>;
    const { status, bodyText } = await xhrPostFormData("/api/music/upload-image", fd, headers, report);
    const data = parseJsonFromBodyText(bodyText, status) as { ok?: boolean; url?: string; error?: string };
    if (status < 200 || status >= 300) {
      const err = typeof data.error === "string" ? data.error : `上传失败（${status}）`;
      throw new Error(err + disk403Hint(status, err));
    }
    const url = data.url;
    if (typeof url !== "string" || !url) {
      throw new Error("上传响应异常：缺少 url");
    }
    report({ pct: 100, awaitingServer: false });
    return { url };
  }, []);

  const ingestAudio = useCallback(
    async (file: File, base: MusicCompanionStore) => {
      const report = ({ pct, awaitingServer }: UploadProgressPayload) => {
        setUploadProgress((s) => (s ? { ...s, fileUploadPct: pct, awaitingServer } : s));
      };
      const data = await runAudioUpload(file, report);
      const id = newTrackId();
      const title = nextDateNumberedMusicUploadTitle(base.audioTracks.map((t) => primaryLocaleText(t.title)));
      const nextSnap = withNewAudioTrack(base, {
        id,
        title,
        src: data.url,
        ...(data.analysisUrl ? { analysisSrc: data.analysisUrl } : {}),
      });
      setStore(nextSnap);
      bumpPersistIgnore();
      const ok = await flushToDisk(nextSnap);
      if (!ok) throw new Error("曲库写入失败");
      bumpPersistIgnore();
      return { next: nextSnap, data };
    },
    [bumpPersistIgnore, flushToDisk, runAudioUpload, setStore],
  );

  const ingestImage = useCallback(
    async (file: File, base: MusicCompanionStore): Promise<MusicCompanionStore> => {
      const report = ({ pct, awaitingServer }: UploadProgressPayload) => {
        setUploadProgress((s) => (s ? { ...s, fileUploadPct: pct, awaitingServer } : s));
      };
      const { url } = await runImageUpload(file, report);
      const id = newBackgroundId();
      const imageTitles = base.backgroundVisuals
        .filter((b) => b.type === "image")
        .map((b) => primaryLocaleText(b.title));
      const imgTitle = nextDateNumberedImageUploadTitle(imageTitles);
      const nextSnap = withNewImageBackground(base, { id, src: url, title: imgTitle });
      setStore(nextSnap);
      bumpPersistIgnore();
      const ok = await flushToDisk(nextSnap);
      if (!ok) throw new Error("曲库写入失败");
      bumpPersistIgnore();
      return nextSnap;
    },
    [bumpPersistIgnore, flushToDisk, runImageUpload, setStore],
  );

  const onMediaFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      const arr = files;
      const planned: { file: File; kind: "audio" | "image" }[] = [];
      const skipped: string[] = [];
      for (const f of arr) {
        const k = mediaKind(f);
        if (k) planned.push({ file: f, kind: k });
        else skipped.push(f.name);
      }
      if (planned.length === 0) {
        setMsg(skipped.length ? `不支持的类型：${skipped.join("、")}` : "未选择文件");
        return;
      }
      bumpPersistIgnore(Math.max(8000, 2000 + planned.length * 4000));
      setMsg(null);
      const skipTail = skipped.length ? ` 已跳过：${skipped.join("、")}` : "";
      let lastAudio:
        | {
            warning?: string;
            transcoded?: boolean;
            bitrateK?: number | null;
          }
        | undefined;
      let chain = getStoreSnapshot();
      if (!chain) {
        setMsg("无曲库数据");
        return;
      }
      try {
        for (let i = 0; i < planned.length; i++) {
          const { file, kind } = planned[i];
          setUploadProgress({
            batchCur: i + 1,
            batchTotal: planned.length,
            fileName: file.name,
            fileUploadPct: 0,
            awaitingServer: false,
          });
          if (kind === "audio") {
            const { next, data } = await ingestAudio(file, chain);
            chain = next;
            lastAudio = data;
          } else {
            chain = await ingestImage(file, chain);
          }
        }
        if (planned.length === 1 && planned[0].kind === "audio" && lastAudio) {
          const d = lastAudio;
          let base: string;
          if (d.warning) base = `${d.warning} 已写入。`;
          else if (d.transcoded && d.bitrateK) base = `已写入（约 ${d.bitrateK} kbps AAC）。`;
          else base = "已写入。";
          setMsg(base + skipTail);
        } else {
          setMsg(`已完成 ${planned.length} 个文件。${skipTail}`.trim());
        }
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "上传失败");
      } finally {
        setUploadProgress(null);
      }
    },
    [bumpPersistIgnore, getStoreSnapshot, ingestAudio, ingestImage, setMsg],
  );

  const labelMain =
    uploadProgress !== null
      ? `上传 ${uploadProgress.batchCur}/${uploadProgress.batchTotal}`
      : "上传";

  return (
    <section className="mt-10">
      <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-adminMuted">上传</h2>
      <p className="mt-2 max-w-prose text-[10px] leading-relaxed text-adminMuted">
        大文件或转码可能需数十秒；上传完成前请勿离开本页。若写入失败，请确认未禁用自动保存，且生产环境已配置磁盘写入密钥。
      </p>
      {uploadProgress ? (
        <div className="mt-3 rounded-md border border-adminLine bg-adminPanel/50 px-3 py-2.5">
          <p className="text-[11px] text-adminFg">
            <span className="font-medium">
              {uploadProgress.batchCur}/{uploadProgress.batchTotal}
            </span>{" "}
            <span className="break-all text-adminMuted">{uploadProgress.fileName}</span>
          </p>
          <p className="mt-1 text-[10px] text-adminMuted">
            {uploadProgress.awaitingServer ? "服务器处理中（转码 / 写盘 / 能量分析）…" : "正在上传到服务器…"}
          </p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-adminLine/55">
            <div
              className={`h-full rounded-full bg-adminFg/85 ${
                uploadProgress.awaitingServer ? "w-full animate-pulse motion-reduce:animate-none" : ""
              }`}
              style={
                uploadProgress.awaitingServer
                  ? undefined
                  : { width: `${Math.max(2, uploadProgress.fileUploadPct)}%` }
              }
            />
          </div>
          <p className="mt-1 text-[10px] tabular-nums text-adminMuted">
            {uploadProgress.awaitingServer && uploadProgress.fileUploadPct >= 100
              ? "—"
              : `${uploadProgress.fileUploadPct}%`}
          </p>
        </div>
      ) : null}
      <div className="mt-3 flex flex-col gap-2">
        <input
          id={uploadInputId}
          type="file"
          multiple
          accept="audio/*,image/*,.mp3,.m4a,.aac,.ogg,.opus,.wav,.webm,.flac,.jpg,.jpeg,.png,.webp,.gif"
          className="sr-only"
          disabled={busy}
          aria-label="上传音频或图片"
          onChange={(e) => {
            const input = e.target;
            const picked = input.files?.length ? Array.from(input.files) : [];
            input.value = "";
            if (picked.length) void onMediaFiles(picked);
          }}
        />
        <label
          htmlFor={uploadInputId}
          className={`relative flex min-h-[4rem] flex-col items-start justify-center overflow-hidden rounded-md border border-dashed border-border bg-canvas/70 px-3 py-3 text-left transition hover:border-border hover:bg-surface/80 ${busy ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
        >
          <span className="relative z-0 text-[11px] font-medium text-adminFg">{labelMain}</span>
          <span className="relative z-0 mt-1 text-[10px] text-adminMuted">点击此区域或下方按钮选择文件</span>
        </label>
        <label
          htmlFor={uploadInputId}
          className={`self-start rounded-md border border-adminLine bg-adminPanel px-2.5 py-1.5 text-[11px] text-adminFg transition hover:bg-surface ${busy ? "pointer-events-none cursor-not-allowed opacity-40" : "cursor-pointer"}`}
        >
          选择文件…
        </label>
      </div>
    </section>
  );
}

function AudioTrackLibrary({
  store,
  setStore,
}: {
  store: MusicCompanionStore;
  setStore: React.Dispatch<React.SetStateAction<MusicCompanionStore | null>>;
}) {
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);

  useEffect(() => {
    const el = previewAudioRef.current;
    if (!el) return;
    const sync = () => setPreviewPlaying(!el.paused);
    const onEnded = () => {
      setPreviewTrackId(null);
      setPreviewPlaying(false);
    };
    el.addEventListener("play", sync);
    el.addEventListener("pause", sync);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("play", sync);
      el.removeEventListener("pause", sync);
      el.removeEventListener("ended", onEnded);
    };
  }, []);

  useEffect(() => {
    if (!previewTrackId) return;
    const still = store.audioTracks.some((t) => t.id === previewTrackId);
    if (still) return;
    const el = previewAudioRef.current;
    if (el) {
      el.pause();
      el.removeAttribute("src");
      el.load();
    }
    setPreviewTrackId(null);
    setPreviewPlaying(false);
  }, [store.audioTracks, previewTrackId]);

  const togglePreview = useCallback((t: (typeof store.audioTracks)[number]) => {
    const src = t.src?.trim();
    if (!src) return;
    const el = previewAudioRef.current;
    if (!el) return;
    if (previewTrackId === t.id) {
      if (el.paused) void el.play().catch(() => setPreviewPlaying(false));
      else el.pause();
      return;
    }
    el.pause();
    el.src = src;
    setPreviewTrackId(t.id);
    void el.play().catch(() => {
      setPreviewTrackId(null);
      setPreviewPlaying(false);
    });
  }, [previewTrackId]);

  const moveTrack = useCallback(
    (index: number, delta: -1 | 1) => {
      setStore((s) => {
        if (!s) return s;
        const next = [...s.audioTracks];
        const j = index + delta;
        if (j < 0 || j >= next.length) return s;
        const tmp = next[index];
        next[index] = next[j]!;
        next[j] = tmp!;
        return { ...s, audioTracks: next };
      });
    },
    [setStore],
  );

  const [bulkPrefix, setBulkPrefix] = useState("");
  const [bulkSuffix, setBulkSuffix] = useState("");
  const [bulkStem, setBulkStem] = useState("音乐");

  const applyBulkPrefix = useCallback(() => {
    const p = bulkPrefix.trim();
    if (!p) return;
    setStore((s) =>
      s
        ? {
            ...s,
            audioTracks: s.audioTracks.map((x) => ({
              ...x,
              title: `${p}${primaryLocaleText(x.title)}`.trim(),
            })),
          }
        : s,
    );
  }, [bulkPrefix, setStore]);

  const applyBulkSuffix = useCallback(() => {
    const suf = bulkSuffix.trim();
    if (!suf) return;
    setStore((s) =>
      s
        ? {
            ...s,
            audioTracks: s.audioTracks.map((x) => ({
              ...x,
              title: `${primaryLocaleText(x.title)}${suf}`.trim(),
            })),
          }
        : s,
    );
  }, [bulkSuffix, setStore]);

  const applyBulkNumbered = useCallback(() => {
    const stem = bulkStem.trim() || "音乐";
    setStore((s) =>
      s
        ? {
            ...s,
            audioTracks: s.audioTracks.map((x, i) => ({
              ...x,
              title: `${stem} · ${String(i + 1).padStart(2, "0")}`,
            })),
          }
        : s,
    );
  }, [bulkStem, setStore]);

  const lastIdx = store.audioTracks.length - 1;

  return (
    <section className="mt-10">
      <audio
        ref={previewAudioRef}
        preload="metadata"
        className="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0"
        aria-hidden
      />
      <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-adminMuted">曲目</h2>
      {store.audioTracks.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-end gap-x-2 gap-y-1.5 border-y border-adminLine bg-canvas/70 px-2 py-2 text-[11px]">
          <label className="flex min-w-[5.5rem] max-w-[10rem] flex-1 flex-col gap-0.5 text-adminMuted">
            前缀
            <input
              className="rounded border border-border bg-adminPanel px-1.5 py-1 text-[12px] text-adminFg"
              value={bulkPrefix}
              onChange={(e) => setBulkPrefix(e.target.value)}
              placeholder="加到每条前"
            />
          </label>
          <button
            type="button"
            className="shrink-0 rounded border border-adminLine bg-adminPanel px-2 py-1 text-adminFg transition hover:bg-surface"
            onClick={applyBulkPrefix}
          >
            加前
          </button>
          <label className="flex min-w-[5.5rem] max-w-[10rem] flex-1 flex-col gap-0.5 text-adminMuted">
            后缀
            <input
              className="rounded border border-border bg-adminPanel px-1.5 py-1 text-[12px] text-adminFg"
              value={bulkSuffix}
              onChange={(e) => setBulkSuffix(e.target.value)}
              placeholder="加到每条后"
            />
          </label>
          <button
            type="button"
            className="shrink-0 rounded border border-adminLine bg-adminPanel px-2 py-1 text-adminFg transition hover:bg-surface"
            onClick={applyBulkSuffix}
          >
            加后
          </button>
          <label className="flex min-w-[5.5rem] max-w-[8rem] flex-col gap-0.5 text-adminMuted">
            统一名
            <input
              className="rounded border border-border bg-adminPanel px-1.5 py-1 text-[12px] text-adminFg"
              value={bulkStem}
              onChange={(e) => setBulkStem(e.target.value)}
              placeholder="音乐"
            />
          </label>
          <button
            type="button"
            className="shrink-0 rounded border border-adminLine bg-adminPanel px-2 py-1 text-adminFg transition hover:bg-surface"
            onClick={applyBulkNumbered}
          >
            编号
          </button>
        </div>
      ) : null}
      <ul className="mt-2 divide-y divide-adminLine border-y border-adminLine">
        {store.audioTracks.length === 0 ? (
          <li className="px-3 py-8 text-[12px] text-adminMuted">暂无曲目</li>
        ) : (
          store.audioTracks.map((t, i) => (
            <li key={t.id} className="px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  aria-label="标题"
                  className="min-w-0 flex-1 basis-[12rem] rounded border border-border bg-adminPanel px-2 py-1.5 text-[13px] text-adminFg"
                  value={primaryLocaleText(t.title)}
                  placeholder="（无标题）"
                  onChange={(e) => {
                    const v = e.target.value;
                    setStore((s) =>
                      s
                        ? {
                            ...s,
                            audioTracks: s.audioTracks.map((x, j) =>
                              j === i ? { ...x, title: v } : x,
                            ),
                          }
                        : s,
                    );
                  }}
                />
                <div className="flex shrink-0 flex-wrap items-center gap-1">
                  <button
                    type="button"
                    disabled={!t.src?.trim()}
                    title={!t.src?.trim() ? "缺少音频地址（src）" : undefined}
                    className="rounded border border-adminLine bg-adminPanel px-2 py-1 text-[11px] text-adminFg transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                    aria-pressed={previewTrackId === t.id && previewPlaying}
                    onClick={() => togglePreview(t)}
                  >
                    {!t.src?.trim()
                      ? "试听"
                      : previewTrackId === t.id
                        ? previewPlaying
                          ? "暂停"
                          : "继续"
                        : "试听"}
                  </button>
                  <button
                    type="button"
                    disabled={i <= 0}
                    className="rounded border border-adminLine bg-adminPanel px-2 py-1 text-[11px] text-adminFg transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={() => moveTrack(i, -1)}
                  >
                    上移
                  </button>
                  <button
                    type="button"
                    disabled={i >= lastIdx}
                    className="rounded border border-adminLine bg-adminPanel px-2 py-1 text-[11px] text-adminFg transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={() => moveTrack(i, 1)}
                  >
                    下移
                  </button>
                  <button
                    type="button"
                    className="px-2 py-1 text-[11px] text-red-700/90 transition hover:bg-red-50"
                    onClick={() => {
                      const trackId = t.id;
                      setStore((s) =>
                        s
                          ? {
                              ...s,
                              audioTracks: s.audioTracks.filter((x) => x.id !== trackId),
                              scenes: s.scenes.map((sc) =>
                                sc.audioTrackId === trackId ? { ...sc, audioTrackId: null } : sc,
                              ),
                            }
                          : s,
                      );
                    }}
                  >
                    删除
                  </button>
                </div>
              </div>
              <details className="mt-1.5 text-[11px]">
                <summary className="cursor-pointer select-none text-adminMuted hover:text-adminFg/70">编辑</summary>
                <div className="mt-2 space-y-2 border-t border-adminLine pt-2">
                  <label className="block text-[10px] text-adminMuted">
                    备注
                    <textarea
                      className="mt-0.5 w-full resize-y rounded border border-border bg-adminPanel px-2 py-1.5 text-[12px] text-adminFg"
                      rows={2}
                      placeholder="可选"
                      value={primaryLocaleText(t.remark)}
                      onChange={(e) => {
                        const v = e.target.value;
                        setStore((s) =>
                          s
                            ? {
                                ...s,
                                audioTracks: s.audioTracks.map((x, j) =>
                                  j === i ? { ...x, remark: v === "" ? undefined : v } : x,
                                ),
                              }
                            : s,
                        );
                      }}
                    />
                  </label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="block text-[10px] text-adminMuted">
                      id
                      <input
                        className="mt-0.5 w-full rounded border border-border bg-adminPanel px-2 py-1 font-mono text-[11px]"
                        value={t.id}
                        onChange={(e) => {
                          const v = e.target.value;
                          setStore((s) =>
                            s
                              ? {
                                  ...s,
                                  audioTracks: s.audioTracks.map((x, j) =>
                                    j === i ? { ...x, id: v } : x,
                                  ),
                                }
                              : s,
                          );
                        }}
                      />
                    </label>
                    <label className="block text-[10px] text-adminMuted sm:col-span-2">
                      src
                      <input
                        className="mt-0.5 w-full rounded border border-border bg-adminPanel px-2 py-1 font-mono text-[11px]"
                        value={t.src}
                        onChange={(e) => {
                          const v = e.target.value;
                          setStore((s) =>
                            s
                              ? {
                                  ...s,
                                  audioTracks: s.audioTracks.map((x, j) =>
                                    j === i ? { ...x, src: v } : x,
                                  ),
                                }
                              : s,
                          );
                        }}
                      />
                    </label>
                    <label className="block text-[10px] text-adminMuted sm:col-span-2">
                      艺人（可选）
                      <input
                        className="mt-0.5 w-full rounded border border-border bg-adminPanel px-2 py-1 text-[12px]"
                        value={primaryLocaleText(t.artist)}
                        onChange={(e) => {
                          const v = e.target.value;
                          setStore((s) =>
                            s
                              ? {
                                  ...s,
                                  audioTracks: s.audioTracks.map((x, j) =>
                                    j === i
                                      ? {
                                          ...x,
                                          artist: v.trim() === "" ? undefined : v,
                                        }
                                      : x,
                                  ),
                                }
                              : s,
                          );
                        }}
                      />
                    </label>
                  </div>
                </div>
              </details>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

function ImageBackgroundLibrary({
  store,
  setStore,
}: {
  store: MusicCompanionStore;
  setStore: React.Dispatch<React.SetStateAction<MusicCompanionStore | null>>;
}) {
  const rows = store.backgroundVisuals.filter((b) => b.type === "image");

  return (
    <section className="mt-10">
      <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-adminMuted">图片</h2>
      <ul className="mt-3 divide-y divide-adminLine border-y border-adminLine">
        {rows.length === 0 ? (
          <li className="px-3 py-8 text-[12px] text-adminMuted">暂无图片</li>
        ) : (
          rows.map((b) => {
            const fileHint = (b.imageSrc ?? "").split("/").pop() ?? "";
            const label =
              primaryLocaleText(b.title) || titleFromUploadFileName(fileHint || "image");
            return (
              <li key={b.id} className="flex items-center gap-3 px-3 py-2">
                {b.imageSrc ? (
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded border border-adminLine">
                    <Image
                      src={b.imageSrc}
                      alt=""
                      fill
                      sizes="44px"
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-surface/90 text-[10px] text-adminMuted">
                    —
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-adminFg">{label}</p>
                </div>
                <button
                  type="button"
                  className="shrink-0 px-2 py-1 text-[11px] text-red-700/90 transition hover:bg-red-50"
                  onClick={() => {
                    const bgId = b.id;
                    setStore((s) =>
                      s
                        ? {
                            ...s,
                            backgroundVisuals: s.backgroundVisuals.filter((x) => x.id !== bgId),
                            scenes: s.scenes.map((sc) =>
                              sc.backgroundVisualId === bgId ? { ...sc, backgroundVisualId: null } : sc,
                            ),
                          }
                        : s,
                    );
                  }}
                >
                  删除
                </button>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}

