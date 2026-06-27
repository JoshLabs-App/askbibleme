import { HOME_PRAYER_POOL_SCOPE_ID } from "@/lib/home-prayer-pools/chunk-registry.generated";

const HOME_PRAYER_POOL_REMOTE_CONFIG_URL = "/data/home-prayer-pools/pool-config.signed.json";
const PUBLIC_KEY_PEM_ENV = "NEXT_PUBLIC_HOME_PRAYER_POOL_CONFIG_PUBLIC_KEY_PEM";

type SignedEnvelopeV1 = {
  version: 1;
  algorithm: "ECDSA_P256_SHA256";
  payload: string;
  signature: string;
};

type RemotePoolPayloadV1 = {
  version: 1;
  selectedScopeId: string;
  allowlistedScopeIds: string[];
};

export type VerifiedHomePrayerPoolConfig = {
  selectedScopeId: string;
  allowlistedScopeIds: string[];
};

function normalizeScopeId(raw: unknown): string | null {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (!v) return null;
  if (!/^((theme-repeat-[a-z0-9-]+)|(explore-curated-700))$/i.test(v)) return null;
  return v.toLowerCase();
}

function normalizeAllowlist(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<string>();
  for (const item of raw) {
    const scopeId = normalizeScopeId(item);
    if (scopeId) out.add(scopeId);
  }
  return [...out];
}

function pemToArrayBuffer(pem: string): ArrayBuffer | null {
  const body = pem
    .replace(/-----BEGIN PUBLIC KEY-----/g, "")
    .replace(/-----END PUBLIC KEY-----/g, "")
    .replace(/\s+/g, "")
    .trim();
  if (!body) return null;
  try {
    const binary = atob(body);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  } catch {
    return null;
  }
}

function base64UrlToBytes(raw: string): Uint8Array | null {
  const s = raw.trim();
  if (!s) return null;
  const normalized = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  try {
    const binary = atob(padded);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

async function verifyEnvelope(
  envelope: SignedEnvelopeV1,
  publicKeyPem: string,
): Promise<RemotePoolPayloadV1 | null> {
  if (typeof window === "undefined" || !window.crypto?.subtle) return null;
  const keyDer = pemToArrayBuffer(publicKeyPem);
  const signature = base64UrlToBytes(envelope.signature);
  if (!keyDer || !signature) return null;
  const payloadBytes = new TextEncoder().encode(envelope.payload);
  try {
    const key = await window.crypto.subtle.importKey(
      "spki",
      keyDer,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const ok = await window.crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      new Uint8Array(signature),
      payloadBytes,
    );
    if (!ok) return null;
    const parsed = JSON.parse(envelope.payload) as RemotePoolPayloadV1;
    if (parsed?.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function readVerifiedHomePrayerPoolConfig(): Promise<VerifiedHomePrayerPoolConfig | null> {
  const publicKeyPem = process.env[PUBLIC_KEY_PEM_ENV]?.trim() ?? "";
  if (!publicKeyPem) return null;
  try {
    const res = await fetch(HOME_PRAYER_POOL_REMOTE_CONFIG_URL, { cache: "no-store" });
    if (!res.ok) return null;
    const envelope = (await res.json()) as SignedEnvelopeV1;
    if (envelope?.version !== 1 || envelope.algorithm !== "ECDSA_P256_SHA256") return null;
    const payload = await verifyEnvelope(envelope, publicKeyPem);
    if (!payload) return null;
    const selected = normalizeScopeId(payload.selectedScopeId);
    const allowlisted = normalizeAllowlist(payload.allowlistedScopeIds);
    const mergedAllowlist = new Set<string>([HOME_PRAYER_POOL_SCOPE_ID, ...allowlisted]);
    const selectedScopeId = selected && mergedAllowlist.has(selected) ? selected : HOME_PRAYER_POOL_SCOPE_ID;
    return {
      selectedScopeId,
      allowlistedScopeIds: [...mergedAllowlist],
    };
  } catch {
    return null;
  }
}
