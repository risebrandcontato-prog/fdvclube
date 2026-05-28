// Client-side device-token session store. Browser-only.
const KEY = "fdv_session_token";
const COOKIE_KEY = "fdv_session_token";

function setCookieToken(token: string) {
  if (typeof document === "undefined") return;
  // Keep cookie simple so SSR loaders can authenticate on hard refresh (F5).
  // SameSite=Lax allows normal navigations; path=/ shares across admin/app.
  document.cookie = `${COOKIE_KEY}=${encodeURIComponent(token)}; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`;
}

function clearCookieToken() {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, token);
    setCookieToken(token);
  } catch {
    /* ignore */
  }
}

export function clearStoredToken() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
    clearCookieToken();
  } catch {
    /* ignore */
  }
}
