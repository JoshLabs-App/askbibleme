import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

type TabBarPortalStore = {
  props: BottomTabBarProps | null;
  listeners: Set<() => void>;
};

const tabBarPortalStore: TabBarPortalStore = {
  props: null,
  listeners: new Set(),
};

export function subscribeTabBarPortal(listener: () => void) {
  tabBarPortalStore.listeners.add(listener);
  return () => tabBarPortalStore.listeners.delete(listener);
}

export function getTabBarPortalProps() {
  return tabBarPortalStore.props;
}

export function setTabBarPortalProps(props: BottomTabBarProps) {
  tabBarPortalStore.props = props;
  tabBarPortalStore.listeners.forEach((listener) => listener());
}
