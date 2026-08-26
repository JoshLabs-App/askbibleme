#!/usr/bin/env node
/**
 * 将最新（或指定）iOS 构建挂到已有 TestFlight 测试组，并提交外部 Beta 审核。
 * 测试员邮箱只需加一次；此后每个新 build 跑本脚本即可在原组内更新。
 */
import crypto from "node:crypto";
import fs from "node:fs";
import https from "node:https";

const ASC_APP_ID = process.env.ASC_APP_ID?.trim() || "6771996188";
const ASC_API_KEY_ID = process.env.ASC_API_KEY_ID?.trim() || "9HDA27WY8C";
const ASC_API_KEY_ISSUER_ID =
  process.env.ASC_API_KEY_ISSUER_ID?.trim() || "a56f0624-e4a4-438d-be5d-92403dd9969b";
const ASC_API_KEY_PATH =
  process.env.ASC_API_KEY_PATH?.trim() ||
  new URL("../AA/AuthKey_9HDA27WY8C.p8", import.meta.url).pathname;
const EXTERNAL_BETA_GROUP_ID =
  process.env.ASC_EXTERNAL_BETA_GROUP_ID?.trim() || "fb7566d4-a61e-4464-9d52-a0138f69ea62";

const buildNumberArg = process.argv.find((a) => /^\d+$/.test(a)) ?? null;
const waitMinutes = Number(process.env.ASC_BUILD_WAIT_MINUTES || "25");

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}

function ascToken() {
  const header = b64url(JSON.stringify({ alg: "ES256", kid: ASC_API_KEY_ID, typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(
    JSON.stringify({
      iss: ASC_API_KEY_ISSUER_ID,
      iat: now,
      exp: now + 1200,
      aud: "appstoreconnect-v1",
    }),
  );
  const data = `${header}.${payload}`;
  const key = fs.readFileSync(ASC_API_KEY_PATH, "utf8");
  const sig = crypto.sign("sha256", Buffer.from(data), { key, dsaEncoding: "ieee-p1363" });
  return `${data}.${sig.toString("base64url")}`;
}

function ascRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://api.appstoreconnect.apple.com${path}`);
    const req = https.request(
      url,
      {
        method,
        headers: {
          Authorization: `Bearer ${ascToken()}`,
          "Content-Type": "application/json",
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          let parsed = null;
          try {
            parsed = raw ? JSON.parse(raw) : null;
          } catch {
            parsed = raw;
          }
          resolve({ status: res.statusCode ?? 0, body: parsed, raw });
        });
      },
    );
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchLatestBuild() {
  const res = await ascRequest(
    "GET",
    `/v1/builds?filter[app]=${ASC_APP_ID}&sort=-uploadedDate&limit=10`,
  );
  const builds = res.body?.data ?? [];
  if (!builds.length) throw new Error("未找到任何 iOS 构建。");
  if (buildNumberArg) {
    const match = builds.find((b) => String(b.attributes?.version) === buildNumberArg);
    if (!match) throw new Error(`未找到 build ${buildNumberArg}。`);
    return match;
  }
  return builds[0];
}

async function waitForValidBuild(build) {
  const id = build.id;
  const version = build.attributes?.version;
  const deadline = Date.now() + waitMinutes * 60_000;
  while (Date.now() < deadline) {
    const res = await ascRequest("GET", `/v1/builds/${id}`);
    const state = res.body?.data?.attributes?.processingState;
    if (state === "VALID") return res.body.data;
    if (state === "FAILED" || state === "INVALID") {
      throw new Error(`Build ${version} 处理失败：${state}`);
    }
    console.log(`→ 等待苹果处理 Build ${version}（当前 ${state ?? "UNKNOWN"}）…`);
    await sleep(30_000);
  }
  throw new Error(`Build ${version} 在 ${waitMinutes} 分钟内未完成处理。`);
}

async function groupHasBuild(groupId, buildId) {
  const res = await ascRequest("GET", `/v1/betaGroups/${groupId}/builds?limit=50`);
  return (res.body?.data ?? []).some((b) => b.id === buildId);
}

async function addBuildToGroup(groupId, buildId) {
  if (await groupHasBuild(groupId, buildId)) {
    console.log("    ✓ 已在外部测试组中");
    return;
  }
  const res = await ascRequest("POST", `/v1/betaGroups/${groupId}/relationships/builds`, {
    data: [{ id: buildId, type: "builds" }],
  });
  if (res.status !== 204 && res.status !== 200) {
    throw new Error(`挂到测试组失败 (${res.status}): ${res.raw}`);
  }
  console.log("    ✓ 已加入外部测试组 External Testers");
}

async function ensureExternalBeta(buildId) {
  const detailRes = await ascRequest("GET", `/v1/builds/${buildId}/buildBetaDetail`);
  const attrs = detailRes.body?.data?.attributes ?? {};
  const external = attrs.externalBuildState;
  console.log(`    外部测试状态：${external}`);

  if (external === "IN_BETA_TESTING" || external === "BETA_APPROVED") {
    console.log("    ✓ 外部测试已可用");
    return;
  }

  if (external === "READY_FOR_BETA_SUBMISSION" || external === "READY_FOR_BETA_TESTING") {
    const sub = await ascRequest("POST", "/v1/betaAppReviewSubmissions", {
      data: {
        type: "betaAppReviewSubmissions",
        relationships: { build: { data: { type: "builds", id: buildId } } },
      },
    });
    if (sub.status !== 201 && sub.status !== 409) {
      const closed =
        sub.status === 422 && String(sub.raw || "").includes("CLOSED_VERSION");
      if (closed) {
        console.log("    ⚠ 该版本已关闭外部 Beta 审核；商店提审不受影响，跳过 TestFlight 外测提交");
        return;
      }
      throw new Error(`提交外部 Beta 审核失败 (${sub.status}): ${sub.raw}`);
    }
    console.log("    ✓ 已提交外部 Beta 审核（通常数分钟至数小时）");
    return;
  }

  console.log(`    ⚠ 外部状态 ${external}，请在 App Store Connect 手动确认`);
}

async function main() {
  if (!fs.existsSync(ASC_API_KEY_PATH)) {
    console.error(`缺少 ASC API Key：${ASC_API_KEY_PATH}`);
    process.exit(1);
  }

  console.log("→ 查找最新 iOS 构建…");
  let build = await fetchLatestBuild();
  const version = build.attributes?.version;
  console.log(`    Build ${version} (${build.id})`);

  if (build.attributes?.processingState !== "VALID") {
    build = await waitForValidBuild(build);
  }

  console.log("→ 挂到已有外部测试组（测试员无需重新添加）…");
  await addBuildToGroup(EXTERNAL_BETA_GROUP_ID, build.id);

  console.log("→ 启用外部 TestFlight 分发…");
  await ensureExternalBeta(build.id);

  console.log("");
  console.log("完成。已有测试员会在 TestFlight 看到更新（外部审核通过后推送通知）。");
  console.log("https://appstoreconnect.apple.com/apps/6771996188/testflight/ios");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
