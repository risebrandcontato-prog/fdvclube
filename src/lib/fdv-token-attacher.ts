import { createMiddleware } from "@tanstack/react-start";
import { getStoredToken } from "@/lib/session-client";

// Client-side function middleware: attach the FDV device token to every server-fn RPC
// so the server can resolve the current player via session.server.ts.
export const attachFdvToken = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const token = getStoredToken();
    return next({
      headers: token ? { "x-fdv-token": token } : {},
    });
  },
);
