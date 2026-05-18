"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type BatchPayload = {
  ok: boolean;
  state?: {
    running: boolean;
    updatedAt: string;
    stats: { ok: number; failed: number; skipped: number };
    lastRun: {
      bookId: string;
      chapter: number;
      edition: string;
      error?: string;
    } | null;
    cursor: {
      bookName: string | null;
      chapter: number;
      edition: string;
    };
  };
  progress?: {
    percent: number;
    doneTasks: number;
    totalTasks: number;
    booksSynced: number;
  };
  books?: {
    bookId: string;
    bookName: string;
    percent: number;
    syncedAt: string | null;
    lastSyncError: string | null;
  }[];
};

export default function InfoEditionBatchMonitorPage() {
  const [data, setData] = useState<BatchPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dev/info-edition-batch", { cache: "no-store" });
      const j = (await res.json()) as BatchPayload;
      if (!res.ok || !j.ok) {
        setErr("接口不可用（请在本机 npm run dev 下打开）");
        return;
      }
      setData(j);
      setErr(null);
    } catch {
      setErr("无法连接开发服务器");
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 2500);
    return () => clearInterval(id);
  }, [load]);

  const st = data?.state;
  const prog = data?.progress;

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "2rem 1.25rem 4rem",
        fontFamily: "system-ui, sans-serif",
        lineHeight: 1.5,
      }}
    >
      <p style={{ fontSize: "0.85rem", color: "#666" }}>
        开发专用 · 本机批量进度 ·{" "}
        <Link href="/" style={{ color: "inherit" }}>
          回首页
        </Link>
      </p>
      <h1 style={{ fontSize: "1.35rem", fontWeight: 600, margin: "0.5rem 0 1rem" }}>
        讲解 / 发现版 · 全本批量
      </h1>
      <p style={{ fontSize: "0.85rem", color: "#555", margin: "0 0 1rem" }}>
        与后台「讲解版投送 / 发现版投送 → 确认生成」同一套拼稿与 DeepSeek 调用；讲解使用工作区已保存的描述规则，发现仅经文。
      </p>

      {err ? <p style={{ color: "#b00020" }}>{err}</p> : null}

      {st && prog ? (
        <>
          <section
            style={{
              padding: "1rem",
              borderRadius: 8,
              background: "#f6f4f0",
              marginBottom: "1.25rem",
            }}
          >
            <p style={{ margin: 0 }}>
              状态：{st.running ? "运行中" : "已停止 / 未运行"}
              {st.running ? " …" : ""}
            </p>
            <p style={{ margin: "0.5rem 0 0", fontSize: "1.5rem", fontWeight: 600 }}>
              {prog.percent}%
            </p>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.9rem", color: "#444" }}>
              {prog.doneTasks} / {prog.totalTasks} 章×版本 · 已同步卷 {prog.booksSynced}
            </p>
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.85rem" }}>
              成功 {st.stats.ok} · 跳过 {st.stats.skipped} · 失败 {st.stats.failed}
            </p>
            {st.cursor.bookName ? (
              <p style={{ margin: "0.5rem 0 0", fontSize: "0.85rem" }}>
                光标：{st.cursor.bookName} 第 {st.cursor.chapter} 章 ·{" "}
                {st.cursor.edition === "guide" ? "发现版" : "讲解版"}
              </p>
            ) : null}
            {st.lastRun?.error ? (
              <p style={{ margin: "0.5rem 0 0", fontSize: "0.85rem", color: "#b00020" }}>
                最近错误：{st.lastRun.error}
              </p>
            ) : null}
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.75rem", color: "#888" }}>
              更新 {new Date(st.updatedAt).toLocaleString()}
            </p>
          </section>

          <h2 style={{ fontSize: "1rem", fontWeight: 600 }}>各卷进度</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: "0.5rem 0 0" }}>
            {(data.books ?? []).map((b) => (
              <li
                key={b.bookId}
                style={{
                  display: "flex",
                  gap: "0.75rem",
                  alignItems: "baseline",
                  padding: "0.35rem 0",
                  borderBottom: "1px solid #eee",
                  fontSize: "0.85rem",
                }}
              >
                <span style={{ width: "5.5rem", flexShrink: 0 }}>{b.bookId}</span>
                <span style={{ flex: 1 }}>{b.bookName}</span>
                <span style={{ width: "3rem", textAlign: "right" }}>{b.percent}%</span>
                <span style={{ width: "4rem", color: b.syncedAt ? "#2e7d32" : "#999" }}>
                  {b.syncedAt ? "已同步" : "—"}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <section style={{ marginTop: "2rem", fontSize: "0.8rem", color: "#555" }}>
        <h2 style={{ fontSize: "0.95rem", color: "#333" }}>终端启动批量</h2>
        <pre
          style={{
            background: "#1e1e1e",
            color: "#e8e8e8",
            padding: "1rem",
            borderRadius: 8,
            overflow: "auto",
            fontSize: "0.75rem",
          }}
        >
          {`# 另开终端（可关屏，勿睡眠）
npm run info-edition:batch

# 每卷完成后推到 Render 盘
INFO_EDITION_BATCH_PUSH_EACH_BOOK=1 \\
INFO_EDITION_REMOTE_SCP_TARGET='你的SSH:/var/data/info-edition-v1-published.json' \\
npm run info-edition:batch

# 强制重生成
INFO_EDITION_BATCH_FORCE=1 npm run info-edition:batch`}
        </pre>
      </section>
    </main>
  );
}
