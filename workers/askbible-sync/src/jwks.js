// Pure WebCrypto RS256 JWKS verifier for Apple & Google native ID tokens (Zero Supabase, zero external deps).

const JWKS_CACHE = new Map();
const JWKS_TTL_MS = 60 * 60 * 1000;

export const APPLE_AUDIENCES = new Set([
  "me.askbible",
  "me.askbible.native",
  "me.askbible.web",
  "me.askbible.service",
]);

export const GOOGLE_AUDIENCES = new Set([
  "827770827257-cigkgaq8k1m8qiu9ogq6n60d4s5uqili.apps.googleusercontent.com",
  "827770827257-cq823rmvbvmcc9hccbn5s8d72gqdfv7v.apps.googleusercontent.com",
]);

function base64UrlToBytes(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function decodeJwtPart(part) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(part)));
}

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function fetchJwks(jwksUrl, forceRefresh = false) {
  const now = Date.now();
  const cached = JWKS_CACHE.get(jwksUrl);
  if (!forceRefresh && cached && now - cached.fetchedAt < JWKS_TTL_MS) {
    return cached.keys;
  }
  const res = await fetch(jwksUrl, { cf: { cacheTtl: 3600 } });
  if (!res.ok) {
    throw new Error(`JWKS fetch failed (${res.status})`);
  }
  const data = await res.json();
  const keys = Array.isArray(data?.keys) ? data.keys : [];
  JWKS_CACHE.set(jwksUrl, { keys, fetchedAt: now });
  return keys;
}

export async function verifyOidcIdToken({
  idToken,
  jwksUrl,
  issuers,
  audiences,
  expectedNonce,
}) {
  const parts = String(idToken || "").trim().split(".");
  if (parts.length !== 3) {
    throw new Error("invalid_token_format");
  }
  const header = decodeJwtPart(parts[0]);
  const payload = decodeJwtPart(parts[1]);
  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("unsupported_jwt_alg");
  }

  let keys = await fetchJwks(jwksUrl, false);
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    keys = await fetchJwks(jwksUrl, true);
    jwk = keys.find((k) => k.kid === header.kid);
  }
  if (!jwk) {
    throw new Error("jwk_kid_not_found");
  }

  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const signedData = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signature = base64UrlToBytes(parts[2]);
  const validSig = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", cryptoKey, signature, signedData);
  if (!validSig) {
    throw new Error("invalid_signature");
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp < nowSec - 60) {
    throw new Error("token_expired");
  }
  if (!issuers.has(payload.iss)) {
    throw new Error("invalid_issuer");
  }

  const tokenAuds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!tokenAuds.some((a) => audiences.has(a))) {
    throw new Error("invalid_audience");
  }

  if (expectedNonce && payload.nonce) {
    const hashedExpected = await sha256Hex(expectedNonce);
    if (payload.nonce !== expectedNonce && payload.nonce !== hashedExpected) {
      throw new Error("nonce_mismatch");
    }
  }

  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!email || !email.includes("@")) {
    throw new Error("missing_email_claim");
  }

  return {
    sub: String(payload.sub || ""),
    email,
    name: typeof payload.name === "string" ? payload.name.trim() : "",
  };
}
