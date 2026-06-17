import { useEffect } from "react";
import { InteractionManager } from "react-native";
import { isMobileOfflineFirst } from "../config/mobileBundledOnly";
import { isNetworkAvailable } from "../network/isNetworkAvailable";
import {
  hydrateMemberRegisterEnabled,
  scheduleMemberRegisterEnabledRemoteHydrate,
} from "./member-register-enabled";
import {
  clearMemberSession,
  readMemberSession,
  writeMemberSession,
  type MemberUser,
} from "./memberSession";
import { verifyRemoteMemberSession } from "./memberAuthSessionCommit";

export function useMemberAuthBootstrap(
  setBootstrapped: (ready: boolean) => void,
  setUser: (user: MemberUser | null) => void,
): void {
  useEffect(() => {
    let cancelled = false;
    let verifyTask: { cancel: () => void } | null = null;
    const task = InteractionManager.runAfterInteractions(() => {
      void (async () => {
        await hydrateMemberRegisterEnabled();
        scheduleMemberRegisterEnabledRemoteHydrate();
        const local = await readMemberSession();
        if (cancelled) return;
        if (!local) {
          setBootstrapped(true);
          return;
        }
        setUser(local.user);
        setBootstrapped(true);
        if (!isMobileOfflineFirst()) {
          verifyTask = InteractionManager.runAfterInteractions(() => {
            void (async () => {
              if (cancelled || !(await isNetworkAvailable())) return;
              try {
                const remote = await verifyRemoteMemberSession(local);
                if (cancelled) return;
                if (!remote) {
                  await clearMemberSession();
                  setUser(null);
                } else {
                  await writeMemberSession({
                    sessionToken: local.sessionToken,
                    expiresAt: local.expiresAt,
                    user: remote,
                  });
                  setUser(remote);
                }
              } catch {
                // keep local session when offline/unreachable
              }
            })();
          });
        }
      })();
    });
    return () => {
      cancelled = true;
      task.cancel();
      verifyTask?.cancel();
    };
  }, [setBootstrapped, setUser]);
}
