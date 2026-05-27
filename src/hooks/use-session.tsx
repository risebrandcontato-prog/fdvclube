import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMe, logout as logoutFn } from "@/lib/auth.functions";
import { clearStoredToken, setStoredToken, getStoredToken } from "@/lib/session-client";

type Player = Awaited<ReturnType<typeof getMe>>;

type Ctx = {
  player: Player | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setSession: (token: string) => Promise<void>;
  logout: () => Promise<void>;
};

const SessionCtx = createContext<Ctx | null>(null);

const MAX_RETRIES = 3;
const RETRY_DELAY = 800;

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const getMeFn = useServerFn(getMe);
  const logoutSrv = useServerFn(logoutFn);
  const retryCount = useRef(0);
  const isMounted = useRef(true);

  const refresh = useCallback(async (force = false) => {
    if (!isMounted.current) return;

    const token = getStoredToken();
    if (!token) {
      setPlayer(null);
      setLoading(false);
      setError(null);
      retryCount.current = 0;
      return;
    }

    // Se já temos player e não é force refresh, não recarrega
    if (!force && player && retryCount.current === 0) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const p = await getMeFn();

      if (!isMounted.current) return;

      setPlayer(p);
      setError(null);
      retryCount.current = 0;
    } catch (err: any) {
      if (!isMounted.current) return;

      const errMsg = err?.message ?? "";
      const isAuthError = errMsg.includes("UNAUTHENTICATED") || errMsg.includes("BLOCKED") || err?.status === 401;
      const isNetworkError = errMsg.includes("fetch") || errMsg.includes("network") || errMsg.includes("Failed") || !navigator.onLine;

      if (isNetworkError && retryCount.current < MAX_RETRIES) {
        // Erro de rede — tenta novamente após delay
        retryCount.current++;
        setTimeout(() => {
          if (isMounted.current) void refresh(force);
        }, RETRY_DELAY * retryCount.current);
        return;
      }

      if (isAuthError) {
        // Token inválido — limpa sessão
        clearStoredToken();
        setPlayer(null);
        setError("UNAUTHENTICATED");
      } else {
        // Outro erro — mantém player anterior se existir
        setError(errMsg || "Erro ao carregar sessão");
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [getMeFn, player]);

  useEffect(() => {
    void refresh();

    return () => {
      isMounted.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listener para quando o app volta ao foreground (mobile)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        retryCount.current = 0;
        void refresh(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [refresh]);

  const setSession = useCallback(async (token: string) => {
    setStoredToken(token);
    setLoading(true);
    retryCount.current = 0;
    await refresh(true);
  }, [refresh]);

  const logout = useCallback(async () => {
    try { await logoutSrv(); } catch { /* ignore */ }
    clearStoredToken();
    setPlayer(null);
    setError(null);
    retryCount.current = 0;
  }, [logoutSrv]);

  return (
    <SessionCtx.Provider value={{ player, loading, error, refresh, setSession, logout }}>
      {children}
    </SessionCtx.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionCtx);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}