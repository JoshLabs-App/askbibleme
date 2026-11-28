import { useEffect, useMemo, useState } from "react";
import type { AuthSession, BibleTranslationInfo, PackStatus, ThemeMode } from "../bridge/contracts";
import { bibleRepo, platformBridge } from "../bridge/platform-adapter";
import { SfIcon } from "../components/SfIcons";
import {
  manualCheckForUpdate,
  subscribeUpdater,
  type UpdaterSnapshot,
} from "../updater/silent-updater";

const REMINDER_STORAGE_KEY = "askbible-reminder-config";

const LANGUAGE_LABELS: Record<string, string> = {
  "zh-Hans": "简体中文",
  "zh-Hant": "繁體中文",
  en: "English",
  es: "Español",
};

function labelForLanguage(lang: string): string {
  return LANGUAGE_LABELS[lang] || lang || "其他语言";
}

export interface SettingsPageProps {
  onBack?: () => void;
}

function loadSavedReminder(): { enabled: boolean; time: string } {
  try {
    const raw = localStorage.getItem(REMINDER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { enabled?: boolean; hour?: number; minute?: number };
      const h = String(parsed.hour ?? 7).padStart(2, "0");
      const m = String(parsed.minute ?? 30).padStart(2, "0");
      return { enabled: Boolean(parsed.enabled), time: `${h}:${m}` };
    }
  } catch {
    // Ignore
  }
  return { enabled: false, time: "07:30" };
}

