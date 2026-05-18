"use client";

import { forwardRef, useCallback, useImperativeHandle, useState } from "react";
import { InfoEditionCompareMarkdown } from "@/components/admin/InfoEditionCompareMarkdown";
import type { InfoEditionReaderVariant } from "@/lib/bible/info-edition-v1-publish";

export type ReaderProbePayload = {
  variant: InfoEditionReaderVariant;
  variantLabel: string;
  editionKind: string;
  roleLabel: string;
  roleId: string;
  roleHint: string;
  profileName: string;
  bookName: string;
  chapter: number;
  translation: string;
  model: string;
  baseUrl: string;
  maxTokens: number;
  descriptionRulesCharCount: number;
  systemCharCount: number;
  userCharCount: number;
  messages: { role: string; content: string }[];
};

export type OutputValidationCheck = {
  id: string;
  level: "error" | "warn";
  message: string;
};

export type OutputValidation = {
  ok: boolean;
  charCount: number;
  checks: OutputValidationCheck[];
  errorCount: number;
  warnCount: number;
};

export type ReaderGenerateResponse = {
  ok: boolean;
  error?: string;
  previewOnly?: boolean;
  published?: boolean;
  probe?: ReaderProbePayload;
  outputValidation?: OutputValidation;
  generation?: {
    text: string;
    charCount: number;
    generationRoleLabel: string;
    error?: string;
  };
};

export type InfoEditionReaderProbeHandle = {
  /** 仅加载 API 投送预览，不调用模型 */
  previewInfo: () => void;
  previewGuide: () => void;
};

type Props = {
  bookId: string;
  chapter: number;
  descriptionRules: string;
  disabled?: boolean;
  ie: (key: string, vars?: Record<string, string>) => string;
  diskHeaders: HeadersInit;
  onResult?: (res: ReaderGenerateResponse) => void;
};

const tabOn =
  "rounded border border-adminFg/30 bg-adminFg/[0.12] px-2 py-0.5 text-[10px] font-medium text-adminFg";
const tabOff =
  "rounded border border-transparent px-2 py-0.5 text-[10px] text-adminMuted hover:text-adminFg";

