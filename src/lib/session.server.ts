// Server-only helpers that resolve the current player from the X-FDV-Token header.
import { getRequestHeader } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveAdminSession } from "./admin.session";

export type SessionPlayer = {
  id: string;
  name: string;
  avatar_url: string | null;
  position: "goleiro" | "defensor" | "meio" | "atacante";
  is_admin: boolean;
  is_blocked: boolean;
};

export async function resolveSessionPlayer(): Promise<SessionPlayer | null> {
  const token = getRequestHeader("x-fdv-token");
  if (!token) return null;

  const { data: session } = await supabaseAdmin
    .from("player_sessions")
    .select("player_id")
    .eq("token", token)
    .maybeSingle();

  if (!session) return null;

  const { data: player } = await supabaseAdmin
    .from("players")
    .select("id, name, avatar_url, position, is_admin, is_blocked")
    .eq("id", session.player_id)
    .maybeSingle();

  if (!player) return null;

  // Touch last_used_at, fire and forget
  void supabaseAdmin
    .from("player_sessions")
    .update({ last_used_at: new Date().toISOString() })
    .eq("token", token);

  return player as SessionPlayer;
}

export async function requirePlayer(): Promise<SessionPlayer> {
  const p = await resolveSessionPlayer();
  if (!p) throw new Error("UNAUTHENTICATED");
  if (p.is_blocked) throw new Error("BLOCKED");
  return p;
}

// ─────────────────────────────────────────────
// Admin access: accepts BOTH player-admin AND standalone admin
// ─────────────────────────────────────────────
export async function requireAdmin(): Promise<SessionPlayer> {
  const p = await requirePlayer();
  if (!p.is_admin) throw new Error("FORBIDDEN");
  return p;
}

export async function requireAdminAccess(): Promise<
  | { type: "player"; player: SessionPlayer }
  | { type: "system"; adminSession: import("./admin.session").AdminSession }
> {
  // Try player session first (player who is also admin)
  const player = await resolveSessionPlayer();
  if (player && player.is_admin && !player.is_blocked) {
    return { type: "player", player };
  }

  // Try standalone admin session (pure admin login)
  const adminSession = await resolveAdminSession();
  if (adminSession) {
    return { type: "system", adminSession };
  }

  throw new Error("UNAUTHENTICATED");
}