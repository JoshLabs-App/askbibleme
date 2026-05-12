import type { NatureSettingsV2 } from "../types/nature";
import { getSelahBaseUrl } from "../config/selahBaseUrl";

export async function fetchNatureSettings(): Promise<NatureSettingsV2> {
  const base = getSelahBaseUrl();
  const url = `${base}/api/nature/settings`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const data = (await res.json()) as NatureSettingsV2;
  if (!data || typeof data !== "object" || !Array.isArray(data.videos)) {
    throw new Error("Invalid nature settings JSON");
  }
  return data;
}
