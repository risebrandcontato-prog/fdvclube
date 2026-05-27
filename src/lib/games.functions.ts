import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requirePlayer } from "./session.server";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
export interface Location {
  id: string;
  name: string;
  address: string | null;
  maps_url: string | null;
  photo_url: string | null;
  phone: string | null;
  price_per_hour: number | null;
  opening_hours: string | null;
  rating: number | null;
  notes: string | null;
  created_at: string;
}

export const listGames = createServerFn({ method: "GET" }).handler(async () => {
  const me = await requirePlayer();

  // 1. Busca todos os jogos
  const { data: games, error: gamesError } = await supabaseAdmin
    .from("games")
    .select("*")
    .order("date", { ascending: false });

  if (gamesError) {
    console.error("[listGames] games error:", gamesError);
    throw new Error(gamesError.message);
  }

  const gameList = (games ?? []) as any[];

  // 2. Busca locations separadamente
  const locationIds = [...new Set(gameList.map((g) => g.location_id).filter(Boolean))];
  let locationsMap: Record<string, any> = {};
  if (locationIds.length > 0) {
    const { data: locs } = await supabaseAdmin
      .from("locations")
      .select("id, name, address, maps_url, photo_url")
      .in("id", locationIds);
    if (locs) {
      for (const loc of locs) locationsMap[loc.id] = loc;
    }
  }

  // 3. Busca todas as confirmações
  const { data: confirmations } = await supabaseAdmin
    .from("confirmations")
    .select("game_id, player_id, status, players(id, name, avatar_url, position)")
    .order("created_at", { ascending: true });

  // 4. Busca todos os pagamentos do jogador logado
  const { data: myPayments } = await supabaseAdmin
    .from("payments")
    .select("game_id, player_id, amount, status, paid_at, notes")
    .eq("player_id", me.id);

  const myPaymentsMap: Record<string, any> = {};
  for (const p of myPayments ?? []) {
    myPaymentsMap[p.game_id] = p;
  }

  // 5. Monta os jogos enriquecidos
  const enrichedGames = gameList.map((game) => {
    const gameConfs = (confirmations ?? []).filter((c: any) => c.game_id === game.id);
    return {
      ...game,
      locations: locationsMap[game.location_id] ?? null,
      confirmations: gameConfs,
      payments: myPaymentsMap[game.id] ? [myPaymentsMap[game.id]] : [],
    };
  });

  return { games: enrichedGames };
});

export const getGameDetail = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const me = await requirePlayer();

    const { data: game } = await supabaseAdmin
      .from("games")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();

    if (!game) return { game: null, confirmations: [], myPayment: null, location: null };

    const { data: location } = game.location_id
      ? await supabaseAdmin
          .from("locations")
          .select("id, name, address, maps_url, photo_url")
          .eq("id", game.location_id)
          .maybeSingle()
      : { data: null };

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

    return { game, confirmations: confs ?? [], myPayment, location };
  });

export const getHomeData = createServerFn({ method: "GET" }).handler(async () => {
  const me = await requirePlayer();
  const today = new Date().toISOString().slice(0, 10);

  const { data: nextGame } = await supabaseAdmin
    .from("games")
    .select("*")
    .gte("date", today)
    .eq("status", "scheduled")
    .order("date", { ascending: true })
    .order("time", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!nextGame) {
    return { me, nextGame: null, confirmations: [], myConfirmation: null, myPayment: null, location: null };
  }

  const { data: location } = nextGame.location_id
    ? await supabaseAdmin
        .from("locations")
        .select("id, name, address, maps_url, photo_url")
        .eq("id", nextGame.location_id)
        .maybeSingle()
    : { data: null };

  const { data: confs } = await supabaseAdmin
    .from("confirmations")
    .select("status, player_id, players(id, name, avatar_url, position)")
    .eq("game_id", nextGame.id);

  const myConfirmation = (confs ?? []).find((c: any) => c.player_id === me.id) ?? null;

  const { data: myPayment } = await supabaseAdmin
    .from("payments")
    .select("*")
    .eq("game_id", nextGame.id)
    .eq("player_id", me.id)
    .maybeSingle();

  return { me, nextGame, confirmations: confs ?? [], myConfirmation, myPayment, location };
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
        { onConflict: "game_id, player_id" },
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
  return (data ?? []) as Location[];
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