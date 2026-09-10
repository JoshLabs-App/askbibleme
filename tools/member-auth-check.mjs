#!/usr/bin/env node
// 会员登录纯规则对拍：GoTrue 错误文案映射 / 显示名回退 / 本机会话解析（含过期）/ 称呼校验 / 抬头文案 / 过期时间，
// 以及第三方登录：PKCE challenge / SHA-256 nonce / Supabase authorize URL / 回调 URL 识别与解析 / OAuth 错误文案 / Apple 姓名拼接 / id_token 错误 code，
// Swift（Model/MemberAuth.swift）↔ Kotlin（core MemberAuth.kt）↔ TS（RN 的 memberSession.readMemberSession 与
// explore 的 normalize / isValid 直接调；mapAuthErrorMessage / displayNameFromUser 没导出，按 RN 源码照抄）。
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IOS = path.join(ROOT, "apps/askbible-ios/AskBible");
const ANDROID_ROOT = path.join(ROOT, "apps/askbible-android");
const KOTLIN_BIN = path.join(ANDROID_ROOT, "core/build/install/core/bin/core");
const SESSION_OK = JSON.stringify({ sessionToken: " tok123 ", expiresAt: "2026-12-31T00:00:00.000Z", user: { id: "u1", email: "a@b.c", name: "阿明", locale: "zh-CN", createdAt: "2026-01-02T03:04:05Z" } });
const SESSION_MIN = JSON.stringify({ sessionToken: "tok", expiresAt: "2026-12-31T00:00:00Z", user: { id: "u2", email: "x@y.z" } });
const SESSION_EXPIRED = JSON.stringify({ sessionToken: "tok", expiresAt: "2026-01-01T00:00:00.000Z", user: { id: "u3", email: "x@y.z", name: "n" } });
const SESSION_BAD = JSON.stringify({ sessionToken: "", expiresAt: "2026-12-31T00:00:00.000Z", user: { id: "u4", email: "x@y.z" } });
const CASES = [
  ["err", "Invalid login credentials"], ["err", "invalid_credentials"], ["err", "Email not confirmed"], ["err", "User already registered"],
  ["err", "Network request failed"], ["err", "TypeError: Failed to fetch"], ["err", "Something else"], ["err", "   "],
  ["name", "a@b.c", "id1", "", "", "", "  Given  "], ["name", "a@b.c", "id1", "Full N", "N", "D", ""], ["name", "a@b.c", "id1", "", "Nick", "D", ""],
  ["name", "a@b.c", "id1", "", "", "Disp", ""], ["name", "a@b.c", "id1", "", "", "", ""], ["name", "", "id9", "", "", "", ""],
  ["session", SESSION_OK, "2026-09-09T00:00:00.000Z"], ["session", SESSION_MIN, "2026-09-09T00:00:00.000Z"],
  ["session", SESSION_EXPIRED, "2026-09-09T00:00:00.000Z"], ["session", SESSION_BAD, "2026-09-09T00:00:00.000Z"], ["session", "not json", "2026-09-09T00:00:00.000Z"],
  ["norm", "  小  明 "], ["norm", ""], ["norm", "abcdefghijklmnopqrstuvwxyz"], ["norm", "一二三四五六七八九十一二三四五六七八九十一二三四"],
  ["greet", ""], ["greet", "  小明 "], ["greet", "   "],
  ["exp", "1800000000", "2026-09-09T00:00:00.000Z"], ["exp", "", "2026-09-09T00:00:00.000Z"],
  // 第三方登录
  ["pkce", "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"], ["pkce", "abc"], ["pkce", "中文verifier"],
  ["nonce", "hello"], ["nonce", "0f1a2b3c-4d5e-6f70-8192-a3b4c5d6e7f8"],
  ["authurl", "google", "askbible://auth/callback", "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"], ["authurl", "apple", "https://askbible.me/auth/callback?flow=mobile", "x y+z/&=?"],
  ["cburl", "askbible://auth/callback?code=abc"], ["cburl", "askbible://auth/callback"], ["cburl", "https://askbible.me/auth/callback?code=1"], ["cburl", "https://askbible.me/auth/mobile-callback#access_token=x"],
  ["cburl", "https://askbible.me/read"], ["cburl", "askbible://read/GEN/1"], ["cburl", "not a url"], ["cburl", ""],
  ["cbparse", "askbible://auth/callback?code=%20abc123%20&state=s"], ["cbparse", "askbible://auth/callback?error=access_denied&error_code=otp_expired&error_description=x"],
  ["cbparse", "askbible://auth/callback#access_token=AT&refresh_token=RT&expires_in=3600"], ["cbparse", "askbible://auth/callback?code=q#code=frag"],
  ["cbparse", "askbible://auth/callback?error=&code=&a=b=c&=v&x"], ["cbparse", "askbible://auth/callback?code=a%2Bb+c"], ["cbparse", "askbible://auth/callback"],
  ["oautherr", "google", "", "", "1"], ["oautherr", "google", "network", "", "0"], ["oautherr", "google", "", "network", "0"],
  ["oautherr", "google", "google_not_configured", "google_not_configured", "0"], ["oautherr", "google", "google_android_setup", "x", "0"], ["oautherr", "google", "google_play_services", "google_play_services", "0"],
  ["oautherr", "google", "auth_disabled", "会员登录尚未开放。", "0"], ["oautherr", "google", "auth_disabled", "google_x", "0"], ["oautherr", "google", "google_auth_failed", "Invalid token", "0"],
  ["oautherr", "google", "google_auth_failed", "google_auth_failed", "0"], ["oautherr", "google", "google_failed", "TypeError: Network request failed", "0"],
  ["oautherr", "google", "google_failed", "redirect_to not allowed", "0"], ["oautherr", "google", "google_failed", "Google 拒绝了", "0"], ["oautherr", "google", "google_failed", "exchange_failed", "0"],
  ["oautherr", "google", "google_failed", "google_failed", "0"], ["oautherr", "google", "google_cancelled", "google_cancelled", "0"], ["oautherr", "google", "", "", "0"], ["oautherr", "google", "", "otp_expired", "0"],
  ["oautherr", "apple", "", "", "1"], ["oautherr", "apple", "network", "network", "0"], ["oautherr", "apple", "apple_not_configured", "Unacceptable audience in id_token: [me.askbible.native]", "0"],
  ["oautherr", "apple", "apple_auth_failed", "Unacceptable audience in id_token", "0"], ["oautherr", "apple", "auth_disabled", "会员登录尚未开放。", "0"], ["oautherr", "apple", "auth_disabled", "apple_x", "0"],
  ["oautherr", "apple", "apple_auth_failed", "Invalid id_token", "0"], ["oautherr", "apple", "apple_auth_failed", "apple_auth_failed", "0"], ["oautherr", "apple", "apple_failed", "apple_failed", "0"],
  ["oautherr", "apple", "apple_no_token", "apple_no_token", "0"], ["oautherr", "apple", "", "Apple 那边出错", "0"], ["oautherr", "apple", "", "", "0"], ["oautherr", "apple", "", "something", "0"],
  ["applename", "Tim", "Cook"], ["applename", "Tim", ""], ["applename", "", "Cook"], ["applename", "", ""], ["applename", " ", " "],
  ["idcode", "apple", "Unacceptable audience in id_token: [me.askbible.native]"], ["idcode", "apple", "Apple provider is not configured"], ["idcode", "apple", "Invalid id_token"],
  ["idcode", "google", "Passed nonce and nonce in id_token should either both exist or not."], ["idcode", "google", "nonce mismatch"], ["idcode", "google", "Bad ID token"],
];
const stdin = CASES.map((c) => c.join("\t")).join("\n") + "\n";
function run(cmd, args, label) {
  const r = spawnSync(cmd, args, { input: stdin, encoding: "utf8", cwd: ROOT });
  if (r.status !== 0) throw new Error(`${label} 跑失败：${(r.stderr || r.stdout).split("\n").slice(0, 5).join(" | ")}`);
  if (r.stderr?.trim()) console.error(r.stderr.trim());
  return JSON.parse(r.stdout);
}
const bin = path.join(mkdtempSync(path.join(tmpdir(), "memberauth-")), "bin");
execFileSync("swiftc", ["-O", "-swift-version", "5", path.join(IOS, "Model/MemberAuth.swift"), path.join(IOS, "Model/MemberOAuth.swift"), path.join(ROOT, "tools/swift-harness/memberauth/main.swift"), "-o", bin], { stdio: "pipe" });
const swift = run(bin, [], "Swift harness");
let kotlin = null;
try {
  const newest = execFileSync("find", [path.join(ANDROID_ROOT, "core/src/main/kotlin"), "-name", "*.kt", "-newer", KOTLIN_BIN], { encoding: "utf8" }).trim();
  if (!existsSync(KOTLIN_BIN) || newest) execFileSync(path.join(ANDROID_ROOT, "gradlew"), [":core:installDist", "--quiet"], { cwd: ANDROID_ROOT, stdio: "pipe" });
  kotlin = run(KOTLIN_BIN, ["--memberauth"], "Kotlin harness");
} catch (err) { console.error("Kotlin 端跑不起来，本次只检 iOS ↔ TS：" + String(err.message).split("\n")[0]); }
const ts = run(process.execPath, [path.join(ROOT, "node_modules/tsx/dist/cli.mjs"), path.join(ROOT, "tools/member-auth-expect.mts")], "TS 期望值");
const problems = [], counts = {};
function cmp(other, name) {
  for (let i = 0; i < CASES.length; i++) {
    const kind = CASES[i][0];
    if (other[i] === "skip") continue;
    counts[kind] = (counts[kind] || 0) + 1;
    if (swift[i] !== other[i]) problems.push(`${CASES[i].slice(0, 2).join(" ").slice(0, 80)}\n      Swift: ${String(swift[i]).slice(0, 200)}\n      ${name}: ${String(other[i]).slice(0, 200)}`);
  }
}
cmp(ts, "TS");
if (kotlin) cmp(kotlin, "Kotlin");
if (problems.length) { console.error("会员登录规则对拍失败："); for (const p of problems) console.error("  - " + p); process.exit(1); }
console.log(`会员登录规则对拍通过：${CASES.length} 条用例${kotlin ? "三端一致" : "iOS ↔ TS 一致（Kotlin 端未参与）"}`);
console.log("  " + Object.entries(counts).map(([k, v]) => `${k} ${v / (kotlin ? 2 : 1)}`).join(" · "));
