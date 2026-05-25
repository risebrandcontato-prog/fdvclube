import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMe, logout as logoutFn } from "@/lib/auth.functions";
import { clearStoredToken, setStoredToken, getStoredToken } from "@/lib/session-client";

type Player = Awaited<ReturnType<typeof getMe>>;

type Ctx = {
  player: Player | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setSession: (token: string) => Promise<void>;
  logout: () => Promise<void>;
};

const SessionCtx = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const getMeFn = useServerFn(getMe);
  const logoutSrv = useServerFn(logoutFn);

  const refresh = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setPlayer(null);
      setLoading(false);
      return;
    }
    try {
      const p = await getMeFn();
      setPlayer(p);
    } catch {
      setPlayer(null);
    } finally {
      setLoading(false);
    }
  }, [getMeFn]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setSession = useCallback(async (token: string) => {
    setStoredToken(token);
    setLoading(true);
    await refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try { await logoutSrv(); } catch { /* ignore */ }
    clearStoredToken();
    setPlayer(null);
  }, [logoutSrv]);

  return (
    <SessionCtx.Provider value={{ player, loading, refresh, setSession, logout }}>
      {children}
    </SessionCtx.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionCtx);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
