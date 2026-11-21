declare module "cloudflare:workers" {
  export const env: {
    ASSETS?: { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> };
    ASKBIBLE_SYNC?: { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> };
    [key: string]: unknown;
  };
}
