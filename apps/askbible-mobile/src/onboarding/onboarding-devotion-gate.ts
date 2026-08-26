const openListeners = new Set<() => void>();
const completeListeners = new Set<() => void>();

/** 本进程内已略过/完成欢迎页；同步可读，避免 AsyncStorage 已写但 React state 未清时被闪屏/重定向顶回。 */
let completedThisSession = false;

export function subscribeOnboardingDevotionOpen(listener: () => void): () => void {
  openListeners.add(listener);
  return () => {
    openListeners.delete(listener);
  };
}

export function requestOpenOnboardingDevotionIntro(): void {
  openListeners.forEach((listener) => listener());
}

export function isOnboardingCompletedThisSession(): boolean {
  return completedThisSession;
}

export function subscribeOnboardingDevotionCompleted(listener: () => void): () => void {
  completeListeners.add(listener);
  return () => {
    completeListeners.delete(listener);
  };
}

export function markOnboardingDevotionCompletedThisSession(): void {
  if (completedThisSession) return;
  completedThisSession = true;
  completeListeners.forEach((listener) => listener());
}

export function clearOnboardingDevotionCompletedThisSession(): void {
  completedThisSession = false;
}
