import { DurableObject } from "cloudflare:workers";

export interface Env {
  PAIR_ROOM: DurableObjectNamespace<PairRoom>;
  USER_RELAY: DurableObjectNamespace<UserRelayRoom>;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  TV_RELAY_SECRET: string;
}

type TvTokenPayload = {
  deviceId: string;
  userId: string;
  name: string;
  iat: number;
};

type SocketAttachment = {
  role: "tv" | "phone";
  deviceId?: string;
  name?: string;
  state?: Record<string, unknown> | null;
};

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS_HEADERS },
  });
}

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomSixDigitCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(100000 + (buf[0] % 900000));
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(str: string): Uint8Array {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const binary = atob(str.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function signTvToken(payload: TvTokenPayload, secret: string): Promise<string> {
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  return `${payloadB64}.${base64UrlEncode(new Uint8Array(sig))}`;
}

async function verifyTvToken(token: string, secret: string): Promise<TvTokenPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlDecode(sigB64),
      new TextEncoder().encode(payloadB64),
    );
    if (!ok) return null;
    const parsed = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64))) as TvTokenPayload;
    if (!parsed?.deviceId || !parsed?.userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function verifySupabaseUser(accessToken: string, env: Env): Promise<{ id: string; email?: string } | null> {
  const token = accessToken.trim();
  if (!token) return null;
  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: env.SUPABASE_ANON_KEY,
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { id?: string; email?: string };
    if (!data?.id) return null;
    return { id: data.id, email: data.email };
  } catch {
    return null;
  }
}

