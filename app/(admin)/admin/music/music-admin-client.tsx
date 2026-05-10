"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  newBackgroundId,
  newTrackId,
  nextDateNumberedImageUploadTitle,
  nextDateNumberedMusicUploadTitle,
  titleFromUploadFileName,
} from "@/lib/music-companion/track-naming";
import type { MusicCompanionStore } from "@/lib/music-companion/types";
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
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok) {
      return { ok: false, error: data.error ?? `写入失败（${res.status}）` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "写入请求失败" };
  }
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

  const load = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/music/companion");
      const data = (await res.json()) as MusicCompanionStore | { error?: string };
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
          上传、曲目与背景图；写入 companion。
        </p>
      </header>

      <AdminMediaHub setStore={setStore} setMsg={setMsg} flushToDisk={flushToDisk} />
      <AudioTrackLibrary store={store} setStore={setStore} />
      <ImageBackgroundLibrary store={store} setStore={setStore} />

      <section className="mt-12 border-t border-adminLine pt-8">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-adminMuted">播放视觉</h2>
        <p className="mt-2 max-w-prose text-[11px] leading-relaxed text-adminMuted">
          滑杆、首页氛围、引擎预设、实时 drive 与导入导出见侧栏{" "}
          <strong className="font-medium text-adminFg">播放视觉</strong>
          。
        </p>
        <Link
          href="/admin/visual"
          className="mt-4 inline-block border-b border-adminFg/40 pb-0.5 text-[12px] font-medium text-adminFg transition hover:border-adminFg"
        >
          打开播放视觉 →
        </Link>
      </section>
    </main>
  );
}