export default function SettingsPage({ onBack }: SettingsPageProps) {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try {
      return (localStorage.getItem("askbible-theme-mode") as ThemeMode) || "system";
    } catch {
      return "system";
    }
  });
  const [session, setSession] = useState<AuthSession>({ signedIn: false });
  const [translations, setTranslations] = useState<BibleTranslationInfo[]>([]);
  const [selectedLang, setSelectedLang] = useState<string>("all");
  const [translationQuery, setTranslationQuery] = useState<string>("");
  const [expandedLangs, setExpandedLangs] = useState<Record<string, boolean>>({});
  const [packStatus, setPackStatus] = useState<PackStatus | null>(null);
  const [updater, setUpdater] = useState<UpdaterSnapshot | null>(null);
  const [reminderEnabled, setReminderEnabled] = useState(() => loadSavedReminder().enabled);
  const [reminderTime, setReminderTime] = useState(() => loadSavedReminder().time);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    platformBridge.call("auth.getSession").then(setSession).catch(() => {});
    platformBridge.call("pack.status").then(setPackStatus).catch(() => {});
    bibleRepo.getTranslations().then(setTranslations).catch(() => {});
    return subscribeUpdater(setUpdater);
  }, []);

  async function selectTheme(mode: ThemeMode) {
    setThemeMode(mode);
    await platformBridge.call("shell.haptic", { style: "light" });
    await platformBridge.call("shell.setTheme", { mode });
  }

  async function applyReminder(nextEnabled: boolean, nextTime: string) {
    const [h, m] = nextTime.split(":").map(Number);
    const hour = Number.isFinite(h) ? h : 7;
    const minute = Number.isFinite(m) ? m : 30;
    setReminderEnabled(nextEnabled);
    setReminderTime(nextTime);
    await platformBridge.call("shell.haptic", { style: "light" });
    await platformBridge.call("sys.setReminder", {
      enabled: nextEnabled,
      hour,
      minute,
    });
    setFeedback(nextEnabled ? `已设定每日 ${nextTime} 安静提醒` : "已关闭每日提醒");
  }

  async function downloadTranslation(id: string) {
    await platformBridge.call("shell.haptic", { style: "light" });
    await platformBridge.call("pack.downloadTranslation", { id });
    const list = await bibleRepo.getTranslations();
    setTranslations(list);
    setFeedback(`已离线缓存译本 ${id}`);
  }

  async function handleSignIn(provider: "apple" | "google" | "email") {
    await platformBridge.call("shell.haptic", { style: "light" });
    const next = await platformBridge.call("auth.signIn", { provider });
    setSession(next);
  }

  async function handleSignOut() {
    await platformBridge.call("shell.haptic", { style: "light" });
    await platformBridge.call("auth.signOut");
    setSession({ signedIn: false });
  }

  async function handleManualCheck() {
    setFeedback("");
    await platformBridge.call("shell.haptic", { style: "light" });
    const snap = await manualCheckForUpdate();
    const status = await platformBridge.call("pack.status");
    setPackStatus(status);
    setFeedback(
      snap.readyToSwap
        ? `已备好静默包（${snap.pendingBundleId}），切后台或闲置 15 秒自动生效`
        : "当前已是最新版本",
    );
  }

  const bundleId = updater?.bundleId || packStatus?.bundleId || platformBridge.getBundleId();
  const shortHash = bundleId.includes("-") ? bundleId.split("-").pop() : bundleId.slice(-7);

  const languageGroups = useMemo(() => {
    const order = ["zh-Hans", "zh-Hant", "en", "es"];
    const map = new Map<string, BibleTranslationInfo[]>();
    for (const item of translations) {
      const lang = item.language || "other";
      const list = map.get(lang) ?? [];
      list.push(item);
      map.set(lang, list);
    }
    return [...map.entries()]
      .sort(([a], [b]) => {
        const ia = order.indexOf(a);
        const ib = order.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      })
      .map(([lang, items]) => ({
        lang,
        label: labelForLanguage(lang),
        items,
        downloadedCount: items.filter((t) => t.downloaded || t.bundled).length,
      }));
  }, [translations]);

  const filteredGroups = useMemo(() => {
    const q = translationQuery.trim().toLowerCase();
    return languageGroups
      .filter((g) => selectedLang === "all" || g.lang === selectedLang)
      .map((g) => {
        if (!q) return g;
        const items = g.items.filter(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            t.shortName.toLowerCase().includes(q) ||
            t.id.toLowerCase().includes(q) ||
            g.label.toLowerCase().includes(q),
        );
        return { ...g, items };
      })
      .filter((g) => g.items.length > 0);
  }, [languageGroups, selectedLang, translationQuery]);

  const totalDownloaded = useMemo(
    () => translations.filter((t) => t.downloaded || t.bundled).length,
    [translations],
  );

  function toggleLangGroup(lang: string) {
    void platformBridge.call("shell.haptic", { style: "light" });
    setExpandedLangs((prev) => ({ ...prev, [lang]: !prev[lang] }));
  }

  return (
    <div className="ab-stack">
      <div className="ab-row-between">
        <div>
          <h1 className="ab-page-title">设置</h1>
          <p className="ab-page-subtitle">外观、账号同步、每日提醒与按语言管理的离线译本。</p>
        </div>
        {onBack && (
          <button
            type="button"
            className="ab-btn"
            style={{ display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0 }}
            onClick={() => {
              void platformBridge.call("shell.haptic", { style: "light" });
              onBack();
            }}
          >
            <SfIcon name="chevron-left" size={16} />
            <span>返回探索</span>
          </button>
        )}
      </div>

      <section className="ab-card">
        <h2 className="ab-card-title">羊皮卷外观</h2>
        <p className="ab-card-meta" style={{ marginBottom: 10 }}>
          统一实底羊皮卷浅色与沉香深色双模
        </p>
        <div className="ab-row">
          {([
            ["light", "羊皮卷浅色"],
            ["dark", "沉香深色"],
            ["system", "跟随系统"],
          ] as const).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={themeMode === mode ? "ab-btn ab-btn-primary" : "ab-btn"}
              onClick={() => void selectTheme(mode)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="ab-card">
        <div className="ab-row-between" style={{ marginBottom: 8 }}>
          <div>
            <h2 className="ab-card-title">账号同步</h2>
            <div className="ab-card-meta">
              {session.signedIn
                ? `已登录：${session.displayName || session.email}（${session.provider}）`
                : "未登录（本地阅读记录自动保留）"}
            </div>
          </div>
          {session.signedIn ? (
            <button type="button" className="ab-btn" onClick={() => void handleSignOut()}>
              退出
            </button>
          ) : (
            <div className="ab-row">
              <button
                type="button"
                className="ab-btn ab-btn-primary"
                onClick={() => void handleSignIn("email")}
              >
                邮箱登录
              </button>
              <button type="button" className="ab-btn" onClick={() => void handleSignIn("apple")}>
                Apple
              </button>
              <button type="button" className="ab-btn" onClick={() => void handleSignIn("google")}>
                Google
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="ab-card">
        <div className="ab-row-between">
          <div>
            <h2 className="ab-card-title">每日读经提醒</h2>
            <div className="ab-card-meta">温和提示，不打扰日常</div>
          </div>
          <div className="ab-row">
            <input
              type="time"
              aria-label="提醒时间"
              className="ab-input"
              style={{ width: 112 }}
              value={reminderTime}
              onChange={(e) => {
                const nextTime = e.target.value;
                if (reminderEnabled) {
                  void applyReminder(true, nextTime);
                } else {
                  setReminderTime(nextTime);
                }
              }}
            />
            <button
              type="button"
              className={reminderEnabled ? "ab-btn ab-btn-ok" : "ab-btn"}
              onClick={() => void applyReminder(!reminderEnabled, reminderTime)}
            >
              {reminderEnabled ? "已开启" : "开启"}
            </button>
          </div>
        </div>
      </section>

      <section className="ab-card">
        <div className="ab-row-between" style={{ marginBottom: 8 }}>
          <div>
            <h2 className="ab-card-title">下载离线译本</h2>
            <div className="ab-card-meta">
              已就绪 {totalDownloaded} 个 · 共 {translations.length} 个（默认按语言收起，按需筛选展开）
            </div>
          </div>
        </div>

        <input
          type="search"
          aria-label="筛选离线译本"
          className="ab-input"
          placeholder="搜索译本或语言（如：和合本、KJV、English）…"
          value={translationQuery}
          onChange={(e) => setTranslationQuery(e.target.value)}
          style={{ marginBottom: 10 }}
        />

        <div className="ab-row" style={{ marginBottom: 12 }}>
          <button
            type="button"
            className={selectedLang === "all" ? "ab-btn ab-btn-primary" : "ab-btn"}
            onClick={() => {
              void platformBridge.call("shell.haptic", { style: "light" });
              setSelectedLang("all");
            }}
          >
            全部语言
          </button>
          {languageGroups.map((g) => (
            <button
              key={g.lang}
              type="button"
              className={selectedLang === g.lang ? "ab-btn ab-btn-primary" : "ab-btn"}
              onClick={() => {
                void platformBridge.call("shell.haptic", { style: "light" });
                setSelectedLang(g.lang);
                setExpandedLangs((prev) => ({ ...prev, [g.lang]: true }));
              }}
            >
              {g.label} ({g.items.length})
            </button>
          ))}
        </div>

        {filteredGroups.length === 0 ? (
          <div className="ab-muted">没有匹配的译本，请换个关键词或语言筛选。</div>
        ) : (
          <div className="ab-stack">
            {filteredGroups.map((group) => {
              const autoOpen = Boolean(translationQuery.trim()) || selectedLang !== "all";
              const isOpen = autoOpen || Boolean(expandedLangs[group.lang]);
              return (
                <div
                  key={group.lang}
                  style={{
                    borderTop: "1px solid var(--ab-hairline)",
                    paddingTop: 10,
                  }}
                >
                  <button
                    type="button"
                    className="ab-btn-ghost ab-row-between"
                    style={{ width: "100%", padding: "4px 0", textAlign: "left" }}
                    aria-expanded={isOpen}
                    onClick={() => toggleLangGroup(group.lang)}
                  >
                    <div>
                      <strong style={{ fontSize: 14 }}>{group.label}</strong>
                      <span className="ab-card-meta" style={{ marginLeft: 8 }}>
                        {group.items.length} 个译本
                        {group.downloadedCount > 0 ? ` · 已离线 ${group.downloadedCount}` : ""}
                      </span>
                    </div>
                    <span className="ab-pill">{isOpen ? "收起" : "展开"}</span>
                  </button>

                  {isOpen && (
                    <div className="ab-stack" style={{ marginTop: 10 }}>
                      {group.items.map((t) => (
                        <div key={t.id} className="ab-row-between">
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 500 }}>{t.name}</div>
                            <div className="ab-card-meta">{t.id}</div>
                          </div>
                          {t.downloaded || t.bundled ? (
                            <span className="ab-pill ab-pill-ok">已离线就绪</span>
                          ) : (
                            <button
                              type="button"
                              className="ab-btn"
                              onClick={() => void downloadTranslation(t.id)}
                            >
                              缓存离线
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="ab-card">
        <div className="ab-row-between">
          <div>
            <h2 className="ab-card-title">关于内核与版本</h2>
            <div className="ab-card-meta">
              运行端：{platformBridge.getPlatform()} · 短哈希{" "}
              <span className="ab-mono">{shortHash}</span>
            </div>
            <div className="ab-card-meta">
              Bundle：<span className="ab-mono">{bundleId}</span>
            </div>
          </div>
          <button
            type="button"
            className="ab-btn"
            disabled={Boolean(updater?.checking)}
            onClick={() => void handleManualCheck()}
          >
            {updater?.checking ? "检查中…" : "检查更新"}
          </button>
        </div>
        {feedback && (
          <div className="ab-pill ab-pill-ok" style={{ marginTop: 10 }}>
            {feedback}
          </div>
        )}
      </section>
    </div>
  );
}
