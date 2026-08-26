import NetInfo from "@react-native-community/netinfo";

/**
 * 轻量联网探测：仅用于跳过明显离线时的 manifest / JSON 拉取，避免空等 timeout。
 * `isInternetReachable === null` 时仍允许尝试（部分机型未知）。
 */
export async function isNetworkAvailable(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    if (state.isConnected === false) return false;
    // 部分机型（尤其 Samsung）会把 isInternetReachable 误报成 false；只要连着网就允许同步。
    return true;
  } catch {
    return true;
  }
}
