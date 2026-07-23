import "server-only";

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  TESTNET_STRATEGY,
  type ManagedTestnetPosition,
} from "@/lib/invest/testnet-strategy";

const stateLockGlobal = globalThis as typeof globalThis & {
  __askBibleInvestStateLock?: Promise<void>;
};

export type AutoDecisionAction =
  | "PAUSED"
  | "HOLD"
  | "BUY"
  | "PROTECTED"
  | "EMERGENCY_EXIT"
  | "ERROR";

export type AutoDecision = {
  action: AutoDecisionAction;
  state: string;
  rationale: string;
  nextAction: string;
  nextTrigger: string;
  evaluatedAt: string;
  metrics?: {
    price?: number;
    sma20?: number;
    sma50?: number;
    rsi14?: number;
  };
};

export type PendingAutoEntry = {
  symbol: string;
  quoteOrderUsdt: number;
  orderClientId: string;
  listClientId: string;
  aboveClientId: string;
  belowClientId: string;
  createdAt: string;
};

export type TestnetAutoState = {
  version: 1;
  paused: boolean;
  pauseReason: string | null;
  managedPositions: ManagedTestnetPosition[];
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastDecision: AutoDecision | null;
  lastError: string | null;
  pendingEntry: PendingAutoEntry | null;
};

const INITIAL_POSITIONS: ManagedTestnetPosition[] =
  TESTNET_STRATEGY.managedPositions.map((position) => ({
    ...position,
    protectiveOrderIds: [...position.protectiveOrderIds],
  }));

function defaultState(): TestnetAutoState {
  return {
    version: 1,
    paused: false,
    pauseReason: null,
    managedPositions: INITIAL_POSITIONS,
    lastRunAt: null,
    nextRunAt: null,
    lastDecision: null,
    lastError: null,
    pendingEntry: null,
  };
}

function stateDirectory() {
  const root = process.env.DATA_ROOT?.trim();
  return root ? join(root, "invest") : join(tmpdir(), "askbible-invest");
}

function statePath() {
  return join(stateDirectory(), "auto-state-v1.json");
}

function mergeInitialPositions(
  positions: ManagedTestnetPosition[] | undefined,
) {
  const byBuyOrder = new Map<number, ManagedTestnetPosition>();
  for (const position of [...INITIAL_POSITIONS, ...(positions ?? [])]) {
    byBuyOrder.set(position.buyOrderId, {
      ...position,
      protectiveOrderIds: [...position.protectiveOrderIds],
      emergencyExitOrderIds: position.emergencyExitOrderIds
        ? [...position.emergencyExitOrderIds]
        : undefined,
    });
  }
  return [...byBuyOrder.values()];
}

function normalizeState(value: Partial<TestnetAutoState>): TestnetAutoState {
  return {
    version: 1,
    paused: Boolean(value.paused),
    pauseReason:
      typeof value.pauseReason === "string" ? value.pauseReason : null,
    managedPositions: mergeInitialPositions(value.managedPositions),
    lastRunAt: typeof value.lastRunAt === "string" ? value.lastRunAt : null,
    nextRunAt: typeof value.nextRunAt === "string" ? value.nextRunAt : null,
    lastDecision: value.lastDecision ?? null,
    lastError: typeof value.lastError === "string" ? value.lastError : null,
    pendingEntry: value.pendingEntry ?? null,
  };
}

export async function readTestnetAutoState(): Promise<TestnetAutoState> {
  try {
    const contents = await readFile(statePath(), "utf8");
    return normalizeState(JSON.parse(contents) as Partial<TestnetAutoState>);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code !== "ENOENT"
    ) {
      throw error;
    }
    return defaultState();
  }
}

export async function writeTestnetAutoState(state: TestnetAutoState) {
  const directory = stateDirectory();
  const destination = statePath();
  const temporary = `${destination}.${process.pid}.tmp`;
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temporary, destination);
}

export async function withTestnetAutoStateLock<T>(operation: () => Promise<T>) {
  const previous =
    stateLockGlobal.__askBibleInvestStateLock ?? Promise.resolve();
  let release: (() => void) | undefined;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  stateLockGlobal.__askBibleInvestStateLock = previous.then(() => current);
  await previous;
  try {
    return await operation();
  } finally {
    release?.();
  }
}

export async function setTestnetAutoPaused(
  paused: boolean,
  reason: string | null,
) {
  return withTestnetAutoStateLock(async () => {
    const state = await readTestnetAutoState();
    state.paused = paused;
    state.pauseReason = paused ? reason || "由控制台暂停" : null;
    if (!paused) state.lastError = null;
    await writeTestnetAutoState(state);
    return state;
  });
}
