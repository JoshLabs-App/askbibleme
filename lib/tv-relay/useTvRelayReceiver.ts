"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  readStoredTvPairing,
  TV_RELAY_HTTP_BASE,
  TV_RELAY_WS_BASE,
  writeStoredTvPairing,
  type StoredTvPairing,
  type TvCommand,
  type TvPlaybackState,
} from "./protocol";

export type PairSession = {
  code: string;
  pollSecret: string;
  expiresAt: number;
};

export function useTvRelayReceiver(onCommand: (cmd: TvCommand) => void) {
  const [pairing, setPairing] = useState<StoredTvPairing | null>(null);
  const [connected, setConnected] = useState(false);
  const [pairSession, setPairSession] = useState<PairSession | null>(null);
  const [pairError, setPairError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;

  useEffect(() => {
    setPairing(readStoredTvPairing());
  }, []);

  const sendState = useCallback((state: Omit<TvPlaybackState, "op">) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(JSON.stringify({ op: "state", ...state }));
    } catch {
      /* ignore */
    }
  }, []);

  const unpairLocal = useCallback(() => {
    writeStoredTvPairing(null);
    setPairing(null);
    setConnected(false);
    try {
      wsRef.current?.close(1000, "unpaired");
    } catch {
      /* ignore */
    }
    wsRef.current = null;
  }, []);

  // 已绑定时维持原生 WebSocket 连接（不依赖第三方 SDK，老电视浏览器最稳）
  useEffect(() => {
    if (!pairing) {
      setConnected(false);
      return;
    }
    let stopped = false;
    let retryMs = 1500;
    let reconnectTimer: number | null = null;
    let pingTimer: number | null = null;

    const cleanupTimers = () => {
      if (reconnectTimer != null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (pingTimer != null) {
        window.clearInterval(pingTimer);
        pingTimer = null;
      }
    };

    const connect = () => {
      if (stopped) return;
      const url = `${TV_RELAY_WS_BASE}/ws?role=tv&token=${encodeURIComponent(pairing.tvToken)}`;
      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch {
        reconnectTimer = window.setTimeout(connect, retryMs);
        retryMs = Math.min(retryMs * 2, 15000);
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        if (stopped) return;
        retryMs = 1500;
        setConnected(true);
        if (pingTimer != null) window.clearInterval(pingTimer);
        pingTimer = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send("ping");
            } catch {
              /* ignore */
            }
          }
        }, 25_000);
      };

      ws.onmessage = (ev) => {
        if (typeof ev.data !== "string" || ev.data === "pong") return;
        try {
          const msg = JSON.parse(ev.data) as Record<string, unknown>;
          if (msg.op === "revoked") {
            writeStoredTvPairing(null);
            setPairing(null);
            setConnected(false);
            stopped = true;
            ws.close(1000, "revoked");
            return;
          }
          if (msg.op === "handoff" || msg.op === "control" || msg.op === "stop") {
            onCommandRef.current(msg as unknown as TvCommand);
          }
        } catch {
          /* ignore */
        }
      };

      ws.onclose = (ev) => {
        if (wsRef.current === ws) wsRef.current = null;
        setConnected(false);
        if (pingTimer != null) {
          window.clearInterval(pingTimer);
          pingTimer = null;
        }
        if (ev.code === 4001) {
          writeStoredTvPairing(null);
          setPairing(null);
          stopped = true;
          return;
        }
        if (!stopped) {
          reconnectTimer = window.setTimeout(connect, retryMs);
          retryMs = Math.min(retryMs * 2, 15000);
        }
      };

      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      };
    };

    connect();
    return () => {
      stopped = true;
      cleanupTimers();
      try {
        wsRef.current?.close(1000, "unmount");
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    };
  }, [pairing]);

  // 发起一次配对：获取 6 位配对码
  const startPairing = useCallback(async () => {
    setPairError(null);
    try {
      const res = await fetch(`${TV_RELAY_HTTP_BASE}/pair/start`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as PairSession;
      setPairSession(data);
    } catch {
      setPairError("无法连接配对服务，请检查网络");
    }
  }, []);

  const cancelPairing = useCallback(() => {
    setPairSession(null);
    setPairError(null);
  }, []);

  // 显示配对码期间每 2 秒轮询是否已被手机批准
  useEffect(() => {
    if (!pairSession) return;
    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`${TV_RELAY_HTTP_BASE}/pair/poll`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: pairSession.code, pollSecret: pairSession.pollSecret }),
        });
        const data = (await res.json()) as
          | { status: "approved"; tvToken: string; deviceId: string; userId: string; tvName: string }
          | { status: string };
        if (cancelled) return;
        if (data.status === "approved" && "tvToken" in data) {
          const next: StoredTvPairing = {
            tvToken: data.tvToken,
            deviceId: data.deviceId,
            userId: data.userId,
            tvName: data.tvName || "客厅电视",
          };
          writeStoredTvPairing(next);
          setPairing(next);
          setPairSession(null);
          return;
        }
        if (data.status === "expired") {
          setPairSession(null);
          setPairError("配对码已过期，请重新生成");
        }
      } catch {
        /* 暂时断网，下次继续 */
      }
    };
    const id = window.setInterval(() => void poll(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [pairSession]);

  return {
    pairing,
    connected,
    pairSession,
    pairError,
    startPairing,
    cancelPairing,
    unpairLocal,
    sendState,
  };
}
