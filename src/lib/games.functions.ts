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
    const { data: locs, error: locationsError } = await supabaseAdmin
      .from("locations")
      .select("id, name, address, maps_url, photo_url")
      .in("id", locationIds);
    if (locationsError) {
      return { games: [], error: locationsError.message };
    }
    if (locs) {
      for (const loc of locs) locationsMap[loc.id] = loc;
    }
  }

  // 3. Busca todas as confirmações
  const { data: confirmations, error: confError } = await supabaseAdmin
    .from("confirmations")
    .select("game_id, player_id, status, players(id, name, avatar_url, position)")
    .order("created_at", { ascending: true });
  if (confError) {
    return { games: [], error: confError.message };
  }

  // 4. Busca todos os pagamentos do jogador logado
  const { data: myPayments, error: paymentsError } = await supabaseAdmin
    .from("payments")
    .select("game_id, player_id, amount, status, paid_at, notes")
    .eq("player_id", me.id);
  if (paymentsError) {
    return { games: [], error: paymentsError.message };
  }

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

  const gameIds = enrichedGames.map((g) => g.id);
  let resultsMap: Record<string, any> = {};
  if (gameIds.length > 0) {
    const { data: results, error: resultsError } = await supabaseAdmin
      .from("game_results")
      .select("*")
      .in("game_id", gameIds);
    if (resultsError) {
      return { games: [], error: resultsError.message };
    }
    for (const row of results ?? []) {
      resultsMap[row.game_id] = row;
    }
  }

  return {
    games: enrichedGames.map((g) => ({ ...g, result: resultsMap[g.id] ?? null })),
    error: null as string | null,
  };
});

export const getGameDetail = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const me = await requirePlayer();

    const { data: game, error: gameError } = await supabaseAdmin
      .from("games")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (gameError) throw new Error(gameError.message);

    if (!game) return { game: null, confirmations: [], myPayment: null, location: null };

    const { data: location, error: locationError } = game.location_id
      ? await supabaseAdmin
          .from("locations")
          .select("id, name, address, maps_url, photo_url")
          .eq("id", game.location_id)
          .maybeSingle()
      : { data: null, error: null };
    if (locationError) throw new Error(locationError.message);

    const { data: confs, error: confError } = await supabaseAdmin
      .from("confirmations")
      .select("status, player_id, players(id, name, avatar_url, position)")
      .eq("game_id", data.id);
    if (confError) throw new Error(confError.message);

    const { data: myPayment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("game_id", data.id)
      .eq("player_id", me.id)
      .maybeSingle();
    if (paymentError) throw new Error(paymentError.message);

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
    return { me, nextGame: null, confirmations: [], myConfirmation: null, myPayment: null, location: null, result: null };
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

  const { data: result, error: resultError } = await supabaseAdmin
    .from("game_results")
    .select("*")
    .eq("game_id", nextGame.id)
    .maybeSingle();
  if (resultError) throw new Error(resultError.message);

  return { me, nextGame, confirmations: confs ?? [], myConfirmation, myPayment, location, result: result ?? null };
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
  const { data, error } = await supabaseAdmin
    .from("locations")
    .select("*")
    .order("name");
  if (error) return { data: [] as Location[], error: error.message };
  return { data: (data ?? []) as Location[], error: null as string | null };
});

export const listMyPayments = createServerFn({ method: "GET" }).handler(async () => {
  const me = await requirePlayer();
  const { data, error } = await supabaseAdmin
    .from("payments")
    .select("*, games(id, title, date, time)")
    .eq("player_id", me.id)
    .order("created_at", { ascending: false });
  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null as string | null };
});

export const myAttendanceHistory = createServerFn({ method: "GET" }).handler(async () => {
  const me = await requirePlayer();
  const { data, error } = await supabaseAdmin
    .from("confirmations")
    .select("status, games(id, title, date, time)")
    .eq("player_id", me.id)
    .eq("status", "confirmed")
    .order("created_at", { ascending: false });
  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null as string | null };
});

