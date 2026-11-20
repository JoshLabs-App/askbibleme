"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  makeCmdId,
  TV_RELAY_HTTP_BASE,
  type TvCommand,
  type TvDeviceInfo,
  type TvMediaPayload,
} from "./protocol";

async function getAccessToken(): Promise<string | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function approveTvPair(code: string, tvName?: string): Promise<{ ok: boolean; error?: string; device?: { id: string; name: string } }> {
  const token = await getAccessToken();
  if (!token) return { ok: false, error: "unauthorized" };
  try {
    const res = await fetch(`${TV_RELAY_HTTP_BASE}/pair/approve`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: code.trim(), tvName: tvName?.trim() || undefined }),
    });
    return (await res.json()) as { ok: boolean; error?: string; device?: { id: string; name: string } };
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function fetchTvDevices(): Promise<TvDeviceInfo[]> {
  const token = await getAccessToken();
  if (!token) return [];
  try {
    const res = await fetch(`${TV_RELAY_HTTP_BASE}/devices`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { devices?: TvDeviceInfo[] };
    return data.devices ?? [];
  } catch {
    return [];
  }
}

export async function revokeTvDevice(deviceId: string): Promise<boolean> {
  const token = await getAccessToken();
  if (!token) return false;
  try {
    const res = await fetch(`${TV_RELAY_HTTP_BASE}/devices/${encodeURIComponent(deviceId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendTvCommand(cmd: TvCommand): Promise<{ ok: boolean; deviceId?: string; error?: string }> {
  const token = await getAccessToken();
  if (!token) return { ok: false, error: "unauthorized" };
  try {
    const res = await fetch(`${TV_RELAY_HTTP_BASE}/cmd`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cmd),
    });
    return (await res.json()) as { ok: boolean; deviceId?: string; error?: string };
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function handoffToTv(media: TvMediaPayload, deviceId?: string) {
  return sendTvCommand({
    op: "handoff",
    cmdId: makeCmdId(),
    deviceId,
    media,
    sentAt: Date.now(),
  });
}
