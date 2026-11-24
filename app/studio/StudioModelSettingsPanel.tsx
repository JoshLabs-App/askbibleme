"use client";

import { CONNECTION_TEMPLATES, KNOWN_PRESET_CODES } from "@/lib/ai";
import {
  docHistorySourceLabel,
  studioDocCharCount,
  type DocHistoryEntry,
} from "@/lib/studio-doc-history";
import type { StudioAiProfilesController } from "./use-studio-ai-profiles";

type StudioPersistenceAndHistoryDrawersProps = {
  diskBearerDraft: string;
  onChangeDiskBearerDraft: (value: string) => void;
  onBlurDiskBearerDraft: () => void;
  activeHistoryEntries: DocHistoryEntry[];
  onRestoreDocHistoryEntry: (entry: DocHistoryEntry) => void;
};

/**
 * 中栏底部的磁盘写入密钥抽屉与修订历史快照抽屉（保持原 Studio DOM 与交互 100% 一致）
 */
export function StudioPersistenceAndHistoryDrawers({
  diskBearerDraft,
  onChangeDiskBearerDraft,
  onBlurDiskBearerDraft,
  activeHistoryEntries,
  onRestoreDocHistoryEntry,
}: StudioPersistenceAndHistoryDrawersProps) {
  return (
    <>
      <div className="border-t border-border px-4 py-1.5 text-[10px] leading-snug text-muted">
        <p>
          优先写入 Git 中的 <span className="font-mono">docs/</span>；失败时仍保留浏览器副本。
        </p>
        <details className="mt-1.5">
          <summary className="cursor-pointer text-[10px] text-muted hover:text-ink/80">
            使用 next start 时写磁盘（可选）
          </summary>
          <p className="mt-1 text-[10px] leading-snug">
            在 <span className="font-mono">.env.local</span> 设置{" "}
            <span className="font-mono">STUDIO_ALLOW_DISK_SAVE=1</span> 与{" "}
            <span className="font-mono">STUDIO_WRITE_SECRET</span>
            ，将同一密钥填入下方并失焦保存；普通{" "}
            <span className="font-mono">npm run dev</span> 无需填写。
          </p>
          <input
            type="password"
            className="mt-1 w-full max-w-md rounded border border-border bg-canvas px-2 py-1 font-mono text-[10px] text-ink outline-none focus:border-sand"
            placeholder="STUDIO_WRITE_SECRET（仅存本机浏览器）"
            value={diskBearerDraft}
            onChange={(e) => onChangeDiskBearerDraft(e.target.value)}
            onBlur={onBlurDiskBearerDraft}
            autoComplete="off"
          />
        </details>
      </div>

      <details className="group shrink-0 border-t border-border/50 bg-canvas/40 px-4 py-1">
        <summary className="cursor-pointer list-none py-0.5 text-[9px] text-muted/80 marker:content-none [&::-webkit-details-marker]:hidden hover:text-muted">
          <span className="tracking-wide">修订快照</span>
          {activeHistoryEntries.length > 0 ? (
            <span className="ml-1.5 font-mono tabular-nums text-muted/60">
              {activeHistoryEntries.length}
            </span>
          ) : (
            <span className="ml-1 text-muted/50">（空）</span>
          )}
        </summary>
        <p className="mt-1 border-t border-border/30 pt-1 text-[8px] leading-snug text-muted/70">
          停顿约 2 秒或离开编辑区记「自动记录」；点保存记「已保存」。极少需要时点「恢复」。
        </p>
        <ul className="mt-1 max-h-28 space-y-px overflow-y-auto pb-1 font-mono text-[9px] leading-tight">
          {activeHistoryEntries.length === 0 ? (
            <li className="text-muted/60">暂无</li>
          ) : (
            activeHistoryEntries.map((e) => (
              <li
                key={e.entryId}
                className="flex items-center gap-1.5 py-0.5 text-muted hover:bg-canvas/50"
              >
                <span className="shrink-0">
                  {e.at.slice(0, 16).replace("T", " ")}
                </span>
                <span
                  className={
                    e.source === "saved"
                      ? "shrink-0 text-ink/75"
                      : "shrink-0 text-muted/80"
                  }
                >
                  {docHistorySourceLabel(e.source)}
                </span>
                <span className="min-w-0 shrink truncate text-muted/70">
                  {studioDocCharCount(e.body)}字
                </span>
                <button
                  type="button"
                  className="ml-auto shrink-0 rounded px-1 text-[9px] text-ink/80 underline-offset-2 hover:text-ink hover:underline"
                  onClick={() => onRestoreDocHistoryEntry(e)}
                >
                  恢复
                </button>
              </li>
            ))
          )}
        </ul>
      </details>
    </>
  );
}