function bearerFromRequest(req: Request): string {
  const header = req.headers.get("Authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

/** 临时配对房间（每个 6 位配对码一个 DO，10 分钟自动过期清理） */
export class PairRoom extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS pair_state (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          poll_secret_hash TEXT NOT NULL,
          status TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          tv_token TEXT,
          device_id TEXT,
          user_id TEXT,
          tv_name TEXT
        )
      `);
    });
  }

  async start(pollSecretHash: string, expiresAt: number): Promise<void> {
    this.ctx.storage.sql.exec(
      `INSERT OR REPLACE INTO pair_state (id, poll_secret_hash, status, expires_at, tv_token, device_id, user_id, tv_name)
       VALUES (1, ?, 'pending', ?, NULL, NULL, NULL, NULL)`,
      pollSecretHash,
      expiresAt,
    );
    await this.ctx.storage.setAlarm(expiresAt);
  }

  async approve(args: { tvToken: string; deviceId: string; userId: string; tvName: string }): Promise<{ ok: boolean; error?: string }> {
    const row = this.ctx.storage.sql
      .exec<{ status: string; expires_at: number }>("SELECT status, expires_at FROM pair_state WHERE id = 1")
      .toArray()[0];
    if (!row || Date.now() > row.expires_at) {
      return { ok: false, error: "pair_expired" };
    }
    if (row.status !== "pending") {
      return { ok: false, error: "pair_already_used" };
    }
    this.ctx.storage.sql.exec(
      `UPDATE pair_state SET status = 'approved', tv_token = ?, device_id = ?, user_id = ?, tv_name = ? WHERE id = 1`,
      args.tvToken,
      args.deviceId,
      args.userId,
      args.tvName,
    );
    return { ok: true };
  }

  async poll(pollSecretHash: string): Promise<
    | { status: "pending" | "expired" | "unauthorized" }
    | { status: "approved"; tvToken: string; deviceId: string; userId: string; tvName: string }
  > {
    const row = this.ctx.storage.sql
      .exec<{
        poll_secret_hash: string;
        status: string;
        expires_at: number;
        tv_token: string | null;
        device_id: string | null;
        user_id: string | null;
        tv_name: string | null;
      }>("SELECT * FROM pair_state WHERE id = 1")
      .toArray()[0];
    if (!row || Date.now() > row.expires_at) {
      return { status: "expired" };
    }
    if (row.poll_secret_hash !== pollSecretHash) {
      return { status: "unauthorized" };
    }
    if (row.status === "approved" && row.tv_token && row.device_id && row.user_id) {
      this.ctx.storage.sql.exec("DELETE FROM pair_state WHERE id = 1");
      return {
        status: "approved",
        tvToken: row.tv_token,
        deviceId: row.device_id,
        userId: row.user_id,
        tvName: row.tv_name ?? "客厅电视",
      };
    }
    return { status: "pending" };
  }

  async alarm(): Promise<void> {
    this.ctx.storage.sql.exec("DELETE FROM pair_state WHERE id = 1");
  }
}

/** 每个账号一个中继房间：管理已授权电视列表、在线状态、手机→电视控制指令与电视→手机状态回传 */
export class UserRelayRoom extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS tv_devices (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          last_seen_at INTEGER NOT NULL,
          revoked_at INTEGER
        )
      `);
    });
  }

  async registerDevice(deviceId: string, name: string): Promise<void> {
    const now = Date.now();
    this.ctx.storage.sql.exec(
      `INSERT OR REPLACE INTO tv_devices (id, name, created_at, last_seen_at, revoked_at)
       VALUES (?, ?, ?, ?, NULL)`,
      deviceId,
      name,
      now,
      now,
    );
    this.broadcastDevicesToPhones();
  }

  async isDeviceActive(deviceId: string): Promise<boolean> {
    const row = this.ctx.storage.sql
      .exec<{ revoked_at: number | null }>("SELECT revoked_at FROM tv_devices WHERE id = ?", deviceId)
      .toArray()[0];
    return Boolean(row && row.revoked_at === null);
  }

  async revokeDevice(deviceId: string): Promise<void> {
    const now = Date.now();
    this.ctx.storage.sql.exec("UPDATE tv_devices SET revoked_at = ? WHERE id = ?", now, deviceId);
    for (const ws of this.ctx.getWebSockets(deviceId)) {
      try {
        ws.send(JSON.stringify({ op: "revoked" }));
        ws.close(4001, "device_revoked");
      } catch {
        /* ignore */
      }
    }
    this.broadcastDevicesToPhones();
  }

  async listDevices(): Promise<Array<{ id: string; name: string; online: boolean; lastSeenAt: number; state: Record<string, unknown> | null }>> {
    const rows = this.ctx.storage.sql
      .exec<{ id: string; name: string; last_seen_at: number }>(
        "SELECT id, name, last_seen_at FROM tv_devices WHERE revoked_at IS NULL ORDER BY last_seen_at DESC",
      )
      .toArray();
    const onlineMap = new Map<string, Record<string, unknown> | null>();
    for (const ws of this.ctx.getWebSockets("tv")) {
      const att = ws.deserializeAttachment() as SocketAttachment | null;
      if (att?.deviceId) onlineMap.set(att.deviceId, att.state ?? null);
    }
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      online: onlineMap.has(r.id),
      lastSeenAt: r.last_seen_at,
      state: onlineMap.get(r.id) ?? null,
    }));
  }

  async sendCommand(
    cmd: Record<string, unknown>,
    targetDeviceId?: string,
  ): Promise<{ ok: boolean; deviceId?: string; error?: string }> {
    const tvSockets = targetDeviceId ? this.ctx.getWebSockets(targetDeviceId) : this.ctx.getWebSockets("tv");
    if (tvSockets.length === 0) {
      return { ok: false, error: "tv_offline" };
    }
    const payload = JSON.stringify(cmd);
    let chosenId: string | undefined;
    for (const ws of tvSockets) {
      const att = ws.deserializeAttachment() as SocketAttachment | null;
      if (!targetDeviceId && chosenId && att?.deviceId !== chosenId) continue;
      chosenId = att?.deviceId ?? chosenId;
      try {
        ws.send(payload);
      } catch {
        /* ignore */
      }
    }
    return { ok: true, deviceId: chosenId };
  }

  private broadcastDevicesToPhones(): void {
    void this.listDevices().then((devices) => {
      const msg = JSON.stringify({ op: "devices", devices });
      for (const ws of this.ctx.getWebSockets("phone")) {
        try {
          ws.send(msg);
        } catch {
          /* ignore */
        }
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }
    const url = new URL(request.url);
    const role = url.searchParams.get("role") === "tv" ? "tv" : "phone";
    const deviceId = url.searchParams.get("deviceId") ?? undefined;
    const name = url.searchParams.get("name") ?? undefined;

    if (role === "tv" && deviceId) {
      const active = await this.isDeviceActive(deviceId);
      if (!active) return new Response("Device revoked", { status: 403 });
      this.ctx.storage.sql.exec("UPDATE tv_devices SET last_seen_at = ? WHERE id = ?", Date.now(), deviceId);
      // 同一台电视重连时关闭旧连接，避免重复收指令
      for (const old of this.ctx.getWebSockets(deviceId)) {
        try {
          old.close(1000, "replaced");
        } catch {
          /* ignore */
        }
      }
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const tags = role === "tv" && deviceId ? ["tv", deviceId] : ["phone"];
    this.ctx.acceptWebSocket(server, tags);
    server.serializeAttachment({ role, deviceId, name, state: null } satisfies SocketAttachment);

    if (role === "tv") {
      this.broadcastDevicesToPhones();
    } else {
      void this.listDevices().then((devices) => {
        try {
          server.send(JSON.stringify({ op: "devices", devices }));
        } catch {
          /* ignore */
        }
      });
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") return;
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(message) as Record<string, unknown>;
    } catch {
      return;
    }
    const att = ws.deserializeAttachment() as SocketAttachment | null;
    if (!att) return;

    if (att.role === "tv" && att.deviceId) {
      if (data.op === "state") {
        const nextAtt: SocketAttachment = { ...att, state: data };
        ws.serializeAttachment(nextAtt);
        this.ctx.storage.sql.exec("UPDATE tv_devices SET last_seen_at = ? WHERE id = ?", Date.now(), att.deviceId);
        const out = JSON.stringify({ ...data, deviceId: att.deviceId, name: att.name });
        for (const phone of this.ctx.getWebSockets("phone")) {
          try {
            phone.send(out);
          } catch {
            /* ignore */
          }
        }
      }
      return;
    }

    if (att.role === "phone") {
      if (data.op === "list") {
        const devices = await this.listDevices();
        ws.send(JSON.stringify({ op: "devices", devices }));
        return;
      }
      if (data.op === "handoff" || data.op === "control" || data.op === "stop") {
        const target = typeof data.deviceId === "string" ? data.deviceId : undefined;
        const res = await this.sendCommand(data, target);
        if (!res.ok) {
          ws.send(JSON.stringify({ op: "error", error: res.error, cmdId: data.cmdId }));
        }
      }
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const att = ws.deserializeAttachment() as SocketAttachment | null;
    if (att?.role === "tv") {
      this.broadcastDevicesToPhones();
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    const att = ws.deserializeAttachment() as SocketAttachment | null;
    if (att?.role === "tv") {
      this.broadcastDevicesToPhones();
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/health") {
      return jsonResponse({ ok: true, service: "askbible-tv-relay" });
    }

    if (path === "/pair/start" && request.method === "POST") {
      const code = randomSixDigitCode();
      const pollSecret = randomHex(24);
      const pollSecretHash = await sha256Hex(pollSecret);
      const expiresAt = Date.now() + 10 * 60 * 1000;
      const room = env.PAIR_ROOM.getByName(code);
      await room.start(pollSecretHash, expiresAt);
      return jsonResponse({ code, pollSecret, expiresAt });
    }

    if (path === "/pair/poll" && request.method === "POST") {
      const body = (await request.json().catch(() => null)) as { code?: string; pollSecret?: string } | null;
      const code = body?.code?.trim() ?? "";
      const pollSecret = body?.pollSecret?.trim() ?? "";
      if (!/^\d{6}$/.test(code) || !pollSecret) {
        return jsonResponse({ status: "invalid" }, 400);
      }
      const room = env.PAIR_ROOM.getByName(code);
      const res = await room.poll(await sha256Hex(pollSecret));
      return jsonResponse(res);
    }

    if (path === "/pair/approve" && request.method === "POST") {
      const user = await verifySupabaseUser(bearerFromRequest(request), env);
      if (!user) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
      const body = (await request.json().catch(() => null)) as { code?: string; tvName?: string } | null;
      const code = body?.code?.trim() ?? "";
      if (!/^\d{6}$/.test(code)) return jsonResponse({ ok: false, error: "invalid_code" }, 400);
      const tvName = (body?.tvName?.trim() || "客厅电视").slice(0, 40);
      const deviceId = `tv_${randomHex(8)}`;
      const tvToken = await signTvToken({ deviceId, userId: user.id, name: tvName, iat: Date.now() }, env.TV_RELAY_SECRET);

      const pairRoom = env.PAIR_ROOM.getByName(code);
      const approved = await pairRoom.approve({ tvToken, deviceId, userId: user.id, tvName });
      if (!approved.ok) {
        return jsonResponse({ ok: false, error: approved.error }, 400);
      }
      const userRelay = env.USER_RELAY.getByName(user.id);
      await userRelay.registerDevice(deviceId, tvName);
      return jsonResponse({ ok: true, device: { id: deviceId, name: tvName } });
    }

    if (path === "/devices" && request.method === "GET") {
      const user = await verifySupabaseUser(bearerFromRequest(request), env);
      if (!user) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
      const userRelay = env.USER_RELAY.getByName(user.id);
      const devices = await userRelay.listDevices();
      return jsonResponse({ ok: true, devices });
    }

    if (path.startsWith("/devices/") && request.method === "DELETE") {
      const user = await verifySupabaseUser(bearerFromRequest(request), env);
      if (!user) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
      const deviceId = decodeURIComponent(path.slice("/devices/".length)).trim();
      if (!deviceId) return jsonResponse({ ok: false, error: "invalid_device" }, 400);
      const userRelay = env.USER_RELAY.getByName(user.id);
      await userRelay.revokeDevice(deviceId);
      return jsonResponse({ ok: true });
    }

    if (path === "/cmd" && request.method === "POST") {
      const user = await verifySupabaseUser(bearerFromRequest(request), env);
      if (!user) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body || typeof body.op !== "string") {
        return jsonResponse({ ok: false, error: "invalid_cmd" }, 400);
      }
      const userRelay = env.USER_RELAY.getByName(user.id);
      const target = typeof body.deviceId === "string" ? body.deviceId : undefined;
      const res = await userRelay.sendCommand(body, target);
      return jsonResponse(res, res.ok ? 200 : 409);
    }

    if (path === "/ws") {
      const role = url.searchParams.get("role");
      const token = url.searchParams.get("token") ?? "";
      if (role === "tv") {
        const verified = await verifyTvToken(token, env.TV_RELAY_SECRET);
        if (!verified) return new Response("Invalid TV token", { status: 401 });
        const userRelay = env.USER_RELAY.getByName(verified.userId);
        const forwardUrl = new URL(request.url);
        forwardUrl.searchParams.set("role", "tv");
        forwardUrl.searchParams.set("deviceId", verified.deviceId);
        forwardUrl.searchParams.set("name", verified.name);
        return userRelay.fetch(new Request(forwardUrl.toString(), request));
      }
      if (role === "phone") {
        const user = await verifySupabaseUser(token, env);
        if (!user) return new Response("Unauthorized", { status: 401 });
        const userRelay = env.USER_RELAY.getByName(user.id);
        const forwardUrl = new URL(request.url);
        forwardUrl.searchParams.set("role", "phone");
        return userRelay.fetch(new Request(forwardUrl.toString(), request));
      }
      return new Response("Invalid role", { status: 400 });
    }

    return jsonResponse({ error: "not_found" }, 404);
  },
};
