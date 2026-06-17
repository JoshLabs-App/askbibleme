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

function bufferFromSource(data: BufferSource): ArrayBuffer {
  if (data instanceof ArrayBuffer) return data;
  if (ArrayBuffer.isView(data)) {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  }
  return new Uint8Array(data as unknown as ArrayLike<number>).buffer;
}

/** Supabase PKCE needs `crypto.subtle.digest(SHA-256)` in React Native. */
export function installWebCryptoSubtlePolyfill(): void {
  const root = globalThis as typeof globalThis & { crypto?: Crypto };
  if (!root.crypto) {
    Object.defineProperty(globalThis, "crypto", { value: {} as Crypto, configurable: true });
  }
  const cryptoRef = root.crypto!;
  if (typeof cryptoRef.subtle?.digest === "function") return;

  const subtle = {
    digest: async (algorithm: AlgorithmIdentifier, data: BufferSource) => {
      const name = typeof algorithm === "string" ? algorithm : algorithm.name;
      if (name !== "SHA-256") {
        throw new Error(`Unsupported algorithm: ${name}`);
      }
      return sha256(bufferFromSource(data));
    },
  } as SubtleCrypto;

  Object.defineProperty(cryptoRef, "subtle", { value: subtle, configurable: true });
}

installWebCryptoSubtlePolyfill();
