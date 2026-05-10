import { STUDIO_DISK_BEARER_STORAGE_KEY } from "@/lib/studio-config";

/** 生产环境写磁盘 API 需 Bearer；密钥存 localStorage（与 Studio / 音乐后台一致）。 */
export function diskAuthHeaders(): HeadersInit {
  const h: Record<string, string> = {};
  try {
    const t = localStorage.getItem(STUDIO_DISK_BEARER_STORAGE_KEY)?.trim();
    if (t) h.Authorization = `Bearer ${t}`;
  } catch {
    /* ignore */
  }
  return h;
}
