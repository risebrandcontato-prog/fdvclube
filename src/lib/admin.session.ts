// Server-only helpers that resolve the current ADMIN from the X-FDV-Token header.
// Used by the standalone admin login (not player-based).

import { getRequestHeader } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AdminSession = {
  id: string;
  token: string;
};

export async function resolveAdminSession(): Promise<AdminSession | null> {
  const token = getRequestHeader("x-fdv-token");
  if (!token) return null;

  const { data: session } = await supabaseAdmin
    .from("admin_sessions")
    .select("id, token")
    .eq("token", token)
    .maybeSingle();

  if (!session) return null;

  // Touch last_used_at, fire and forget
  void supabaseAdmin
    .from("admin_sessions")
    .update({ last_used_at: new Date().toISOString() })
    .eq("token", token);

  return session as AdminSession;
}