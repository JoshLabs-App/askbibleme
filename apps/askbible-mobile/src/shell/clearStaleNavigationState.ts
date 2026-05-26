import AsyncStorage from "@react-native-async-storage/async-storage";

const ROUTE_ERA_KEY = "askbible-mobile-route-era";

/** 路由结构变更时递增，用于一次性清掉 React Navigation / Router 持久化状态 */
export const ROUTE_ERA = "v6";

function isNavigationStorageKey(key: string): boolean {
  const k = key.toLowerCase();
  return (
    k.includes("navigation") ||
    k.includes("nav_state") ||
    k.includes("router") ||
    k.includes("expo-router") ||
    k.startsWith("persist:") ||
    k.startsWith("@react-navigation")
  );
}

/** 冷启动前调用：避免旧 Tab/Stack 名恢复后落到 +not-found */
export async function clearStaleNavigationState(): Promise<void> {
  try {
    const era = await AsyncStorage.getItem(ROUTE_ERA_KEY);
    if (era === ROUTE_ERA) return;

    const keys = await AsyncStorage.getAllKeys();
    const drop = keys.filter(isNavigationStorageKey);
    if (drop.length > 0) await AsyncStorage.multiRemove(drop);

    await AsyncStorage.setItem(ROUTE_ERA_KEY, ROUTE_ERA);
  } catch {
    // 不阻塞启动
  }
}