export const getPlayerPublicProfile = createServerFn({ method: "POST" })
  .inputValidator((d: { playerId: string }) => z.object({ playerId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requirePlayer();

    const { data: player, error: playerError } = await supabaseAdmin
      .from("players")
      .select("id, name, avatar_url, position")
      .eq("id", data.playerId)
      .maybeSingle();
    if (playerError) throw new Error(playerError.message);
    if (!player) return { player: null, stats: null, recentGames: [], error: null as string | null };

    const { data: statsRows, error: statsError } = await supabaseAdmin
      .from("game_stats")
      .select("game_id, goals, assists, rating, created_at")
      .eq("player_id", data.playerId);
    if (statsError) throw new Error(statsError.message);

    const gameIds = [...new Set((statsRows ?? []).map((s) => s.game_id).filter(Boolean))];
    let recentGames: Array<{ id: string; title: string; date: string; time: string }> = [];
    if (gameIds.length > 0) {
      const { data: games, error: gamesError } = await supabaseAdmin
        .from("games")
        .select("id, title, date, time")
        .in("id", gameIds)
        .order("date", { ascending: false })
        .limit(6);
      if (gamesError) throw new Error(gamesError.message);
      recentGames = (games ?? []) as Array<{ id: string; title: string; date: string; time: string }>;
    }

    const { count: confirmationsCount, error: confError } = await supabaseAdmin
      .from("confirmations")
      .select("id", { count: "exact", head: true })
      .eq("player_id", data.playerId)
      .eq("status", "confirmed");
    if (confError) throw new Error(confError.message);

    const totalGoals = (statsRows ?? []).reduce((sum, s) => sum + Number(s.goals ?? 0), 0);
    const totalAssists = (statsRows ?? []).reduce((sum, s) => sum + Number(s.assists ?? 0), 0);
    const ratings = (statsRows ?? []).map((s) => Number(s.rating)).filter((v) => Number.isFinite(v));
    const avgRating = ratings.length > 0 ? ratings.reduce((s, r) => s + r, 0) / ratings.length : null;

    return {
      player,
      stats: {
        totalGoals,
        totalAssists,
        totalGames: confirmationsCount ?? 0,
        averageRating: avgRating,
      },
      recentGames,
      error: null as string | null,
    };
  });

export const getRankingStats = createServerFn({ method: "POST" })
  .inputValidator((d: { period: "week" | "month" | "season" | "all" }) =>
    z.object({ period: z.enum(["week", "month", "season", "all"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    await requirePlayer();

    let fromDate: string | null = null;
    const now = new Date();
    if (data.period === "week") {
      fromDate = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    } else if (data.period === "month") {
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    } else if (data.period === "season") {
      fromDate = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
    }

    let validGameIds: string[] | null = null;
    if (fromDate) {
      const { data: games, error: gamesError } = await supabaseAdmin
        .from("games")
        .select("id")
        .gte("date", fromDate);
      if (gamesError) throw new Error(gamesError.message);
      validGameIds = (games ?? []).map((g) => g.id);
      if (validGameIds.length === 0) return { ranking: [], error: null as string | null };
    }

    let statsQuery = supabaseAdmin
      .from("game_player_stats")
      .select("player_id, goals, assists, rating, game_id");
    if (validGameIds) statsQuery = statsQuery.in("game_id", validGameIds);
    const { data: statsRows, error: statsError } = await statsQuery;
    if (statsError) throw new Error(statsError.message);

    const playerIds = [...new Set((statsRows ?? []).map((row) => row.player_id))];
    if (playerIds.length === 0) return { ranking: [], error: null as string | null };

    const { data: players, error: playersError } = await supabaseAdmin
      .from("players")
      .select("id, name, avatar_url, position")
      .in("id", playerIds);
    if (playersError) throw new Error(playersError.message);

    const byPlayer = new Map<string, any>();
    for (const p of players ?? []) {
      byPlayer.set(p.id, {
        playerId: p.id,
        name: p.name,
        avatar_url: p.avatar_url,
        position: p.position,
        goals: 0,
        assists: 0,
        games: 0,
        ratingSum: 0,
        ratingCount: 0,
      });
    }
    for (const row of statsRows ?? []) {
      const item = byPlayer.get(row.player_id);
      if (!item) continue;
      item.goals += Number(row.goals ?? 0);
      item.assists += Number(row.assists ?? 0);
      item.games += 1;
      if (row.rating !== null && row.rating !== undefined) {
        item.ratingSum += Number(row.rating);
        item.ratingCount += 1;
      }
    }

    const ranking = Array.from(byPlayer.values()).map((p) => ({
      ...p,
      avgRating: p.ratingCount > 0 ? p.ratingSum / p.ratingCount : null,
      qualifiesForRating: p.games >= 3,
    }));

    return { ranking, error: null as string | null };
  });