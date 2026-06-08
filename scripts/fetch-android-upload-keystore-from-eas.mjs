#!/usr/bin/env node
/**
 * 从 EAS 拉取 Android upload keystore，写入本机 Gradle 签名配置。
 * 使用本机 Expo 登录态（~/.expo/state.json），无需交互菜单。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const MOBILE = path.join(ROOT, "apps/askbible-mobile");
const ANDROID = path.join(MOBILE, "android");
const KEYSTORE_PATH = path.join(ANDROID, "app/upload.keystore");
const PROPS_PATH = path.join(ANDROID, "keystore.properties");

const PROJECT_FULL_NAME = "@joshuazeng/askbible-me";
const APPLICATION_ID = "me.askbible";
const API_BASE = "https://api.expo.dev";

function readSessionSecret() {
  const statePath = path.join(os.homedir(), ".expo/state.json");
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  const secret = state?.auth?.sessionSecret;
  if (!secret) {
    throw new Error("未登录 Expo。请先运行：cd apps/askbible-mobile && npx eas login");
  }
  return secret;
}

async function expoGraphql(query, variables) {
  const res = await fetch(`${API_BASE}/graphql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "expo-session": readSessionSecret(),
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors?.length) {
    const msg = json.errors?.map((e) => e.message).join("; ") || res.statusText;
    throw new Error(`Expo GraphQL 失败：${msg}`);
  }
  return json.data;
}

const QUERY = `
  query FetchAndroidKeystore($projectFullName: String!, $applicationIdentifier: String) {
    app {
      byFullName(fullName: $projectFullName) {
        androidAppCredentials(
          filter: { applicationIdentifier: $applicationIdentifier, legacyOnly: false }
        ) {
          androidAppBuildCredentialsList {
            name
            isDefault
            androidKeystore {
              keystore
              keystorePassword
              keyAlias
              keyPassword
            }
          }
        }
      }
    }
  }
`;

function pickBuildCredentials(list) {
  if (!list?.length) return null;
  return list.find((item) => item.isDefault) ?? list.find((item) => item.name === "production") ?? list[0];
}

async function main() {
  const data = await expoGraphql(QUERY, {
    projectFullName: PROJECT_FULL_NAME,
    applicationIdentifier: APPLICATION_ID,
  });

  const creds = data?.app?.byFullName?.androidAppCredentials?.[0];
  const buildCreds = pickBuildCredentials(creds?.androidAppBuildCredentialsList);
  const keystore = buildCreds?.androidKeystore;
  if (!keystore?.keystore) {
    throw new Error("EAS 上未找到 Android upload keystore。请先在 Expo 配置构建凭据。");
  }

  fs.mkdirSync(path.dirname(KEYSTORE_PATH), { recursive: true });
  fs.writeFileSync(KEYSTORE_PATH, Buffer.from(keystore.keystore, "base64"));

  const props = [
    "MYAPP_UPLOAD_STORE_FILE=upload.keystore",
    `MYAPP_UPLOAD_STORE_PASSWORD=${keystore.keystorePassword}`,
    `MYAPP_UPLOAD_KEY_ALIAS=${keystore.keyAlias}`,
    `MYAPP_UPLOAD_KEY_PASSWORD=${keystore.keyPassword ?? keystore.keystorePassword}`,
    "",
  ].join("\n");
  fs.writeFileSync(PROPS_PATH, props, "utf8");

  console.log(`✓ Keystore → ${KEYSTORE_PATH}`);
  console.log(`✓ 签名配置 → ${PROPS_PATH}`);
  console.log(`  alias: ${keystore.keyAlias}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
