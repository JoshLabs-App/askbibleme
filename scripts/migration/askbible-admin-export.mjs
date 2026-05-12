#!/usr/bin/env node
/**
 * 从「01 AskBible 2」导出可进 Selah `/admin` 的邮箱名单（不写密码、不写哈希）。
 *
 * 数据源（优先顺序）：
 *   1. `admin_data/auth.sqlite` → `users` 表 `is_admin = 1`
 *   2. 若无 sqlite 或查不到管理员 → 读 `admin_data/users.json`（无 is_admin，仅列出全部邮箱并提示手动筛选）
 *
 * 根目录：环境变量 `ASKBIBLE_REPO`，否则默认 ~/Desktop/APP/01 AskBible 2
 *
 * 用法：
 *   node scripts/migration/askbible-admin-export.mjs
 *   node scripts/migration/askbible-admin-export.mjs --all-users   # 列出所有用户（含非管理员）
 *
 * 接上 Selah：把输出的 `ADMIN_USER_EMAILS=...` 贴到 Vercel；在 Supabase 为每个邮箱创建用户并设密码
 *（或发「重置密码」）。老站 bcrypt/SHA256 哈希不能原样迁入 Supabase。
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function askRoot() {
  const fromEnv = String(process.env.ASKBIBLE_REPO || "").trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.join(os.homedir(), "Desktop", "APP", "01 AskBible 2");
}

function sqliteQuery(dbPath, sql) {
  const out = execSync(`sqlite3 ${JSON.stringify(dbPath)} ${JSON.stringify(sql)}`, {
    encoding: "utf-8",
    maxBuffer: 4 * 1024 * 1024,
  });
  return out
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function main() {
  const allUsers = process.argv.includes("--all-users");
  const root = askRoot();
  const sqlitePath = path.join(root, "admin_data", "auth.sqlite");
  const jsonPath = path.join(root, "admin_data", "users.json");

  if (!fs.existsSync(root)) {
    console.error(`找不到老站目录：${root}`);
    console.error("请设置 ASKBIBLE_REPO 指向「01 AskBible 2」仓库根目录。");
    process.exit(1);
  }

  let adminEmails = [];
  let rows = [];

  if (fs.existsSync(sqlitePath)) {
    try {
      const sql = allUsers
        ? "SELECT id, name, email, is_admin, admin_role FROM users ORDER BY email;"
        : "SELECT id, name, email, is_admin, admin_role FROM users WHERE is_admin = 1 ORDER BY email;";
      const raw = execSync(`sqlite3 -header -column ${JSON.stringify(sqlitePath)} ${JSON.stringify(sql)}`, {
        encoding: "utf-8",
        maxBuffer: 4 * 1024 * 1024,
      });
      console.log("── auth.sqlite ──\n");
      console.log(raw.trim() || "(无行)");
      console.log("");

      adminEmails = sqliteQuery(
        sqlitePath,
        "SELECT email FROM users WHERE is_admin = 1 ORDER BY email;",
      );
    } catch (e) {
      console.error("读取 auth.sqlite 失败（需本机已安装 sqlite3 命令行）：", e.message || e);
    }
  } else {
    console.warn(`未找到 ${sqlitePath}，将尝试 users.json。\n`);
  }

  if (adminEmails.length === 0 && fs.existsSync(jsonPath)) {
    const j = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    const users = Array.isArray(j.users) ? j.users : [];
    console.log("── users.json（无 is_admin，下列邮箱需你自行决定谁可进 Selah 后台）──\n");
    for (const u of users) {
      console.log(`${u.email || ""}\tname=${u.name || ""}\tid=${u.id || ""}`);
    }
    console.log("");
    adminEmails = users.map((u) => String(u.email || "").trim()).filter(Boolean);
    console.warn("提示：users.json 不含管理员标记；请只在确认身份后把邮箱写入 ADMIN_USER_EMAILS。\n");
  }

  if (adminEmails.length === 0 && !allUsers) {
    console.error("未导出到任何管理员邮箱。若老库只有 users.json，请用 --all-users 查看全表后手动决定。");
    process.exit(2);
  }

  const unique = [...new Set(adminEmails.map((e) => e.toLowerCase()))];
  console.log("── 复制到 Vercel 环境变量 ADMIN_USER_EMAILS（逗号分隔，无空格亦可）──\n");
  console.log(`ADMIN_USER_EMAILS=${unique.join(",")}\n`);
  console.log(
    "── 接上 Selah 的步骤 ──\n" +
      "1. Supabase → Authentication → Users：为上述每个邮箱「Add user」并设密码，或让用户用「Forgot password」。\n" +
      "2. 不能把 AskBible 的 password_hash 直接导入 Supabase（算法不兼容）。\n" +
      "3. 部署 Selah 时带上 NEXT_PUBLIC_SUPABASE_* 与 ADMIN_USER_EMAILS。\n",
  );
}

main();
