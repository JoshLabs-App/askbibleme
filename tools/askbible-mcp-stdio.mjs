#!/usr/bin/env node
// AskBible.me · Local Stdio MCP Server（供 Claude Desktop / Cursor / Codex / Antigravity 本地零延迟直连）
// 用法：node tools/askbible-mcp-stdio.mjs
// 可选环境变量：
//   ASKBIBLE_SYNC_TOKEN=<个人 Session Token>   （开启个人进度查询与提案收件箱）
//   ASKBIBLE_SYNC_ORIGIN=https://sync.askbible.me

import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { PRODUCT_ORIGIN } from "../lib/ai/askbible-ai-catalog.mjs";
import { handleMcpJsonRpc } from "../lib/ai/askbible-mcp-core.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const SYNC_ORIGIN = (process.env.ASKBIBLE_SYNC_ORIGIN || "https://sync.askbible.me").replace(/\/+$/, "");
const AUTH_TOKEN = (process.env.ASKBIBLE_SYNC_TOKEN || "").trim() || null;

let cachedFigures = null;

function createLocalProvider() {
  return {
    async loadChapter(translationId, bookId, chapter) {
      const safeTr = String(translationId || "").replace(/[^a-z0-9_-]/gi, "");
      const safeBook = String(bookId || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
      const filePath = path.join(REPO_ROOT, "public", "scripture", safeTr, `${safeBook}.json`);
      try {
        const raw = await fs.readFile(filePath, "utf8");
        const parsed = JSON.parse(raw);
        const rows = parsed?.c?.[String(chapter)];
        if (!Array.isArray(rows)) return null;
        return rows
          .map((entry, idx) => {
            if (Array.isArray(entry)) return { verse: Number(entry[0]) || idx + 1, text: String(entry[1] || "") };
            if (entry && typeof entry === "object") {
              return { verse: Number(entry.v || entry.verse) || idx + 1, text: String(entry.t || entry.text || "") };
            }
            return { verse: idx + 1, text: String(entry || "") };
          })
          .filter((r) => r.text);
      } catch {
        return null;
      }
    },

    async loadReadingPlan(planId) {
      const safe = String(planId || "").replace(/[^a-z0-9_-]/gi, "");
      const filePath = path.join(REPO_ROOT, "public", "data", "bible-reading-plans", `${safe}.json`);
      try {
        return JSON.parse(await fs.readFile(filePath, "utf8"));
      } catch {
        return null;
      }
    },

    async loadFigures() {
      if (cachedFigures) return cachedFigures;
      const filePath = path.join(REPO_ROOT, "public", "data", "static-bundles", "legacy-figure-preview.json");
      try {
        const parsed = JSON.parse(await fs.readFile(filePath, "utf8"));
        cachedFigures = Array.isArray(parsed?.profiles) ? parsed.profiles : [];
        return cachedFigures;
      } catch {
        return [];
      }
    },

    async callSyncApi(apiPath, init = {}) {
      const target = `${SYNC_ORIGIN}${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`;
      const headers = {
        "Content-Type": "application/json",
        "User-Agent": "AskBibleLocalMCP/1.0",
        ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      };
      const method = init.method || "GET";
      const body = init.body !== undefined && method !== "GET" ? JSON.stringify(init.body) : undefined;
      const res = await fetch(target, { method, headers, body });
      const data = await res.json().catch(() => null);
      return { ok: res.ok, status: res.status, data };
    },
  };
}

const provider = createLocalProvider();
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    process.stdout.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } })}\n`,
    );
    return;
  }
  const res = await handleMcpJsonRpc(parsed, { provider, origin: PRODUCT_ORIGIN, authToken: AUTH_TOKEN });
  if (res !== null) {
    process.stdout.write(`${JSON.stringify(res)}\n`);
  }
});
