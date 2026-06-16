import * as ExpoCrypto from "expo-crypto";

async function sha256(data: ArrayBuffer): Promise<ArrayBuffer> {
  const bytes = new Uint8Array(data);
  const text = new TextDecoder().decode(bytes);
  const hex = await ExpoCrypto.digestStringAsync(ExpoCrypto.CryptoDigestAlgorithm.SHA256, text, {
    encoding: ExpoCrypto.CryptoEncoding.HEX,
  });
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out.buffer;
}

/** Supabase PKCE needs `crypto.subtle.digest(SHA-256)` in React Native. */
export function installWebCryptoSubtlePolyfill(): void {
  const root = globalThis as typeof globalThis & { crypto?: Crypto };
  if (!root.crypto) {
    root.crypto = {} as Crypto;
  }
  if (root.crypto.subtle?.digest) return;

  root.crypto.subtle = {
    digest: async (algorithm: AlgorithmIdentifier, data: BufferSource) => {
      const name = typeof algorithm === "string" ? algorithm : algorithm.name;
      if (name !== "SHA-256") {
        throw new Error(`Unsupported algorithm: ${name}`);
      }
      const buffer =
        data instanceof ArrayBuffer
          ? data
          : data instanceof Uint8Array
            ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
            : new Uint8Array(data as ArrayLike<number>).buffer;
      return sha256(buffer);
    },
  } as SubtleCrypto;
}

installWebCryptoSubtlePolyfill();
