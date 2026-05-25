import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requirePlayer, requireAdmin } from "./session.server";

// ---------- Player-facing ----------

export const listGames = createServerFn({ method: "GET" }).handler(async () => {
  await requirePlayer();
  const { data: games } = await supabaseAdmin
    .from("games")
    .select("id, title, date, time, status, max_players, contribution_amount, notes, location_id, locations(id, name, address, maps_url, photo_url)")
    .order("date", { ascending: false });

  const { data: confirmations } = await supabaseAdmin
    .from("confirmations")
    .select("game_id, player_id, status");

  return { games: games ?? [], confirmations: confirmations ?? [] };
});

export const getGameDetail = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const me = await requirePlayer();
    const { data: game } = await supabaseAdmin
      .from("games")
      .select("*, locations(*)")
      .eq("id", data.id)
      .maybeSingle();

    const { data: confs } = await supabaseAdmin
      .from("confirmations")
      .select("status, player_id, players(id, name, avatar_url, position)")
      .eq("game_id", data.id);

    const { data: myPayment } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("game_id", data.id)
      .eq("player_id", me.id)
      .maybeSingle();

    return { game, confirmations: confs ?? [], myPayment };
  });

export const getHomeData = createServerFn({ method: "GET" }).handler(async () => {
  const me = await requirePlayer();
  const today = new Date().toISOString().slice(0, 10);

  const { data: nextGame } = await supabaseAdmin
    .from("games")
    .select("*, locations(*)")
    .gte("date", today)
    .eq("status", "scheduled")
    .order("date", { ascending: true })
    .order("time", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!nextGame) return { me, nextGame: null, confirmations: [], myConfirmation: null, myPayment: null };

  const { data: confs } = await supabaseAdmin
    .from("confirmations")
    .select("status, player_id, players(id, name, avatar_url, position)")
    .eq("game_id", nextGame.id);

  const myConfirmation = (confs ?? []).find((c) => c.player_id === me.id) ?? null;

  const { data: myPayment } = await supabaseAdmin
    .from("payments")
    .select("*")
    .eq("game_id", nextGame.id)
    .eq("player_id", me.id)
    .maybeSingle();

  return { me, nextGame, confirmations: confs ?? [], myConfirmation, myPayment };
});

export const setMyConfirmation = createServerFn({ method: "POST" })
  .inputValidator((d: { gameId: string; status: "confirmed" | "cancelled" }) =>
    z.object({
      gameId: z.string().uuid(),
      status: z.enum(["confirmed", "cancelled"]),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const me = await requirePlayer();
    const { error } = await supabaseAdmin
      .from("confirmations")
      .upsert(
        { game_id: data.gameId, player_id: me.id, status: data.status },
        { onConflict: "game_id,player_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listLocations = createServerFn({ method: "GET" }).handler(async () => {
  await requirePlayer();
  const { data } = await supabaseAdmin
    .from("locations")
    .select("*")
    .order("name");
  return data ?? [];
});

export const listMyPayments = createServerFn({ method: "GET" }).handler(async () => {
  const me = await requirePlayer();
  const { data } = await supabaseAdmin
    .from("payments")
    .select("*, games(id, title, date, time)")
    .eq("player_id", me.id)
    .order("created_at", { ascending: false });
  return data ?? [];
});

export const myAttendanceHistory = createServerFn({ method: "GET" }).handler(async () => {
  const me = await requirePlayer();
  const { data } = await supabaseAdmin
    .from("confirmations")
    .select("status, games(id, title, date, time)")
    .eq("player_id", me.id)
    .eq("status", "confirmed")
    .order("created_at", { ascending: false });
  return data ?? [];
});
