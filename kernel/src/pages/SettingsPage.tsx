import { useEffect, useState } from "react";
import type { AuthSession, BibleTranslationInfo, PackStatus, ThemeMode } from "../bridge/contracts";
import { bibleRepo, platformBridge } from "../bridge/platform-adapter";
import {
  manualCheckForUpdate,
  subscribeUpdater,
  type UpdaterSnapshot,
} from "../updater/silent-updater";

export default function SettingsPage() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try {
      return (localStorage.getItem("askbible-theme-mode") as ThemeMode) || "system";
    } catch {
      return "system";
    }
  });
  const [session, setSession] = useState<AuthSession>({ signedIn: false });
  const [translations, setTranslations] = useState<BibleTranslationInfo[]>([]);
  const [packStatus, setPackStatus] = useState<PackStatus | null>(null);
  const [updater, setUpdater] = useState<UpdaterSnapshot | null>(null);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState("07:30");
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

  async function toggleReminder() {
    const next = !reminderEnabled;
    const [h, m] = reminderTime.split(":").map(Number);
    setReminderEnabled(next);
    await platformBridge.call("sys.setReminder", {
      enabled: next,
      hour: Number.isFinite(h) ? h : 7,
      minute: Number.isFinite(m) ? m : 30,
    });
    setFeedback(next ? `已开启每日 ${reminderTime} 安静提醒` : "已关闭每日提醒");
  }

  async function downloadTranslation(id: string) {
    await platformBridge.call("pack.downloadTranslation", { id });
    const list = await bibleRepo.getTranslations();
    setTranslations(list);
    setFeedback(`已离线缓存译本 ${id}`);
  }

  async function handleSignIn(provider: "apple" | "google" | "email") {
    const next = await platformBridge.call("auth.signIn", { provider });
    setSession(next);
  }

  async function handleSignOut() {
    await platformBridge.call("auth.signOut");
    setSession({ signedIn: false });
  }

  async function handleManualCheck() {
    setFeedback("");
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

  return (
    <div className="ab-stack">
      <div>
        <h1 className="ab-page-title">设置</h1>
        <p className="ab-page-subtitle">外观、离线译本、每日提醒与静默内核信息。</p>
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
              onClick={() => selectTheme(mode)}
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
            <button type="button" className="ab-btn" onClick={handleSignOut}>
              退出
            </button>
          ) : (
            <div className="ab-row">
              <button type="button" className="ab-btn ab-btn-primary" onClick={() => handleSignIn("email")}>
                邮箱登录
              </button>
              <button type="button" className="ab-btn" onClick={() => handleSignIn("apple")}>
                Apple
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
              onChange={(e) => setReminderTime(e.target.value)}
            />
            <button
              type="button"
              className={reminderEnabled ? "ab-btn ab-btn-ok" : "ab-btn"}
              onClick={toggleReminder}
            >
              {reminderEnabled ? "已开启" : "开启"}
            </button>
          </div>
        </div>
      </section>

      <section className="ab-card">
        <h2 className="ab-card-title" style={{ marginBottom: 8 }}>离线圣经译本</h2>
        <div className="ab-stack">
          {translations.map((t) => (
            <div key={t.id} className="ab-row-between">
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{t.name}</div>
                <div className="ab-card-meta">{t.id}</div>
              </div>
              {t.downloaded ? (
                <span className="ab-pill ab-pill-ok">已离线就绪</span>
              ) : (
                <button
                  type="button"
                  className="ab-btn"
                  onClick={() => downloadTranslation(t.id)}
                >
                  缓存离线
                </button>
              )}
            </div>
          ))}
        </div>
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
            onClick={handleManualCheck}
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
