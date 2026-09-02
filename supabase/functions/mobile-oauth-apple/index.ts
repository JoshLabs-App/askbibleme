import {
  createAdminClient,
  createAuthClient,
  errorResponse,
  isMemberRegisterEnabled,
  jsonResponse,
  passRateLimit,
  readClientIp,
  SCHEMA_VERSION,
  signInMobileMemberWithOAuthIdToken,
  trimString,
} from "../_shared/mobile-oauth-shared.ts";

type AppleAuthRequestV1 = {
  schemaVersion?: number;
  idToken?: unknown;
  nonce?: unknown;
  locale?: unknown;
  displayName?: unknown;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return errorResponse(405, "Method not allowed", "method_not_allowed");
  }

  if (!isMemberRegisterEnabled()) {
    return errorResponse(503, "会员登录尚未开放。", "auth_disabled");
  }

  const admin = createAdminClient();
  const authClient = createAuthClient();
  if (!admin || !authClient) {
    return errorResponse(503, "Apple 登录尚未配置。", "apple_not_configured");
  }

  const ip = readClientIp(req);
  if (!passRateLimit(ip)) {
    return errorResponse(429, "请求过于频繁，请稍后再试。", "rate_limited");
  }

  let body: AppleAuthRequestV1;
  try {
    body = (await req.json()) as AppleAuthRequestV1;
  } catch {
    return errorResponse(400, "请求体必须是 JSON。", "invalid_json");
  }

  const schemaVersion =
    typeof body.schemaVersion === "number" && Number.isFinite(body.schemaVersion)
      ? Math.trunc(body.schemaVersion)
      : SCHEMA_VERSION;
  if (schemaVersion !== SCHEMA_VERSION) {
    return errorResponse(400, `不支持的 schemaVersion：${schemaVersion}`, "unsupported_schema");
  }

  const idToken = trimString(body.idToken);
  const nonce = trimString(body.nonce);
  const locale = trimString(body.locale) || "zh";
  const displayName = trimString(body.displayName);
  if (!idToken || !nonce) {
    return errorResponse(400, "缺少 Apple idToken 或 nonce。", "invalid_token");
  }

  const result = await signInMobileMemberWithOAuthIdToken(admin, authClient, {
    provider: "apple",
    idToken,
    nonce,
    locale,
    displayName,
  });

  if (!result.ok) {
    return jsonResponse(
      { ok: false, schemaVersion: SCHEMA_VERSION, error: result.error, code: result.code },
      result.status,
    );
  }

  return jsonResponse(
    {
      ok: true,
      schemaVersion: SCHEMA_VERSION,
      user: result.user,
      sessionToken: result.sessionToken,
      expiresAt: result.expiresAt,
    },
    200,
  );
});