function AdminMediaHub({
  setStore,
  setMsg,
  flushToDisk,
}: {
  setStore: React.Dispatch<React.SetStateAction<MusicCompanionStore | null>>;
  setMsg: React.Dispatch<React.SetStateAction<string | null>>;
  flushToDisk: (snapshot: MusicCompanionStore) => Promise<boolean>;
}) {
  const [uploadProgress, setUploadProgress] = useState<{ cur: number; total: number } | null>(null);
  const busy = uploadProgress !== null;

  const runAudioUpload = useCallback(async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/music/upload", {
      method: "POST",
      headers: { ...diskAuthHeaders() },
      body: fd,
    });
    const data = (await res.json()) as {
      ok?: boolean;
      url?: string;
      error?: string;
      transcoded?: boolean;
      bitrateK?: number | null;
      warning?: string;
      analysisUrl?: string;
    };
    if (!res.ok) {
      throw new Error(data.error ?? `上传失败（${res.status}）`);
    }
    const url = data.url;
    if (typeof url !== "string" || !url) {
      throw new Error("上传响应异常");
    }
    const analysisUrl =
      typeof data.analysisUrl === "string" && data.analysisUrl.trim() ? data.analysisUrl.trim() : undefined;
    return {
      url,
      transcoded: data.transcoded,
      bitrateK: data.bitrateK,
      warning: data.warning,
      analysisUrl,
    };
  }, []);

  const runImageUpload = useCallback(async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/music/upload-image", {
      method: "POST",
      headers: { ...diskAuthHeaders() },
      body: fd,
    });
    const data = (await res.json()) as { ok?: boolean; url?: string; error?: string };
    if (!res.ok) {
      throw new Error(data.error ?? `上传失败（${res.status}）`);
    }
    const url = data.url;
    if (typeof url !== "string" || !url) {
      throw new Error("上传响应异常");
    }
    return { url };
  }, []);

  const ingestAudio = useCallback(
    async (file: File) => {
      const data = await runAudioUpload(file);
      const id = newTrackId();
      let nextSnap: MusicCompanionStore | null = null;
      setStore((s) => {
        if (!s) return s;
        const title = nextDateNumberedMusicUploadTitle(s.audioTracks.map((t) => t.title ?? ""));
        nextSnap = withNewAudioTrack(s, {
          id,
          title,
          src: data.url,
          ...(data.analysisUrl ? { analysisSrc: data.analysisUrl } : {}),
        });
        return nextSnap;
      });
      if (!nextSnap) throw new Error("无曲库数据");
      const ok = await flushToDisk(nextSnap);
      if (!ok) throw new Error("曲库写入失败");
      return data;
    },
    [flushToDisk, runAudioUpload, setStore],
  );

  const ingestImage = useCallback(
    async (file: File) => {
      const { url } = await runImageUpload(file);
      const id = newBackgroundId();
      let nextSnap: MusicCompanionStore | null = null;
      setStore((s) => {
        if (!s) return s;
        const imageTitles = s.backgroundVisuals
          .filter((b) => b.type === "image")
          .map((b) => b.title ?? "");
        const imgTitle = nextDateNumberedImageUploadTitle(imageTitles);
        nextSnap = withNewImageBackground(s, { id, src: url, title: imgTitle });
        return nextSnap;
      });
      if (!nextSnap) throw new Error("无曲库数据");
      const ok = await flushToDisk(nextSnap);
      if (!ok) throw new Error("曲库写入失败");
    },
    [flushToDisk, runImageUpload, setStore],
  );

  const onMediaFiles = useCallback(
    async (list: FileList | null) => {
      if (!list?.length) return;
      const arr = Array.from(list);
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
      setMsg(null);
      setUploadProgress({ cur: 0, total: planned.length });
      const skipTail = skipped.length ? ` 已跳过：${skipped.join("、")}` : "";
      let lastAudio:
        | {
            warning?: string;
            transcoded?: boolean;
            bitrateK?: number | null;
          }
        | undefined;
      try {
        for (let i = 0; i < planned.length; i++) {
          setUploadProgress({ cur: i + 1, total: planned.length });
          const { file, kind } = planned[i];
          if (kind === "audio") {
            lastAudio = await ingestAudio(file);
          } else {
            await ingestImage(file);
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
    [ingestAudio, ingestImage, setMsg],
  );

  const labelMain =
    uploadProgress !== null
      ? `上传中 ${uploadProgress.cur}/${uploadProgress.total}`
      : "上传";

  return (
    <section className="mt-10">
      <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-adminMuted">上传</h2>
      <label className="mt-3 flex min-h-[4rem] cursor-pointer flex-col items-start justify-center border border-dashed border-border bg-canvas/70 px-3 py-3 text-left transition hover:border-border hover:bg-surface/80">
        <span className="text-[11px] font-medium text-adminFg">{labelMain}</span>
        <input
          type="file"
          multiple
          accept="audio/*,image/*,.mp3,.m4a,.aac,.ogg,.opus,.wav,.webm,.flac,.jpg,.jpeg,.png,.webp,.gif"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const fs = e.target.files;
            e.target.value = "";
            if (fs?.length) void onMediaFiles(fs);
          }}
        />
      </label>
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
              title: `${p}${x.title ?? ""}`.trim(),
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
              title: `${x.title ?? ""}${suf}`.trim(),
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

  return (
    <section className="mt-10">
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
              <div className="flex items-center gap-2">
                <input
                  aria-label="标题"
                  className="min-w-0 flex-1 rounded border border-border bg-adminPanel px-2 py-1.5 text-[13px] text-adminFg"
                  value={t.title}
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
                <button
                  type="button"
                  className="shrink-0 px-2 py-1 text-[11px] text-red-700/90 transition hover:bg-red-50"
                  onClick={() =>
                    setStore((s) =>
                      s
                        ? {
                            ...s,
                            audioTracks: s.audioTracks.filter((_, j) => j !== i),
                          }
                        : s,
                    )
                  }
                >
                  删除
                </button>
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
                      value={t.remark ?? ""}
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
                        value={t.artist ?? ""}
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
  const rows = store.backgroundVisuals
    .map((b, index) => ({ b, index }))
    .filter(({ b }) => b.type === "image");

  return (
    <section className="mt-10">
      <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-adminMuted">图片</h2>
      <ul className="mt-3 divide-y divide-adminLine border-y border-adminLine">
        {rows.length === 0 ? (
          <li className="px-3 py-8 text-[12px] text-adminMuted">暂无图片</li>
        ) : (
          rows.map(({ b, index }) => {
            const fileHint = (b.imageSrc ?? "").split("/").pop() ?? "";
            const label =
              b.title?.trim() || titleFromUploadFileName(fileHint || "image");
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
                  onClick={() =>
                    setStore((s) =>
                      s
                        ? {
                            ...s,
                            backgroundVisuals: s.backgroundVisuals.filter((_, j) => j !== index),
                          }
                        : s,
                    )
                  }
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