export const InfoEditionReaderProbePanel = forwardRef<InfoEditionReaderProbeHandle, Props>(
  function InfoEditionReaderProbePanel(
    { bookId, chapter, descriptionRules, disabled, ie, diskHeaders, onResult },
    ref,
  ) {
  const [loadingPreview, setLoadingPreview] = useState<InfoEditionReaderVariant | null>(null);
  const [generating, setGenerating] = useState(false);
  const [activeVariant, setActiveVariant] = useState<InfoEditionReaderVariant | null>(null);
  const [publish, setPublish] = useState(false);
  const [msgTab, setMsgTab] = useState<"system" | "user">("system");
  const [preview, setPreview] = useState<ReaderGenerateResponse | null>(null);
  const [result, setResult] = useState<ReaderGenerateResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const fetchPayload = useCallback(
    async (variant: InfoEditionReaderVariant, previewOnly: boolean) => {
      const res = await fetch("/api/admin/bible/info-edition-v1/reader-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...diskHeaders },
        body: JSON.stringify({
          bookId,
          chapter,
          variant,
          descriptionRules,
          previewOnly,
          publish: previewOnly ? false : publish,
        }),
      });
      const j = (await res.json()) as ReaderGenerateResponse & {
        error?: string;
        probe?: ReaderProbePayload;
      };
      if (!res.ok || !j.ok) {
        const e = typeof j.error === "string" ? j.error : ie("readerGenerateFailed");
        throw new Error(e);
      }
      return j;
    },
    [bookId, chapter, descriptionRules, diskHeaders, ie, publish],
  );

  const loadPreview = useCallback(
    async (variant: InfoEditionReaderVariant) => {
      setLoadingPreview(variant);
      setErr(null);
      setResult(null);
      setActiveVariant(variant);
      try {
        const j = await fetchPayload(variant, true);
        setPreview(j);
        setMsgTab("system");
      } catch (e) {
        setPreview(null);
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setLoadingPreview(null);
      }
    },
    [fetchPayload],
  );

  const confirmGenerate = useCallback(async () => {
    if (!activeVariant) return;
    setGenerating(true);
    setErr(null);
    try {
      const j = await fetchPayload(activeVariant, false);
      setResult(j);
      onResult?.(j);
      if (j.probe) setMsgTab("user");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }, [activeVariant, fetchPayload, onResult]);

  useImperativeHandle(
    ref,
    () => ({
      previewInfo: () => void loadPreview("info"),
      previewGuide: () => void loadPreview("guide"),
    }),
    [loadPreview],
  );

  const probe = preview?.probe ?? result?.probe;
  const systemMsg = probe?.messages.find((m) => m.role === "system")?.content ?? "";
  const userMsg = probe?.messages.find((m) => m.role === "user")?.content ?? "";
  const btnClass =
    "shrink-0 rounded border border-adminLine/80 bg-adminBg/60 px-2.5 py-1 text-[11px] font-medium text-adminFg transition hover:bg-adminFg/[0.08] disabled:cursor-not-allowed disabled:opacity-45";
  const busy = disabled || Boolean(loadingPreview) || generating;

  return (
    <div
      id="info-edition-reader-probe"
      className="space-y-2 rounded border border-dashed border-adminFg/20 bg-adminFg/[0.04] p-2.5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-wide text-adminMuted">{ie("readerProbeTitle")}</span>
        <button
          type="button"
          disabled={busy}
          onClick={() => void loadPreview("info")}
          className={`${btnClass} ${activeVariant === "info" ? "border-adminFg/35 bg-adminFg/[0.14] font-semibold" : ""}`}
        >
          {loadingPreview === "info" ? ie("readerLoadingPayload") : ie("readerViewPayloadInfo")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void loadPreview("guide")}
          className={`${btnClass} ${activeVariant === "guide" ? "border-adminFg/35 bg-adminFg/[0.14] font-semibold" : ""}`}
        >
          {loadingPreview === "guide" ? ie("readerLoadingPayload") : ie("readerViewPayloadGuide")}
        </button>
      </div>

      <p className="text-[10px] leading-relaxed text-adminMuted">{ie("readerProbeTwoStepHint")}</p>
      <p className="text-[10px] font-medium text-adminFg/80">{ie("readerProbePayloadNote")}</p>

      {err ? <p className="text-[11px] text-red-700 dark:text-red-300">{err}</p> : null}

      {probe ? (
        <div className="space-y-2 border-t border-adminLine/40 pt-2">
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-adminMuted">
            <span>
              {probe.bookName} {probe.chapter}章 · {probe.editionKind} · 角色「{probe.roleLabel}」
            </span>
            <span>
              {probe.model} · {probe.baseUrl}
            </span>
            <span>
              system {probe.systemCharCount} 字 · user {probe.userCharCount} 字
              {probe.variant === "info"
                ? ` · 描述规则 ${probe.descriptionRulesCharCount} 字`
                : " · 发现版不使用下方描述规则框"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setMsgTab("system")} className={msgTab === "system" ? tabOn : tabOff}>
              system
            </button>
            <button type="button" onClick={() => setMsgTab("user")} className={msgTab === "user" ? tabOn : tabOff}>
              user
            </button>
            <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[10px] text-adminMuted">
              <input
                type="checkbox"
                checked={publish}
                onChange={(e) => setPublish(e.target.checked)}
                className="rounded border-adminLine"
              />
              {ie("readerPublishCheckbox")}
            </label>
          </div>

          <pre className="max-h-[min(42vh,420px)] overflow-auto rounded border border-adminLine/50 bg-adminBg/80 p-2 text-[10px] leading-relaxed whitespace-pre-wrap text-adminFg">
            {msgTab === "system" ? systemMsg : userMsg}
          </pre>

          <div className="flex flex-wrap items-center gap-2 border-t border-adminLine/40 pt-2">
            <button
              type="button"
              disabled={busy || !preview?.probe}
              onClick={() => void confirmGenerate()}
              className="shrink-0 rounded border border-adminFg/40 bg-adminFg px-4 py-1.5 text-[12px] font-semibold text-adminBg shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {generating ? ie("readerGenerating") : ie("readerConfirmGenerate")}
            </button>
            {!result?.generation?.text ? (
              <span className="text-[10px] text-adminMuted">{ie("readerConfirmGenerateHint")}</span>
            ) : null}
          </div>

          {result?.generation?.text ? (
            <div>
              <p className="mb-1 text-[10px] font-medium text-adminMuted">
                {ie("readerOutputTitle")}（{result.generation.charCount} 字）
                {result.published ? ` · ${ie("readerPublishedYes")}` : ` · ${ie("readerPublishedNo")}`}
              </p>
              {result.outputValidation ? (
                <div
                  className={`mb-2 rounded border px-2 py-1.5 text-[10px] leading-relaxed ${
                    result.outputValidation.ok
                      ? result.outputValidation.warnCount > 0
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100"
                        : "border-emerald-500/35 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100"
                      : "border-red-500/40 bg-red-500/10 text-red-900 dark:text-red-100"
                  }`}
                >
                  <p className="font-medium">
                    {result.outputValidation.ok
                      ? result.outputValidation.warnCount > 0
                        ? ie("readerOutputCheckWarn")
                        : ie("readerOutputCheckOk")
                      : ie("readerOutputCheckFail")}
                  </p>
                  {result.outputValidation.checks.length > 0 ? (
                    <ul className="mt-1 list-inside list-disc space-y-0.5 opacity-90">
                      {result.outputValidation.checks.map((c) => (
                        <li key={c.id}>
                          {c.level === "error" ? "✕ " : "△ "}
                          {c.message}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
              <div className="max-h-[min(50vh,480px)] overflow-auto rounded border border-adminLine/50 bg-white/50 p-3 dark:bg-black/20">
                <InfoEditionCompareMarkdown content={result.generation.text} />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
},
);