type StudioModelSettingsPanelProps = {
  ai: StudioAiProfilesController;
};

/**
 * 可复用模型连接配置抽屉面板（对接 useStudioAiProfiles：预设码、模板、本机扫描与保存）
 */
export function StudioModelSettingsPanel({ ai }: StudioModelSettingsPanelProps) {
  return (
    <div className="space-y-2 border-t border-border bg-surface/40 px-4 py-3 text-[11px] text-ink">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={ai.bundle.activeProfileId ?? ""}
          onChange={(e) => ai.onSelectProfile(e.target.value)}
          className="min-w-[10rem] flex-1 rounded border border-border bg-canvas px-2 py-1 text-[11px] text-ink outline-none focus:border-sand"
          aria-label="已保存的模型连接"
        >
          <option value="">未选择连接</option>
          {ai.bundle.profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={ai.createNewProfile}
          className="rounded border border-border bg-canvas px-2 py-1 text-[10px] text-muted transition hover:border-sand hover:text-ink"
        >
          新建
        </button>
        <button
          type="button"
          onClick={ai.deleteCurrentProfile}
          disabled={!ai.bundle.activeProfileId}
          className="rounded border border-border bg-canvas px-2 py-1 text-[10px] text-muted transition hover:border-sand hover:text-ink disabled:opacity-40"
        >
          删除
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {CONNECTION_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => ai.onTemplateClick(t)}
            className="rounded border border-border/80 bg-canvas px-2 py-0.5 text-[10px] text-muted transition hover:border-sand hover:text-ink"
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <input
          value={ai.presetCodeInput}
          onChange={(e) => ai.setPresetCodeInput(e.target.value)}
          placeholder={`快捷码（${KNOWN_PRESET_CODES.join(" / ")}）`}
          className="min-w-[8rem] flex-1 rounded border border-border bg-canvas px-2 py-1 font-mono text-[10px] text-ink outline-none focus:border-sand"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => void ai.applyPresetCode()}
          disabled={ai.presetBusy}
          className="rounded border border-border bg-canvas px-2 py-1 text-[10px] text-ink transition hover:border-sand disabled:opacity-50"
        >
          {ai.presetBusy ? "应用中…" : "应用快捷码"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        <input
          value={ai.draftName}
          onChange={(e) => ai.setDraftName(e.target.value)}
          placeholder="连接名称（可留空自动生成）"
          className="rounded border border-border bg-canvas px-2 py-1 text-[11px] text-ink outline-none focus:border-sand"
          autoComplete="off"
        />
        <input
          value={ai.draftConnection.baseUrl}
          onChange={(e) =>
            ai.setDraftConnection((d) => ({ ...d, baseUrl: e.target.value }))
          }
          placeholder="Base URL"
          className="rounded border border-border bg-canvas px-2 py-1 font-mono text-[10px] text-ink outline-none focus:border-sand"
          autoComplete="off"
        />
        <input
          value={ai.draftConnection.model}
          onChange={(e) =>
            ai.setDraftConnection((d) => ({ ...d, model: e.target.value }))
          }
          placeholder="Model"
          list="studio-local-models-datalist"
          className="rounded border border-border bg-canvas px-2 py-1 font-mono text-[10px] text-ink outline-none focus:border-sand"
          autoComplete="off"
        />
        <input
          type="password"
          value={ai.draftConnection.apiKey ?? ""}
          onChange={(e) =>
            ai.setDraftConnection((d) => ({ ...d, apiKey: e.target.value }))
          }
          placeholder="API Key（本机可留空）"
          className="rounded border border-border bg-canvas px-2 py-1 font-mono text-[10px] text-ink outline-none focus:border-sand"
          autoComplete="off"
        />
      </div>
      <datalist id="studio-local-models-datalist">
        {ai.scannedEntries.map((entry) => (
          <option key={entry.name} value={entry.name}>
            {entry.suitability}
          </option>
        ))}
      </datalist>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void ai.scanLocalModels("auto")}
          disabled={ai.modelScanBusy}
          className="rounded border border-border bg-canvas px-2.5 py-1 text-[10px] text-muted transition hover:border-sand hover:text-ink disabled:opacity-50"
        >
          {ai.modelScanBusy ? "扫描中…" : "扫描本机模型"}
        </button>
        <button
          type="button"
          onClick={ai.saveCurrentProfile}
          className="rounded border border-border bg-surface px-2.5 py-1 text-[10px] font-medium text-ink shadow-sm transition hover:border-sand"
        >
          保存连接
        </button>
      </div>
    </div>
  );
}
