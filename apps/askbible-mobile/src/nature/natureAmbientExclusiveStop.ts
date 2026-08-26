type AmbientExclusiveStop = () => void | Promise<void>;
type AmbientSlotClear = () => void;

type AmbientSlotControl = {
  getActiveId: () => string;
  restore: (id: string) => void;
};

type AmbientRemoteGate = {
  pause: () => void | Promise<void>;
  resume: () => void | Promise<void>;
  isAudible: () => boolean;
};

let stopHandler: AmbientExclusiveStop | null = null;
let slotClearHandler: AmbientSlotClear | null = null;
let slotControl: AmbientSlotControl | null = null;
let remoteGate: AmbientRemoteGate | null = null;

/** 首页环境音挂载时注册；壳层音乐开播前强制停轨（不依赖 Home 是否 freeze）。 */
export function registerNatureAmbientExclusiveStop(handler: AmbientExclusiveStop | null): void {
  stopHandler = handler;
}

/** 首页环境音槽位挂载时注册；金句开着再开音乐时清槽（关芯片，而不只是停轨）。 */
export function registerNatureAmbientSlotClear(handler: AmbientSlotClear | null): void {
  slotClearHandler = handler;
}

export function registerNatureAmbientSlotControl(control: AmbientSlotControl | null): void {
  slotControl = control;
}

export function getNatureAmbientSlotId(): string {
  return (slotControl?.getActiveId() ?? "").trim();
}

export function clearNatureAmbientSlot(): void {
  slotClearHandler?.();
}

export function restoreNatureAmbientSlot(id: string): void {
  const next = id.trim();
  if (!next) return;
  slotControl?.restore(next);
}

export async function stopNatureAmbientForExclusiveMusic(): Promise<void> {
  const stop = stopHandler;
  if (!stop) return;
  try {
    await stop();
  } catch {
    /* ignore */
  }
}

/** 系统栏暂停/续播：停环境音且勿被安卓保活定时器拉回。 */
export function registerNatureAmbientRemoteGate(gate: AmbientRemoteGate | null): void {
  remoteGate = gate;
}

export function isNatureAmbientAudible(): boolean {
  if (getNatureAmbientSlotId()) return true;
  return remoteGate?.isAudible() ?? false;
}

export async function pauseNatureAmbientForRemote(): Promise<void> {
  const pause = remoteGate?.pause;
  if (!pause) return;
  try {
    await pause();
  } catch {
    /* ignore */
  }
}

export async function resumeNatureAmbientForRemote(): Promise<void> {
  const resume = remoteGate?.resume;
  if (!resume) return;
  try {
    await resume();
  } catch {
    /* ignore */
  }
}
