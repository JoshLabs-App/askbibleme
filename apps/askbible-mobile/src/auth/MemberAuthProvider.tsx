import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { loginMobileMember, registerMobileMember } from "../api/memberAuth";
import { getAskBibleBaseUrl, toAbsoluteUrl } from "../config/askbibleBaseUrl";
import { isMobileBundledOnly, isMobileOfflineFirst } from "../config/mobileBundledOnly";
import { fetchWithTimeout } from "../api/fetchWithTimeout";
import { hydrateMemberRegisterEnabled } from "./member-register-enabled";
import {
  clearMemberSession,
  readMemberSession,
  writeMemberSession,
  type MemberSession,
  type MemberUser,
} from "./memberSession";

type MemberAuthContextValue = {
  bootstrapped: boolean;
  user: MemberUser | null;
  signIn: (input: { email: string; password: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
  signOut: () => Promise<void>;
  completeRegistration: (input: {
    email: string;
    password: string;
    name?: string;
    locale?: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
};

const MemberAuthContext = createContext<MemberAuthContextValue | null>(null);

async function verifyRemoteSession(session: MemberSession): Promise<MemberUser | null> {
  const base = getAskBibleBaseUrl();
  const res = await fetchWithTimeout(toAbsoluteUrl(base, "/api/mobile/auth/session"), {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${session.sessionToken}`,
    },
    timeoutMs: 10_000,
  });
  if (!res.ok) return session.user;
  const data = (await res.json().catch(() => null)) as {
    user?: { id?: string; email?: string; name?: string } | null;
  } | null;
  const remoteUser = data?.user;
  if (!remoteUser || typeof remoteUser.id !== "string" || typeof remoteUser.email !== "string") return null;
  return {
    id: remoteUser.id,
    email: remoteUser.email,
    name: typeof remoteUser.name === "string" ? remoteUser.name : remoteUser.email,
  };
}

async function persistSession(input: {
  sessionToken: string;
  expiresAt: string;
  user: MemberUser;
}): Promise<void> {
  await writeMemberSession({
    sessionToken: input.sessionToken,
    expiresAt: input.expiresAt,
    user: input.user,
  });
}

export function MemberAuthProvider({ children }: { children: ReactNode }) {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [user, setUser] = useState<MemberUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await hydrateMemberRegisterEnabled();
      const local = await readMemberSession();
      if (cancelled) return;
      if (!local) {
        setBootstrapped(true);
        return;
      }
      setUser(local.user);
      if (!isMobileOfflineFirst()) {
        try {
          const remote = await verifyRemoteSession(local);
          if (cancelled) return;
          if (!remote) {
            await clearMemberSession();
            setUser(null);
          } else {
            setUser(remote);
          }
        } catch {
          // keep local session when offline/unreachable
        }
      }
      setBootstrapped(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (input: { email: string; password: string }) => {
    if (isMobileBundledOnly()) {
      return { ok: false as const, error: "network" };
    }
    try {
      const result = await loginMobileMember(input);
      if (!result.ok) {
        return { ok: false as const, error: result.error };
      }
      await persistSession({
        sessionToken: result.sessionToken,
        expiresAt: result.expiresAt,
        user: result.user,
      });
      setUser(result.user);
      return { ok: true as const };
    } catch {
      return { ok: false as const, error: "network" };
    }
  }, []);

  const completeRegistration = useCallback(
    async (input: { email: string; password: string; name?: string; locale?: string }) => {
      if (isMobileBundledOnly()) {
        return { ok: false as const, error: "network" };
      }
      try {
        const result = await registerMobileMember(input);
        if (!result.ok) {
          return { ok: false as const, error: result.error };
        }
        if (!result.sessionToken || !result.expiresAt) {
          return { ok: false as const, error: "invalid_response" };
        }
        await persistSession({
          sessionToken: result.sessionToken,
          expiresAt: result.expiresAt,
          user: result.user,
        });
        setUser(result.user);
        return { ok: true as const };
      } catch {
        return { ok: false as const, error: "network" };
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    await clearMemberSession();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ bootstrapped, user, signIn, signOut, completeRegistration }),
    [bootstrapped, user, signIn, signOut, completeRegistration],
  );

  return <MemberAuthContext.Provider value={value}>{children}</MemberAuthContext.Provider>;
}

export function useMemberAuth(): MemberAuthContextValue {
  const ctx = useContext(MemberAuthContext);
  if (!ctx) throw new Error("useMemberAuth must be used within MemberAuthProvider");
  return ctx;
}
