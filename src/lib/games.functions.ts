import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requirePlayer } from "./session.server";
import type { Database } from "@/integrations/supabase/types";

type DbTables = Database["public"]["Tables"];

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

// ── Helpers de junção (flat-query pattern) ──

async function fetchPlayersMap(playerIds: string[]) {
  const uniqueIds = [...new Set(playerIds)].filter(Boolean);
  if (uniqueIds.length === 0) return new Map<string, DbTables["players"]["Row"]>();

  const { data, error } = await supabaseAdmin
    .from("players")
    .select("id, name, avatar_url, position, preferred_position, nickname, phone")
    .in("id", uniqueIds);

  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((p) => [p.id, p]));
}

async function fetchLocationsMap(locationIds: string[]) {
  const uniqueIds = [...new Set(locationIds)].filter(Boolean);
  if (uniqueIds.length === 0) return new Map<string, DbTables["locations"]["Row"]>();

  const { data, error } = await supabaseAdmin
    .from("locations")
    .select("id, name, address, maps_url, photo_url, phone, price_per_hour, opening_hours, rating, notes")
    .in("id", uniqueIds);

  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((l) => [l.id, l]));
}

// ── Server Functions ──

export const listGames = createServerFn({ method: "GET" }).handler(async () => {
  const me = await requirePlayer();

  const { data: games, error: gamesError } = await supabaseAdmin
    .from("games")
    .select("*")
    .order("date", { ascending: false });

  if (gamesError) {
    console.error("[listGames] games error:", gamesError);
    throw new Error(gamesError.message);
  }

  const gameList = games ?? [];
  const gameIds = gameList.map((g) => g.id);
  if (gameIds.length === 0) return { games: [], error: null as string | null };

  const locationIds = [...new Set(gameList.map((g) => g.location_id).filter(Boolean))] as string[];
  const locationsMap = await fetchLocationsMap(locationIds);

  const { data: confirmations, error: confError } = await supabaseAdmin
    .from("confirmations")
    .select("id, game_id, player_id, status, confirmation_order, notes, created_at")
    .in("game_id", gameIds);
  if (confError) throw new Error(confError.message);

  const confPlayerIds = [...new Set((confirmations ?? []).map((c) => c.player_id))];
  const confPlayersMap = await fetchPlayersMap(confPlayerIds);

  const confirmationsWithPlayers = (confirmations ?? []).map((c) => ({
    ...c,
    player: confPlayersMap.get(c.player_id) ?? null,
  }));

  const { data: myPayments, error: paymentsError } = await supabaseAdmin
    .from("payments")
    .select("id, game_id, player_id, amount, status, paid_at, notes, proof_url, approved_by_admin_at, admin_notes")
    .eq("player_id", me.id)
    .in("game_id", gameIds);
  if (paymentsError) throw new Error(paymentsError.message);

  const myPaymentsMap = new Map((myPayments ?? []).map((p) => [p.game_id, p]));

  const { data: results, error: resultsError } = await supabaseAdmin
    .from("game_results")
    .select("id, game_id, score_a, score_b, mvp_player_id, team_a_id, team_b_id, status, notes, created_at, updated_at")
    .in("game_id", gameIds);
  if (resultsError) throw new Error(resultsError.message);

  const resultsMap = new Map((results ?? []).map((r) => [r.game_id, r]));

  const enrichedGames = gameList.map((game) => {
    const gameConfs = confirmationsWithPlayers.filter((c) => c.game_id === game.id);
    return {
      ...game,
      location: locationsMap.get(game.location_id ?? "") ?? null,
      confirmations: gameConfs,
      myPayment: myPaymentsMap.get(game.id) ?? null,
      result: resultsMap.get(game.id) ?? null,
    };
  });

  return {
    games: enrichedGames,
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

    if (!game) {
      return {
        game: null,
        location: null,
        confirmations: [],
        myPayment: null,
        teams: [],
        stats: [],
        result: null,
      };
    }

    const { data: location, error: locationError } = game.location_id
      ? await supabaseAdmin
          .from("locations")
          .select("id, name, address, maps_url, photo_url, phone, price_per_hour, opening_hours, rating, notes")
          .eq("id", game.location_id)
          .maybeSingle()
      : { data: null, error: null };
    if (locationError) throw new Error(locationError.message);

    const { data: confirmations, error: confError } = await supabaseAdmin
      .from("confirmations")
      .select("id, game_id, player_id, status, confirmation_order, notes, created_at")
      .eq("game_id", data.id);
    if (confError) throw new Error(confError.message);

    const confPlayerIds = [...new Set((confirmations ?? []).map((c) => c.player_id))];
    const confPlayersMap = await fetchPlayersMap(confPlayerIds);

    const confirmationsWithPlayers = (confirmations ?? []).map((c) => ({
      ...c,
      player: confPlayersMap.get(c.player_id) ?? null,
    }));

    const { data: myPayment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .select("id, game_id, player_id, amount, status, paid_at, notes, proof_url, approved_by_admin_at, admin_notes")
      .eq("game_id", data.id)
      .eq("player_id", me.id)
      .maybeSingle();
    if (paymentError) throw new Error(paymentError.message);

    const { data: teams, error: teamsError } = await supabaseAdmin
      .from("game_teams")
      .select("id, game_id, team_name, color, jersey_color, player_id, created_at")
      .eq("game_id", data.id);
    if (teamsError) throw new Error(teamsError.message);

    const teamIds = (teams ?? []).map((t) => t.id);
    let teamPlayersMap: Record<string, Array<{ player_id: string; player: DbTables["players"]["Row"] | null }>> = {};

    if (teamIds.length > 0) {
      const { data: teamPlayers, error: tpError } = await supabaseAdmin
        .from("game_team_players")
        .select("id, team_id, player_id, created_at")
        .in("team_id", teamIds);
      if (tpError) throw new Error(tpError.message);

      const tpPlayerIds = [...new Set((teamPlayers ?? []).map((tp) => tp.player_id))];
      const tpPlayersMap = await fetchPlayersMap(tpPlayerIds);

      for (const tp of teamPlayers ?? []) {
        if (!teamPlayersMap[tp.team_id]) teamPlayersMap[tp.team_id] = [];
        teamPlayersMap[tp.team_id].push({
          player_id: tp.player_id,
          player: tpPlayersMap.get(tp.player_id) ?? null,
        });
      }
    }

    const teamsWithPlayers = (teams ?? []).map((t) => ({
      ...t,
      players: teamPlayersMap[t.id] ?? [],
    }));

    const { data: stats, error: statsError } = await supabaseAdmin
      .from("game_player_stats")
      .select("id, game_id, player_id, goals, assists, own_goals, saves, yellow_cards, red_cards, rating, notes, created_at, updated_at")
      .eq("game_id", data.id);
    if (statsError) throw new Error(statsError.message);

    const statsPlayerIds = [...new Set((stats ?? []).map((s) => s.player_id))];
    const statsPlayersMap = await fetchPlayersMap(statsPlayerIds);

    const statsWithPlayers = (stats ?? []).map((s) => ({
      ...s,
      player: statsPlayersMap.get(s.player_id) ?? null,
    }));

    const { data: result, error: resultError } = await supabaseAdmin
      .from("game_results")
      .select("id, game_id, score_a, score_b, mvp_player_id, team_a_id, team_b_id, status, notes, created_at, updated_at")
      .eq("game_id", data.id)
      .maybeSingle();
    if (resultError) throw new Error(resultError.message);

    return {
      game,
      location,
      confirmations: confirmationsWithPlayers,
      myPayment,
      teams: teamsWithPlayers,
      stats: statsWithPlayers,
      result: result ?? null,
    };
  });

export const getHomeData = createServerFn({ method: "GET" }).handler(async () => {
  const me = await requirePlayer();
  const today = new Date().toISOString().slice(0, 10);

  const { data: settings, error: settingsError } = await supabaseAdmin
    .from("app_settings")
    .select("whatsapp_group_url")
    .eq("id", 1)
    .maybeSingle();
  if (settingsError) throw new Error(settingsError.message);

  const { data: nextGame, error: nextGameError } = await supabaseAdmin
    .from("games")
    .select("*")
    .gte("date", today)
    .eq("status", "scheduled")
    .order("date", { ascending: true })
    .order("time", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (nextGameError) throw new Error(nextGameError.message);

  if (!nextGame) {
    return {
      me,
      whatsapp_group_url: settings?.whatsapp_group_url ?? null,
      nextGame: null,
      confirmations: [],
      myConfirmation: null,
      myPayment: null,
      location: null,
      result: null,
    };
  }

  const { data: location } = nextGame.location_id
    ? await supabaseAdmin
        .from("locations")
        .select("id, name, address, maps_url, photo_url")
        .eq("id", nextGame.location_id)
        .maybeSingle()
    : { data: null };

  const { data: confirmations, error: confError } = await supabaseAdmin
    .from("confirmations")
    .select("id, game_id, player_id, status, confirmation_order, notes, created_at")
    .eq("game_id", nextGame.id);
  if (confError) throw new Error(confError.message);

  const confPlayerIds = [...new Set((confirmations ?? []).map((c) => c.player_id))];
  const confPlayersMap = await fetchPlayersMap(confPlayerIds);

  const confirmationsWithPlayers = (confirmations ?? []).map((c) => ({
    ...c,
    player: confPlayersMap.get(c.player_id) ?? null,
  }));

  const myConfirmation = confirmationsWithPlayers.find((c) => c.player_id === me.id) ?? null;

  const { data: myPayment } = await supabaseAdmin
    .from("payments")
    .select("id, game_id, player_id, amount, status, paid_at, notes, proof_url, approved_by_admin_at")
    .eq("game_id", nextGame.id)
    .eq("player_id", me.id)
    .maybeSingle();

  const { data: result, error: resultError } = await supabaseAdmin
    .from("game_results")
    .select("id, game_id, score_a, score_b, mvp_player_id, team_a_id, team_b_id, status, notes, created_at, updated_at")
    .eq("game_id", nextGame.id)
    .maybeSingle();
  if (resultError) throw new Error(resultError.message);

  return {
    me,
    whatsapp_group_url: settings?.whatsapp_group_url ?? null,
    nextGame: { ...nextGame, location },
    confirmations: confirmationsWithPlayers,
    myConfirmation,
    myPayment,
    location,
    result: result ?? null,
  };
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

    const { data: existing } = await supabaseAdmin
      .from("confirmations")
      .select("confirmation_order")
      .eq("game_id", data.gameId)
      .order("confirmation_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = (existing?.confirmation_order ?? 0) + 1;

    const { error } = await supabaseAdmin
      .from("confirmations")
      .upsert(
        {
          game_id: data.gameId,
          player_id: me.id,
          status: data.status,
          confirmation_order: data.status === "confirmed" ? nextOrder : null,
        },
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
    .select("id, game_id, player_id, amount, status, paid_at, notes, proof_url, approved_by_admin_at, admin_notes, created_at, updated_at")
    .eq("player_id", me.id)
    .order("created_at", { ascending: false });
  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null as string | null };
});

export const myAttendanceHistory = createServerFn({ method: "GET" }).handler(async () => {
  const me = await requirePlayer();
  const { data, error } = await supabaseAdmin
    .from("confirmations")
    .select("status, game_id, created_at")
    .eq("player_id", me.id)
    .eq("status", "confirmed")
    .order("created_at", { ascending: false });
  if (error) return { data: [], error: error.message };

  const gameIds = [...new Set((data ?? []).map((c) => c.game_id).filter(Boolean))];
  let gamesMap = new Map<string, { id: string; title: string; date: string; time: string }>();
  if (gameIds.length > 0) {
    const { data: games } = await supabaseAdmin
      .from("games")
      .select("id, title, date, time")
      .in("id", gameIds);
    gamesMap = new Map((games ?? []).map((g) => [g.id, g]));
  }

  const enriched = (data ?? []).map((c) => ({
    ...c,
    games: gamesMap.get(c.game_id) ?? null,
  }));

  return { data: enriched, error: null as string | null };
});

export const getPlayerPublicProfile = createServerFn({ method: "POST" })
  .inputValidator((d: { playerId: string }) => z.object({ playerId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requirePlayer();

    const { data: player, error: playerError } = await supabaseAdmin
      .from("players")
      .select("id, name, avatar_url, position, preferred_position, nickname, phone")
      .eq("id", data.playerId)
      .maybeSingle();
    if (playerError) throw new Error(playerError.message);
    if (!player) return { player: null, stats: null, recentGames: [], error: null as string | null };

    const { data: statsRows, error: statsError } = await supabaseAdmin
      .from("game_player_stats")
      .select("id, game_id, player_id, goals, assists, saves, rating, created_at")
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
      recentGames = games ?? [];
    }

    const { count: confirmationsCount, error: confError } = await supabaseAdmin
      .from("confirmations")
      .select("id", { count: "exact", head: true })
      .eq("player_id", data.playerId)
      .eq("status", "confirmed");
    if (confError) throw new Error(confError.message);

    const totalGoals = (statsRows ?? []).reduce((sum, s) => sum + Number(s.goals ?? 0), 0);
    const totalAssists = (statsRows ?? []).reduce((sum, s) => sum + Number(s.assists ?? 0), 0);
    const totalSaves = (statsRows ?? []).reduce((sum, s) => sum + Number(s.saves ?? 0), 0);
    const ratings = (statsRows ?? []).map((s) => Number(s.rating)).filter((v) => Number.isFinite(v));
    const avgRating = ratings.length > 0 ? ratings.reduce((s, r) => s + r, 0) / ratings.length : null;

    return {
      player,
      stats: {
        totalGoals,
        totalAssists,
        totalSaves,
        totalGames: confirmationsCount ?? 0,
        averageRating: avgRating,
      },
      recentGames,
      error: null as string | null,
    };
  });

export const submitMyGameStats = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      gameId: z.string().uuid(),
      goals: z.number().int().min(0).default(0),
      assists: z.number().int().min(0).default(0),
      own_goals: z.number().int().min(0).default(0),
      saves: z.number().int().min(0).default(0),
      yellow_cards: z.number().int().min(0).default(0),
      red_cards: z.number().int().min(0).default(0),
      rating: z.number().int().min(1).max(10).nullable().optional(),
      notes: z.string().max(500).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const me = await requirePlayer();

    const { data: conf, error: confError } = await supabaseAdmin
      .from("confirmations")
      .select("id")
      .eq("game_id", data.gameId)
      .eq("player_id", me.id)
      .eq("status", "confirmed")
      .maybeSingle();
    if (confError) throw new Error(confError.message);
    if (!conf) throw new Error("Você precisa confirmar presença no jogo para registrar estatísticas.");

    const { error } = await supabaseAdmin
      .from("game_player_stats")
      .upsert(
        {
          game_id: data.gameId,
          player_id: me.id,
          goals: data.goals,
          assists: data.assists,
          own_goals: data.own_goals,
          saves: data.saves,
          yellow_cards: data.yellow_cards,
          red_cards: data.red_cards,
          rating: data.rating ?? null,
          notes: data.notes ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "game_id,player_id" },
      );

    if (error) throw new Error(error.message);
    return { success: true };
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
      .select("id, player_id, game_id, goals, assists, saves, rating, created_at");
    if (validGameIds) statsQuery = statsQuery.in("game_id", validGameIds);
    const { data: statsRows, error: statsError } = await statsQuery;
    if (statsError) throw new Error(statsError.message);

    const playerIds = [...new Set((statsRows ?? []).map((row) => row.player_id))];
    if (playerIds.length === 0) return { ranking: [], error: null as string | null };

    const playersMap = await fetchPlayersMap(playerIds);

    const byPlayer = new Map<string, any>();
    for (const [id, p] of playersMap) {
      byPlayer.set(id, {
        playerId: p.id,
        name: p.name,
        avatar_url: p.avatar_url,
        position: p.preferred_position ?? p.position,
        goals: 0,
        assists: 0,
        saves: 0,
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
      item.saves += Number(row.saves ?? 0);
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