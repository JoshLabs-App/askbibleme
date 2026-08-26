import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import type { NavigationState, PartialState } from "@react-navigation/native";

type TabBarPortalStore = {
  props: BottomTabBarProps | null;
  listeners: Set<() => void>;
};

const tabBarPortalStore: TabBarPortalStore = {
  props: null,
  listeners: new Set(),
};

function nestedRouteSig(
  state: NavigationState | PartialState<NavigationState> | undefined,
): string {
  if (!state || typeof state !== "object") return "";
  const index = "index" in state && typeof state.index === "number" ? state.index : 0;
  const routes = "routes" in state && Array.isArray(state.routes) ? state.routes : [];
  const route = routes[index] as { key?: string; state?: NavigationState } | undefined;
  if (!route) return String(index);
  return `${index}:${route.key ?? ""}:${nestedRouteSig(route.state)}`;
}

function tabBarPortalSig(state: BottomTabBarProps["state"]): string {
  return nestedRouteSig(state);
}

export function subscribeTabBarPortal(listener: () => void) {
  tabBarPortalStore.listeners.add(listener);
  return () => tabBarPortalStore.listeners.delete(listener);
}

export function getTabBarPortalProps() {
  return tabBarPortalStore.props;
}

export function setTabBarPortalProps(props: BottomTabBarProps) {
  const prev = tabBarPortalStore.props;
  tabBarPortalStore.props = props;
  if (prev && tabBarPortalSig(prev.state) === tabBarPortalSig(props.state)) {
    return;
  }
  tabBarPortalStore.listeners.forEach((listener) => listener());
}
