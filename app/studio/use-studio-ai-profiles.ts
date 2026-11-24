"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AI_PROFILES_STORAGE_KEY,
  AI_SETTINGS_LEGACY_KEY,
  bundleFromLegacySettingsJson,
  emptyConnection,
  emptyProfilesBundle,
  newProfileId,
  normalizePresetCode,
  type AIConnectionProfile,
  type AIProfilesBundle,
  type AISettings,
  type ConnectionTemplate,
} from "@/lib/ai";
import {
  entryFromScanParts,
  formatImportedProfileName,
  formatSavedConnectionName,
  inferLocalModelSuitability,
  type LocalModelScanEntry,
} from "@/lib/ai/model-notes";

function entriesFromLocalModelsApi(data: {
  models?: string[];
  entries?: LocalModelScanEntry[];
}): LocalModelScanEntry[] {
  if (data.entries && data.entries.length > 0) return data.entries;
  return (data.models ?? []).map((name) => ({
    name,
    suitability: inferLocalModelSuitability(name),
  }));
}

export function useStudioAiProfiles() {
  /** 连接/扫描等后台操作的提示（右栏讨论区不再重复展示连接文案） */
  const [assistantHint, setAssistantHint] = useState<string>("");
  const [bundle, setBundle] = useState<AIProfilesBundle>(() => emptyProfilesBundle());
  const [draftName, setDraftName] = useState("");
  const [draftConnection, setDraftConnection] = useState<AISettings>(() => emptyConnection());
  const [aiError, setAiError] = useState<string | null>(null);
  const [scannedEntries, setScannedEntries] = useState<LocalModelScanEntry[]>([]);
  const [modelScanBusy, setModelScanBusy] = useState(false);
  const [presetCodeInput, setPresetCodeInput] = useState("");
  const [presetBusy, setPresetBusy] = useState(false);

  useEffect(() => {
    try {
      const v2 = localStorage.getItem(AI_PROFILES_STORAGE_KEY);
      if (v2) {
        const parsed = JSON.parse(v2) as AIProfilesBundle;
        if (parsed?.profiles && Array.isArray(parsed.profiles)) {
          setBundle({
            version: 1,
            activeProfileId: parsed.activeProfileId ?? null,
            profiles: parsed.profiles,
          });
        }
      } else {
        const v1 = localStorage.getItem(AI_SETTINGS_LEGACY_KEY);
        if (v1) {
          const migrated = bundleFromLegacySettingsJson(v1);
          if (migrated) {
            setBundle(migrated);
            localStorage.setItem(AI_PROFILES_STORAGE_KEY, JSON.stringify(migrated));
          }
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  // 仅在选择变化时，把该条配置加载到编辑区（避免保存后覆盖未提交的草稿）
  useEffect(() => {
    setScannedEntries([]);
    const id = bundle.activeProfileId;
    if (!id) {
      setDraftName("");
      setDraftConnection(emptyConnection());
      return;
    }
    const p = bundle.profiles.find((x) => x.id === id);
    if (!p) return;
    setDraftName(p.name);
    setDraftConnection({
      provider: p.provider,
      baseUrl: p.baseUrl,
      model: p.model,
      apiKey: p.apiKey ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 同 id 下仅改 profiles 内容时不重置草稿
  }, [bundle.activeProfileId]);

  const commitBundle = useCallback(
    (updater: (b: AIProfilesBundle) => AIProfilesBundle) => {
      setBundle((b) => {
        const next = updater(b);
        try {
          localStorage.setItem(AI_PROFILES_STORAGE_KEY, JSON.stringify(next));
        } catch {
          setAiError("无法写入本地存储，请检查浏览器权限。");
        }
        return next;
      });
    },
    [],
  );

  const bundleRef = useRef(bundle);
  bundleRef.current = bundle;

  /** 将当前 base 下扫到的所有模型各存为一条连接（同 base+model 已存在则跳过） */
  const bindAllModelsForBase = useCallback(
    async (baseUrl: string, apiKey?: string, namePrefix = "本机"): Promise<{ added: number }> => {
      const trimmedBase = baseUrl.trim();
      if (!trimmedBase) {
        setAiError("Base URL 为空，无法导入模型列表。");
        return { added: 0 };
      }
      setModelScanBusy(true);
      setAiError(null);
      try {
        const qs = new URLSearchParams({ provider: "auto", baseUrl: trimmedBase });
        const res = await fetch(`/api/ai/local-models?${qs}`);
        const data = (await res.json()) as {
          models?: string[];
          entries?: LocalModelScanEntry[];
          error?: string;
          source?: string;
        };
        const entries = entriesFromLocalModelsApi(data);
        setScannedEntries(entries);
        const models = entries.map((e) => e.name);
        if (!res.ok || models.length === 0) {
          if (!res.ok) setAiError(data.error || "拉取模型列表失败");
          return { added: 0 };
        }
        let added = 0;
        commitBundle((b) => {
          const seen = new Set(b.profiles.map((p) => `${p.baseUrl}|${p.model}`));
          const additions: AIConnectionProfile[] = [];
          const src = data.source === "ollama" ? "Ollama" : "兼容API";
          for (const entry of entries) {
            const model = entry.name;
            const key = `${trimmedBase}|${model}`;
            if (seen.has(key)) continue;
            seen.add(key);
            additions.push({
              id: newProfileId(),
              name: formatImportedProfileName(namePrefix, src, entry),
              provider: "openai-compatible",
              baseUrl: trimmedBase,
              model,
              apiKey: apiKey?.trim() || undefined,
            });
          }
          added = additions.length;
          if (additions.length === 0) return b;
          return {
            version: 1,
            activeProfileId: additions[0]!.id,
            profiles: [...b.profiles, ...additions],
          };
        });
        return { added };
      } catch {
        setAiError("导入请求失败。");
        return { added: 0 };
      } finally {
        setModelScanBusy(false);
      }
    },
    [commitBundle],
  );

  /** 保存当前编辑区为一条「连接配置」，供下拉与其它模块复用 */
  const saveCurrentProfile = useCallback(() => {
    commitBundle((b) => {
      const id = b.activeProfileId ?? newProfileId();
      const draftModel = draftConnection.model.trim();
      const fromScan = scannedEntries.find((e) => e.name === draftModel);
      const name =
        draftName.trim() ||
        (draftModel
          ? formatSavedConnectionName(fromScan ?? entryFromScanParts(draftModel))
          : "连接 · 未命名");
      const nextProfile: AIConnectionProfile = {
        id,
        name,
        provider: draftConnection.provider,
        baseUrl: draftConnection.baseUrl.trim(),
        model: draftConnection.model.trim(),
        apiKey: draftConnection.apiKey?.trim() || undefined,
      };
      const exists = b.profiles.some((p) => p.id === id);
      const profiles = exists
        ? b.profiles.map((p) => (p.id === id ? nextProfile : p))
        : [...b.profiles, nextProfile];
      return { version: 1, activeProfileId: id, profiles };
    });
    setAiError(null);
    setAssistantHint(
      "已保存连接配置。其它页面可读取同一键（见 lib/ai/storage）或改为服务端下发。",
    );
    window.setTimeout(() => {
      setAssistantHint("选择已保存的连接，或套用下方模板后改模型名，再点 AI 动作。");
    }, 2800);
  }, [commitBundle, draftConnection, draftName, scannedEntries]);

  const createNewProfile = useCallback(() => {
    commitBundle((b) => {
      const id = newProfileId();
      const blank: AIConnectionProfile = { id, name: "新连接", ...emptyConnection() };
      return { version: 1, activeProfileId: id, profiles: [...b.profiles, blank] };
    });
  }, [commitBundle]);

  const deleteCurrentProfile = useCallback(() => {
    commitBundle((b) => {
      const id = b.activeProfileId;
      if (!id) return b;
      const profiles = b.profiles.filter((p) => p.id !== id);
      return { version: 1, activeProfileId: profiles[0]?.id ?? null, profiles };
    });
    setAssistantHint("已删除该连接。");
  }, [commitBundle]);

  const applyTemplate = useCallback((t: ConnectionTemplate) => {
    setDraftConnection((d) => ({ ...d, baseUrl: t.baseUrl, model: t.modelPlaceholder }));
    if (t.hint) setAssistantHint(t.hint);
  }, []);

  /** 向本机服务拉取模型列表（经 Next API 代理，避免浏览器跨端口 CORS） */
  const scanLocalModels = useCallback(
    async (
      provider: "ollama" | "openai_models" | "auto" = "auto",
      baseUrlOverride?: string,
    ) => {
      const base = (baseUrlOverride ?? draftConnection.baseUrl).trim();
      if (!base) {
        setAiError("请先填写 Base URL，或点选上方模板。");
        return;
      }
      setModelScanBusy(true);
      setAiError(null);
      try {
        const qs = new URLSearchParams({ provider, baseUrl: base });
        const res = await fetch(`/api/ai/local-models?${qs}`);
        const data = (await res.json()) as {
          models?: string[];
          entries?: LocalModelScanEntry[];
          error?: string;
        };
        if (!res.ok) {
          setScannedEntries([]);
          setAiError(data.error || "扫描失败");
          setAssistantHint("未拿到模型列表，请检查本机服务是否已启动、Base URL 是否正确。");
          return;
        }
        const entries = entriesFromLocalModelsApi(data);
        setScannedEntries(entries);
        const models = entries.map((e) => e.name);
        setAssistantHint(
          models.length > 0
            ? `已从本机读取 ${models.length} 个模型；Model 下拉含备注，详见下方列表。`
            : "服务已响应但未发现模型条目。",
        );
        setDraftConnection((d) => ({
          ...d,
          model: d.model.trim() ? d.model : (models[0] ?? ""),
        }));
      } catch {
        setScannedEntries([]);
        setAiError("扫描请求失败。");
      } finally {
        setModelScanBusy(false);
      }
    },
    [draftConnection.baseUrl],
  );

  const onTemplateClick = useCallback(
    (t: ConnectionTemplate) => {
      if (t.id !== "ollama" && t.id !== "lmstudio") setScannedEntries([]);
      applyTemplate(t);
      if (t.id === "ollama" || t.id === "lmstudio") {
        const label =
          t.label.replace(/（本机）/, "").replace(/（.*?）/, "").trim() || t.id;
        void bindAllModelsForBase(t.baseUrl, undefined, label);
      }
    },
    [applyTemplate, bindAllModelsForBase],
  );

  /** 快捷码：OLLAMA / LM / SKY → 自动填表并可导入全部模型 */
  const applyPresetCode = useCallback(async () => {
    const raw = presetCodeInput.trim();
    if (!raw) {
      setAiError("请输入快捷码，例如 OLLAMA 或 SKY。");
      return;
    }
    setPresetBusy(true);
    setAiError(null);
    try {
      const res = await fetch(`/api/ai/preset?code=${encodeURIComponent(raw)}`);
      const data = (await res.json()) as {
        name?: string;
        baseUrl?: string;
        model?: string;
        apiKey?: string;
        autoScan?: boolean;
        error?: string;
      };
      if (!res.ok) {
        setAiError(data.error || "快捷码无效");
        return;
      }
      setDraftName(data.name ?? "");
      setDraftConnection({
        provider: "openai-compatible",
        baseUrl: data.baseUrl ?? "",
        model: data.model ?? "",
        apiKey: data.apiKey ?? "",
      });
      const code = normalizePresetCode(raw);
      if (data.autoScan && data.baseUrl) {
        const { added } = await bindAllModelsForBase(
          data.baseUrl,
          data.apiKey,
          data.name ?? code,
        );
        setAssistantHint(
          added > 0
            ? `快捷码「${code}」已应用，并新增 ${added} 条模型连接（已去重）。`
            : `快捷码「${code}」已应用；未新增连接（可能已全部存在或未扫到模型）。`,
        );
      } else {
        setAssistantHint(
          `快捷码「${code}」已自动填写名称与接口。需要批量导入模型时点「一键导入本机全部模型」。`,
        );
      }
    } catch {
      setAiError("快捷码请求失败。");
    } finally {
      setPresetBusy(false);
    }
  }, [bindAllModelsForBase, presetCodeInput]);

  /** 首次进入且尚无任何连接时，尝试从默认 Ollama 地址导入（仅尝试一次 / 标签页） */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (sessionStorage.getItem("askbible-studio-initial-bind-tried")) return;
      if (bundleRef.current.profiles.length > 0) return;
      sessionStorage.setItem("askbible-studio-initial-bind-tried", "1");
      void bindAllModelsForBase("http://127.0.0.1:11434/v1", undefined, "本机").then(
        ({ added }) => {
          if (added > 0) {
            setAssistantHint(
              `首次打开：已从本机默认 Ollama 导入 ${added} 条模型连接，可在已保存的连接中选择。`,
            );
          }
        },
      );
    }, 900);
    return () => window.clearTimeout(timer);
  }, [bindAllModelsForBase]);

  const onSelectProfile = useCallback(
    (value: string) => {
      commitBundle((b) => ({ ...b, activeProfileId: value || null }));
    },
    [commitBundle],
  );

  return {
    bundle,
    draftName,
    setDraftName,
    draftConnection,
    setDraftConnection,
    aiError,
    assistantHint,
    scannedEntries,
    modelScanBusy,
    presetCodeInput,
    setPresetCodeInput,
    presetBusy,
    bindAllModelsForBase,
    saveCurrentProfile,
    createNewProfile,
    deleteCurrentProfile,
    applyTemplate,
    scanLocalModels,
    onTemplateClick,
    applyPresetCode,
    onSelectProfile,
  };
}

export type StudioAiProfilesController = ReturnType<typeof useStudioAiProfiles>;
