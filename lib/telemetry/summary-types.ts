export type TelemetrySummary = {
  configured: boolean;
  /** 数据来源（便于管理页提示） */
  storage?: "disk" | "supabase";
  /** 例如：磁盘（/var/data/telemetry-v1-store.json） */
  storageHint?: string;
  days: number;
  dau: { date: string; count: number }[];
  topScreens: { screen: string; views: number }[];
  topTaps: { target: string; count: number }[];
  topScenes: {
    scene_id: string;
    views: number;
    sessions: number;
    total_duration_ms: number;
  }[];
};
