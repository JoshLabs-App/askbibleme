type Listener = () => void;

/**
 * 「是否仍要求某条音轨在播」的最小 boolean 发布/订阅存储，与 UI `playing` /
 * 系统真实 isPlaying 解耦。music / verse / scripture 三条音轨各自持有一份独立
 * 实例（互不影响），逻辑完全一致，故抽成工厂避免三处手改三份。
 */
export function createWantPlayingStore() {
  let wantPlaying = false;
  const listeners = new Set<Listener>();

  function get(): boolean {
    return wantPlaying;
  }

  function set(next: boolean): void {
    if (wantPlaying === next) return;
    wantPlaying = next;
    for (const listener of listeners) listener();
  }

  function subscribe(onChange: Listener): () => void {
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  }

  return { get, set, subscribe };
}
