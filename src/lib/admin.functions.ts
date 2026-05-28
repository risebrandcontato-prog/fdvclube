import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdminAccess } from "./session.server";
import { sendPushNotifications } from "./notifications.functions";
import type { Database } from "@/integrations/supabase/types";

type DbTables = Database["public"]["Tables"];

const MAX_IMAGE_SIZE_BYTES = 6 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function isValidTime(value: string) {
  return /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/.test(value);
}

function newCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  const arr = new Uint8Array(4);
  crypto.getRandomValues(arr);
  for (const b of arr) s += alphabet[b % alphabet.length];
  return `FDV-${s}`;
}

function getAdminId(auth: Awaited<ReturnType<typeof requireAdminAccess>>): string | null {
  return auth.type === "player" ? auth.player.id : null;
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

// ─────────────────────────────────────────────
// Codes
// ─────────────────────────────────────────────
export const adminListCodes = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdminAccess();
  const { data, error } = await supabaseAdmin
    .from("invite_codes")
    .select("id, code, created_at, updated_at, status, is_admin, created_by, used_by")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const usedByIds = [...new Set((data ?? []).map((c) => c.used_by).filter(Boolean))] as string[];
  const playersMap = await fetchPlayersMap(usedByIds);

  const enriched = (data ?? []).map((c) => ({
    ...c,
    players: c.used_by ? (playersMap.get(c.used_by) ?? null) : null,
  }));

  return enriched;
});

export const adminGenerateCode = createServerFn({ method: "POST" }).handler(async () => {
  const auth = await requireAdminAccess();
  const createdBy = getAdminId(auth);
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    const { data, error } = await supabaseAdmin
      .from("invite_codes")
      .insert({ code, created_by: createdBy })
      .select("*")
      .maybeSingle();
    if (!error && data) return data;
  }
  throw new Error("Nao foi possivel gerar codigo");
});

export const adminRevokeCode = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdminAccess();
    const { error } = await supabaseAdmin
      .from("invite_codes")
      .update({ status: "revoked" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteCode = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdminAccess();

    // Remove vínculo em players para evitar FK em players.invite_code_id
    const { error: detachPlayersError } = await supabaseAdmin
      .from("players")
      .update({ invite_code_id: null })
      .eq("invite_code_id", data.id);
    if (detachPlayersError) throw new Error(detachPlayersError.message);

    const { error } = await supabaseAdmin.from("invite_codes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─────────────────────────────────────────────
// Players
// ─────────────────────────────────────────────
export const adminListPlayers = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdminAccess();
  const { data, error } = await supabaseAdmin.from("players").select("*").order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const adminSetPlayerBlocked = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ playerId: z.string().uuid(), blocked: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdminAccess();
    const { error: blockError } = await supabaseAdmin
      .from("players")
      .update({ is_blocked: data.blocked })
      .eq("id", data.playerId);
    if (blockError) throw new Error(blockError.message);
    if (data.blocked) {
      const { error: sessionError } = await supabaseAdmin
        .from("player_sessions")
        .delete()
        .eq("player_id", data.playerId);
      if (sessionError) throw new Error(sessionError.message);
    }
    return { ok: true };
  });

export const adminDeletePlayer = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ playerId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdminAccess();

    const { data: player, error: playerReadError } = await supabaseAdmin
      .from("players")
      .select("id, is_admin")
      .eq("id", data.playerId)
      .maybeSingle();
    if (playerReadError) throw new Error(playerReadError.message);
    if (!player) throw new Error("Jogador não encontrado.");
    if (player.is_admin) throw new Error("Não é permitido excluir um admin.");

    // Limpeza de vínculos para exclusão permanente
    await supabaseAdmin.from("player_sessions").delete().eq("player_id", data.playerId);
    await supabaseAdmin.from("notifications").delete().eq("player_id", data.playerId);
    await supabaseAdmin.from("push_subscriptions").delete().eq("player_id", data.playerId);
    await supabaseAdmin.from("game_team_players").delete().eq("player_id", data.playerId);
    await supabaseAdmin.from("game_player_stats").delete().eq("player_id", data.playerId);
    await supabaseAdmin.from("payments").delete().eq("player_id", data.playerId);
    await supabaseAdmin.from("confirmations").delete().eq("player_id", data.playerId);
    await supabaseAdmin
      .from("game_results")
      .update({ mvp_player_id: null })
      .eq("mvp_player_id", data.playerId);
    await supabaseAdmin
      .from("game_teams")
      .update({ player_id: null })
      .eq("player_id", data.playerId);
    await supabaseAdmin
      .from("invite_codes")
      .update({ used_by: null, status: "pending" as any })
      .eq("used_by", data.playerId);

    const { error: playerDeleteError } = await supabaseAdmin.from("players").delete().eq("id", data.playerId);
    if (playerDeleteError) throw new Error(playerDeleteError.message);

    return { ok: true };
  });

// ─────────────────────────────────────────────
// Locations
// ─────────────────────────────────────────────
export const adminListLocations = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdminAccess();
  const { data, error } = await supabaseAdmin
    .from("locations")
    .select("*")
    .order("name", { ascending: true });
  if (error) return { data: [] as any[], error: error.message };
  return { data: data ?? [], error: null as string | null };
});

const locationSchema = z.object({
  name: z.string().min(1).max(120),
  address: z.string().max(255).optional(),
  maps_url: z.string().url().optional().or(z.literal("")),
  photo_url: z.string().url().optional().or(z.literal("")),
  phone: z.string().max(20).optional(),
  price_per_hour: z.number().min(0).optional(),
  opening_hours: z.string().max(100).optional(),
  rating: z.number().min(0).max(5).optional(),
  notes: z.string().max(500).optional(),
});

export const adminCreateLocation = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => locationSchema.parse(d))
  .handler(async ({ data }) => {
    await requireAdminAccess();
    if (!data.name.trim()) throw new Error("Nome do campo é obrigatório.");

    const insertData: DbTables["locations"]["Insert"] = {
      name: data.name,
      address: data.address ?? null,
      maps_url: data.maps_url && data.maps_url !== "" ? data.maps_url : null,
      photo_url: data.photo_url && data.photo_url !== "" ? data.photo_url : null,
      phone: data.phone ?? null,
      price_per_hour: data.price_per_hour ?? null,
      opening_hours: data.opening_hours ?? null,
      rating: data.rating ?? null,
      notes: data.notes ?? null,
    };

    const { error } = await supabaseAdmin.from("locations").insert(insertData);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdateLocation = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(120).optional(),
      address: z.string().max(255).optional(),
      maps_url: z.string().url().optional().or(z.literal("")),
      photo_url: z.string().url().optional().or(z.literal("")),
      phone: z.string().max(20).optional(),
      price_per_hour: z.number().min(0).optional(),
      opening_hours: z.string().max(100).optional(),
      rating: z.number().min(0).max(5).optional(),
      notes: z.string().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdminAccess();
    const { id, ...rest } = data;
    const updateData: DbTables["locations"]["Update"] = {};
    if (rest.name !== undefined) updateData.name = rest.name;
    if (rest.address !== undefined) updateData.address = rest.address ?? null;
    if (rest.maps_url !== undefined) updateData.maps_url = rest.maps_url && rest.maps_url !== "" ? rest.maps_url : null;
    if (rest.photo_url !== undefined) updateData.photo_url = rest.photo_url && rest.photo_url !== "" ? rest.photo_url : null;
    if (rest.phone !== undefined) updateData.phone = rest.phone ?? null;
    if (rest.price_per_hour !== undefined) updateData.price_per_hour = rest.price_per_hour ?? null;
    if (rest.opening_hours !== undefined) updateData.opening_hours = rest.opening_hours ?? null;
    if (rest.rating !== undefined) updateData.rating = rest.rating ?? null;
    if (rest.notes !== undefined) updateData.notes = rest.notes ?? null;

    const { error } = await supabaseAdmin.from("locations").update(updateData).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteLocation = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdminAccess();
    const { error } = await supabaseAdmin.from("locations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─────────────────────────────────────────────
// Games
// ─────────────────────────────────────────────
export const adminListGames = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdminAccess();

  const { data: games, error: gamesError } = await supabaseAdmin
    .from("games")
    .select("*")
    .order("date", { ascending: false });

  if (gamesError) {
    console.error("[adminListGames] games error:", gamesError);
    throw new Error(gamesError.message);
  }

  const gameList = games ?? [];
  const gameIds = gameList.map((g) => g.id);

  const locationIds = [...new Set(gameList.map((g) => g.location_id).filter(Boolean))] as string[];
  const locationsMap = await fetchLocationsMap(locationIds);

  let resultsMap = new Map<string, DbTables["game_results"]["Row"]>();
  if (gameIds.length > 0) {
    const { data: results, error: resultsError } = await supabaseAdmin
      .from("game_results")
      .select("id, game_id, score_a, score_b, mvp_player_id, team_a_id, team_b_id, status, notes, created_at, updated_at")
      .in("game_id", gameIds);
    if (resultsError) throw new Error(resultsError.message);
    resultsMap = new Map((results ?? []).map((r) => [r.game_id, r]));
  }

  const { data: confirmations, error: confsError } = await supabaseAdmin
    .from("confirmations")
    .select("game_id, player_id, status")
    .in("game_id", gameIds);
  if (confsError) throw new Error(confsError.message);

  return {
    games: gameList.map((g) => ({
      ...g,
      locations: locationsMap.get(g.location_id ?? "") ?? null,
      result: resultsMap.get(g.id) ?? null,
    })),
    confirmations: confirmations ?? [],
  };
});

export const adminDeleteGame = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdminAccess();

    const { data: gameTeams } = await supabaseAdmin
      .from("game_teams")
      .select("id")
      .eq("game_id", data.id);
    const teamIds = (gameTeams ?? []).map((t) => t.id);
    if (teamIds.length > 0) {
      await supabaseAdmin.from("game_team_players").delete().in("team_id", teamIds);
    }

    await supabaseAdmin.from("game_teams").delete().eq("game_id", data.id);
    await supabaseAdmin.from("game_player_stats").delete().eq("game_id", data.id);
    await supabaseAdmin.from("game_results").delete().eq("game_id", data.id);
    const { error: paymentsError } = await supabaseAdmin.from("payments").delete().eq("game_id", data.id);
    if (paymentsError) throw new Error(paymentsError.message);
    const { error: confError } = await supabaseAdmin
      .from("confirmations")
      .delete()
      .eq("game_id", data.id);
    if (confError) throw new Error(confError.message);
    const { error: gameError } = await supabaseAdmin.from("games").delete().eq("id", data.id);
    if (gameError) throw new Error(gameError.message);
    return { ok: true };
  });

export const adminCreateGame = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      title: z.string().min(1).max(120),
      date: z.string().min(10).max(10),
      time: z.string().min(5).max(8),
      location_id: z.string().uuid().nullable().optional(),
      max_players: z.number().int().min(1).max(50),
      contribution_amount: z.number().min(0).max(10000),
      notes: z.string().max(500).optional(),
      has_ball: z.boolean().optional(),
      vests: z.enum(["none", "orange", "black", "both"]).optional(),
      formation_config: z.object({
        num_teams: z.number().int().min(2).max(3).optional(),
        players_per_team: z.number().int().min(1).optional(),
        formation_desc: z.string().optional(),
      }).optional(),
      auto_draw: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdminAccess();
    if (!isValidIsoDate(data.date)) throw new Error("Data do jogo inválida.");
    if (!isValidTime(data.time)) throw new Error("Hora do jogo inválida.");
    if (!Number.isFinite(data.contribution_amount) || data.contribution_amount < 0) {
      throw new Error("Valor de contribuição inválido.");
    }
    if (!Number.isInteger(data.max_players) || data.max_players < 1) {
      throw new Error("Número de jogadores inválido.");
    }

    const insertData: DbTables["games"]["Insert"] = {
      title: data.title,
      date: data.date,
      time: data.time,
      location_id: data.location_id ?? null,
      max_players: data.max_players,
      contribution_amount: data.contribution_amount,
      notes: data.notes ?? null,
      has_ball: data.has_ball ?? false,
      vests: data.vests ?? "none",
      formation_config: data.formation_config ?? null,
      auto_draw: data.auto_draw ?? false,
    };

    const { data: game, error } = await supabaseAdmin
      .from("games")
      .insert(insertData)
      .select("id")
      .single();
    if (error || !game) throw new Error(error?.message ?? "Falha ao criar jogo");

    const { data: players, error: playersError } = await supabaseAdmin
      .from("players")
      .select("id")
      .eq("is_blocked", false);
    if (playersError) throw new Error(playersError.message);
    if (players && players.length) {
      const { error: paymentsError } = await supabaseAdmin.from("payments").insert(
        players.map((p) => ({
          game_id: game.id,
          player_id: p.id,
          amount: data.contribution_amount,
          status: "pending" as const,
        })),
      );
      if (paymentsError) throw new Error(paymentsError.message);
    }

    // Best-effort push: não bloqueia fluxo principal
    void sendPushNotifications({
      data: {
        title: "⚽ Novo jogo marcado!",
        body: `${data.title} — ${data.date} às ${data.time}. Confirma presença!`,
        url: "/app/jogos",
      },
    }).catch(() => {});

    return { ok: true, id: game.id };
  });

export const adminUpdateGame = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(120).optional(),
      date: z.string().min(10).max(10).optional(),
      time: z.string().min(5).max(8).optional(),
      location_id: z.string().uuid().nullable().optional(),
      max_players: z.number().int().min(1).max(50).optional(),
      notes: z.string().max(500).optional(),
      status: z.enum(["scheduled", "cancelled", "done"]).optional(),
      has_ball: z.boolean().optional(),
      vests: z.enum(["none", "orange", "black", "both"]).optional(),
      formation_config: z.object({
        num_teams: z.number().int().min(2).max(3).optional(),
        players_per_team: z.number().int().min(1).optional(),
        formation_desc: z.string().optional(),
      }).optional(),
      auto_draw: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdminAccess();
    const { id, ...rest } = data;
    if (rest.date && !isValidIsoDate(rest.date)) throw new Error("Data do jogo inválida.");
    if (rest.time && !isValidTime(rest.time)) throw new Error("Hora do jogo inválida.");
    if (rest.max_players !== undefined && (!Number.isInteger(rest.max_players) || rest.max_players < 1)) {
      throw new Error("Número de jogadores inválido.");
    }

    const updateData: DbTables["games"]["Update"] = {};
    if (rest.title !== undefined) updateData.title = rest.title;
    if (rest.date !== undefined) updateData.date = rest.date;
    if (rest.time !== undefined) updateData.time = rest.time;
    if (rest.location_id !== undefined) updateData.location_id = rest.location_id ?? null;
    if (rest.max_players !== undefined) updateData.max_players = rest.max_players;
    if (rest.notes !== undefined) updateData.notes = rest.notes ?? null;
    if (rest.status !== undefined) updateData.status = rest.status;
    if (rest.has_ball !== undefined) updateData.has_ball = rest.has_ball;
    if (rest.vests !== undefined) updateData.vests = rest.vests;
    if (rest.formation_config !== undefined) updateData.formation_config = rest.formation_config ?? null;
    if (rest.auto_draw !== undefined) updateData.auto_draw = rest.auto_draw;

    const { error } = await supabaseAdmin.from("games").update(updateData).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminGameDetail = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdminAccess();

    const { data: game, error: gameError } = await supabaseAdmin
      .from("games")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (gameError) throw new Error(gameError.message);

    if (!game) return { game: null, location: null, players: [], confirmations: [], payments: [], stats: [], result: null, teams: [] };

    const { data: location, error: locationError } = game.location_id
      ? await supabaseAdmin
          .from("locations")
          .select("*")
          .eq("id", game.location_id)
          .maybeSingle()
      : { data: null, error: null };
    if (locationError) throw new Error(locationError.message);

    const { data: players, error: playersError } = await supabaseAdmin
      .from("players")
      .select("id, name, avatar_url, position, jersey_number, preferred_foot, is_blocked, phone, nickname, preferred_position, secondary_position, strong_foot")
      .order("name");
    if (playersError) throw new Error(playersError.message);

    const { data: confs, error: confsError } = await supabaseAdmin
      .from("confirmations")
      .select("id, game_id, player_id, status, confirmation_order, notes, created_at, updated_at")
      .eq("game_id", data.id);
    if (confsError) throw new Error(confsError.message);

    const { data: payments, error: paymentsError } = await supabaseAdmin
      .from("payments")
      .select("id, game_id, player_id, amount, status, paid_at, notes, proof_url, approved_by_admin_at, admin_notes, created_at, updated_at")
      .eq("game_id", data.id);
    if (paymentsError) throw new Error(paymentsError.message);

    const { data: stats, error: statsError } = await supabaseAdmin
      .from("game_player_stats")
      .select("id, game_id, player_id, goals, assists, own_goals, saves, yellow_cards, red_cards, rating, notes, created_at, updated_at")
      .eq("game_id", data.id);
    if (statsError) throw new Error(statsError.message);

    const { data: result, error: resultError } = await supabaseAdmin
      .from("game_results")
      .select("id, game_id, score_a, score_b, mvp_player_id, team_a_id, team_b_id, status, notes, created_at, updated_at")
      .eq("game_id", data.id)
      .maybeSingle();
    if (resultError) throw new Error(resultError.message);

    const { data: teams, error: teamsError } = await supabaseAdmin
      .from("game_teams")
      .select("id, game_id, team_name, color, jersey_color, player_id, created_at")
      .eq("game_id", data.id);
    if (teamsError) throw new Error(teamsError.message);

    let teamPlayersMap: Record<string, string[]> = {};
    if (teams && teams.length > 0) {
      const teamIds = teams.map((t) => t.id);
      const { data: teamPlayers, error: tpError } = await supabaseAdmin
        .from("game_team_players")
        .select("team_id, player_id")
        .in("team_id", teamIds);
      if (tpError) throw new Error(tpError.message);
      for (const tp of teamPlayers ?? []) {
        if (!teamPlayersMap[tp.team_id]) teamPlayersMap[tp.team_id] = [];
        teamPlayersMap[tp.team_id].push(tp.player_id);
      }
    }

    return {
      game,
      location: location ?? null,
      players: players ?? [],
      confirmations: confs ?? [],
      payments: payments ?? [],
      stats: stats ?? [],
      result: result ?? null,
      teams: (teams ?? []).map((t) => ({ ...t, player_ids: teamPlayersMap[t.id] ?? [] })),
    };
  });

// ─────────────────────────────────────────────
// Estatísticas (apenas stats individuais — NÃO toca em game_results)
// ─────────────────────────────────────────────
export const saveGameStats = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        gameId: z.string().uuid(),
        stats: z.array(
          z.object({
            playerId: z.string().uuid(),
            goals: z.number().int().min(0).default(0),
            assists: z.number().int().min(0).default(0),
            own_goals: z.number().int().min(0).default(0),
            yellow_cards: z.number().int().min(0).default(0),
            red_cards: z.number().int().min(0).default(0),
            rating: z.number().int().min(1).max(10).nullable().optional(),
            notes: z.string().max(500).nullable().optional(),
          }),
        ),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdminAccess();

    const payload: DbTables["game_player_stats"]["Insert"][] = data.stats.map((s) => ({
      game_id: data.gameId,
      player_id: s.playerId,
      goals: s.goals,
      assists: s.assists,
      own_goals: s.own_goals,
      yellow_cards: s.yellow_cards,
      red_cards: s.red_cards,
      rating: s.rating ?? null,
      notes: s.notes ?? null,
      saves: 0,
      updated_at: new Date().toISOString(),
    }));

    const { error: upsertError } = await supabaseAdmin
      .from("game_player_stats")
      .upsert(payload, { onConflict: "game_id,player_id" });
    if (upsertError) throw new Error(upsertError.message);

    return { success: true, error: null as string | null };
  });

// ─────────────────────────────────────────────
// Team Drawing (Sorteio de Times)
// ─────────────────────────────────────────────
export const generateTeams = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      gameId: z.string().uuid(),
      numTeams: z.number().int().min(2).max(3).default(2),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdminAccess();

    const { data: confs, error: confsError } = await supabaseAdmin
      .from("confirmations")
      .select("player_id")
      .eq("game_id", data.gameId)
      .eq("status", "confirmed")
      .order("confirmation_order", { ascending: true });
    if (confsError) throw new Error(confsError.message);

    const playerIds = (confs ?? []).map((c) => c.player_id);
    const playersMap = await fetchPlayersMap(playerIds);

    const players = playerIds.map((id) => ({
      id,
      name: playersMap.get(id)?.name ?? "Jogador",
      position: String(playersMap.get(id)?.preferred_position ?? playersMap.get(id)?.position ?? "").toLowerCase(),
    }));

    if (players.length === 0) throw new Error("Nenhum jogador confirmado para sortear times.");

    // Use seed por jogo para manter sorteio estável por jogo (até refazer times).
    function hashSeed(value: string) {
      let h = 2166136261;
      for (let i = 0; i < value.length; i++) {
        h ^= value.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    }
    function rngFactory(seed: number) {
      let t = seed + 0x6d2b79f5;
      return () => {
        t += 0x6d2b79f5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
      };
    }
    function shuffleWithRng<T>(arr: T[], rand: () => number) {
      const out = [...arr];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    }
    function isGoalkeeper(pos: string) {
      return pos.includes("goleiro") || pos.includes("goalkeeper") || pos === "gk";
    }

    const seed = hashSeed(data.gameId);
    const rand = rngFactory(seed);

    const requestedTeams = data.numTeams;
    const autoTeams = players.length >= 18 ? 3 : 2;
    const teamCount = Math.max(2, Math.min(3, requestedTeams ?? autoTeams));

    const goalkeepers = shuffleWithRng(players.filter((p) => isGoalkeeper(p.position)), rand);
    const linePlayers = shuffleWithRng(players.filter((p) => !isGoalkeeper(p.position)), rand);

    // Deletar times existentes
    const { data: existingTeams } = await supabaseAdmin
      .from("game_teams")
      .select("id")
      .eq("game_id", data.gameId);
    const existingTeamIds = (existingTeams ?? []).map((t) => t.id);
    if (existingTeamIds.length > 0) {
      await supabaseAdmin.from("game_team_players").delete().in("team_id", existingTeamIds);
    }
    await supabaseAdmin.from("game_teams").delete().eq("game_id", data.gameId);

    const colors = ["#22c55e", "#ef4444", "#3b82f6"];
    const teamNames = ["Time A", "Time B", "Time C"];
    const createdTeams: Array<{ id: string; name: string; color: string; players: typeof players }> = [];
    const distributedPlayers: Array<typeof players> = Array.from({ length: teamCount }, () => []);

    // 1) Distribui goleiros primeiro (1 por time quando possível)
    for (let i = 0; i < goalkeepers.length; i++) {
      distributedPlayers[i % teamCount].push(goalkeepers[i]);
    }
    // 2) Distribui linha em snake draft para balancear sobra
    for (let i = 0; i < linePlayers.length; i++) {
      const round = Math.floor(i / teamCount);
      const offset = i % teamCount;
      const teamIndex = round % 2 === 0 ? offset : teamCount - 1 - offset;
      distributedPlayers[teamIndex].push(linePlayers[i]);
    }

    for (let i = 0; i < teamCount; i++) {
      const captainId = distributedPlayers[i]?.[0]?.id ?? players[0]?.id ?? "";

      const { data: team, error: teamError } = await supabaseAdmin
        .from("game_teams")
        .insert({ 
          game_id: data.gameId, 
          team_name: teamNames[i],
          color: colors[i],
          player_id: captainId || null,
        })
        .select("id")
        .single();
      if (teamError || !team) throw new Error(teamError?.message ?? "Erro ao criar time");
      createdTeams.push({ id: team.id, name: teamNames[i], color: colors[i], players: [] });
    }

    for (let teamIndex = 0; teamIndex < createdTeams.length; teamIndex++) {
      const team = createdTeams[teamIndex];
      for (const player of distributedPlayers[teamIndex]) {
        team.players.push(player);
        const { error: tpError } = await supabaseAdmin
          .from("game_team_players")
          .insert({ team_id: team.id, player_id: player.id });
        if (tpError) throw new Error(tpError.message);
      }
    }

    void sendPushNotifications({
      data: {
        title: "🎲 Times sorteados!",
        body: "Os times do próximo jogo foram definidos. Veja qual é o seu!",
        url: `/app/jogos/${data.gameId}`,
        gameId: data.gameId,
      },
    }).catch(() => {});

    return { success: true, teams: createdTeams };
  });

export const deleteTeams = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ gameId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdminAccess();

    const { data: gameTeams } = await supabaseAdmin
      .from("game_teams")
      .select("id")
      .eq("game_id", data.gameId);
    const teamIds = (gameTeams ?? []).map((t) => t.id);
    if (teamIds.length > 0) {
      await supabaseAdmin.from("game_team_players").delete().in("team_id", teamIds);
    }

    await supabaseAdmin.from("game_teams").delete().eq("game_id", data.gameId);
    return { ok: true };
  });

// ─────────────────────────────────────────────
// Confirmations
// ─────────────────────────────────────────────
export const adminSetConfirmation = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      gameId: z.string().uuid(),
      playerId: z.string().uuid(),
      status: z.enum(["confirmed", "cancelled"]),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdminAccess();

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
          player_id: data.playerId,
          status: data.status,
          confirmation_order: data.status === "confirmed" ? nextOrder : null,
        },
        { onConflict: "game_id, player_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─────────────────────────────────────────────
// Payments
// ─────────────────────────────────────────────
export const adminSetPayment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      gameId: z.string().uuid(),
      playerId: z.string().uuid(),
      status: z.enum(["paid", "pending", "late", "exempt"]),
      amount: z.number().min(0).max(10000).optional(),
      notes: z.string().max(255).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdminAccess();
    const patch: DbTables["payments"]["Update"] = { status: data.status };
    if (data.amount !== undefined) patch.amount = data.amount;
    if (data.notes !== undefined) patch.notes = data.notes;
    if (data.status === "paid") {
      patch.paid_at = new Date().toISOString();
      patch.approved_by_admin_at = new Date().toISOString();
    } else {
      patch.paid_at = null;
      patch.approved_by_admin_at = null;
    }

    const { error } = await supabaseAdmin
      .from("payments")
      .upsert(
        { game_id: data.gameId, player_id: data.playerId, ...patch } as DbTables["payments"]["Insert"],
        { onConflict: "game_id, player_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─────────────────────────────────────────────
// Player Actions (não-admin)
// ─────────────────────────────────────────────
export const playerConfirmGame = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      gameId: z.string().uuid(),
      status: z.enum(["confirmed", "cancelled"]),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const token = getRequestHeader("x-fdv-token");
    if (!token) throw new Error("Não autenticado");

    const { data: session, error: sessionError } = await supabaseAdmin
      .from("player_sessions")
      .select("player_id")
      .eq("token", token)
      .maybeSingle();
    if (sessionError) throw new Error(sessionError.message);

    if (!session) throw new Error("Sessão inválida");

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
          player_id: session.player_id,
          status: data.status,
          confirmation_order: data.status === "confirmed" ? nextOrder : null,
        },
        { onConflict: "game_id, player_id" },
      );
    if (error) throw new Error(error.message);

    const { data: game } = await supabaseAdmin
      .from("games")
      .select("max_players, auto_draw")
      .eq("id", data.gameId)
      .maybeSingle();

    if (game?.auto_draw && data.status === "confirmed") {
      const { data: confs } = await supabaseAdmin
        .from("confirmations")
        .select("id")
        .eq("game_id", data.gameId)
        .eq("status", "confirmed");
      if (confs && confs.length >= game.max_players) {
        // Auto-draw trigger (implementar se necessário)
      }
    }

    return { ok: true };
  });

export const playerGameStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ gameId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const token = getRequestHeader("x-fdv-token");
    if (!token) throw new Error("Não autenticado");

    const { data: session, error: sessionError } = await supabaseAdmin
      .from("player_sessions")
      .select("player_id")
      .eq("token", token)
      .maybeSingle();
    if (sessionError) throw new Error(sessionError.message);

    if (!session) throw new Error("Sessão inválida");

    const { data: conf, error: confError } = await supabaseAdmin
      .from("confirmations")
      .select("status")
      .eq("game_id", data.gameId)
      .eq("player_id", session.player_id)
      .maybeSingle();
    if (confError) throw new Error(confError.message);

    const { data: pay, error: payError } = await supabaseAdmin
      .from("payments")
      .select("status, amount")
      .eq("game_id", data.gameId)
      .eq("player_id", session.player_id)
      .maybeSingle();
    if (payError) throw new Error(payError.message);

    return {
      confirmation: conf?.status ?? "pending",
      payment: pay?.status ?? "pending",
      amount: pay?.amount ?? 0,
    };
  });

// ─────────────────────────────────────────────
// Upload de foto de campo via server
// ─────────────────────────────────────────────
export const uploadFieldPhoto = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      fileBase64: z.string().min(1),
      fileName: z.string().min(1),
      contentType: z.string().min(1),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdminAccess();
    if (!ALLOWED_IMAGE_TYPES.has(data.contentType.toLowerCase())) {
      throw new Error("Formato de imagem não suportado. Use JPG, PNG ou WEBP.");
    }

    const base64Data = data.fileBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    if (!buffer.length) throw new Error("Arquivo de imagem inválido.");
    if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
      throw new Error("Imagem muito grande após compressão. Tente outra foto.");
    }

    const ext = data.fileName.split(".").pop()?.toLowerCase() || "jpg";
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const path = `fields/${timestamp}-${randomStr}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("fields")
      .upload(path, buffer, {
        contentType: data.contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error("[uploadFieldPhoto] Erro:", uploadError);
      throw new Error(`Falha no upload: ${uploadError.message}`);
    }

    const { data: urlData } = supabaseAdmin.storage
      .from("fields")
      .getPublicUrl(path);

    return { url: urlData.publicUrl, path };
  });

// ─────────────────────────────────────────────
// Resultado do jogo (placar + MVP)
// ─────────────────────────────────────────────
export const adminSetResult = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      gameId: z.string().uuid(),
      score_a: z.number().int().min(0),
      score_b: z.number().int().min(0),
      mvp_id: z.string().uuid().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdminAccess();

    const { data: teams } = await supabaseAdmin
      .from("game_teams")
      .select("id")
      .eq("game_id", data.gameId)
      .order("created_at", { ascending: true });

    const teamAId = teams?.[0]?.id ?? null;
    const teamBId = teams?.[1]?.id ?? null;

    const { data: existing } = await supabaseAdmin
      .from("game_results")
      .select("id")
      .eq("game_id", data.gameId)
      .maybeSingle();

    const payload = {
      game_id: data.gameId,
      score_a: data.score_a,
      score_b: data.score_b,
      mvp_player_id: data.mvp_id ?? null,
      team_a_id: teamAId,
      team_b_id: teamBId,
      status: "finished",
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      const { error } = await supabaseAdmin
        .from("game_results")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("game_results").insert(payload);
      if (error) throw new Error(error.message);
    }

    await supabaseAdmin
      .from("games")
      .update({ status: "done", updated_at: new Date().toISOString() })
      .eq("id", data.gameId);

    return { success: true };
  });

// ─────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────
export const adminDashboard = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdminAccess();
  const today = new Date().toISOString().slice(0, 10);

  const { data: settings, error: settingsError } = await supabaseAdmin
    .from("app_settings")
    .select("whatsapp_group_url")
    .eq("id", 1)
    .maybeSingle();
  if (settingsError) throw new Error(settingsError.message);

  const { data: nextGame } = await supabaseAdmin
    .from("games")
    .select("*")
    .gte("date", today)
    .eq("status", "scheduled")
    .order("date", { ascending: true })
    .limit(1)
    .maybeSingle();

  let confirmedCount = 0;
  let paidSum = 0;
  let pendingSum = 0;

  if (nextGame) {
    const { data: confs } = await supabaseAdmin
      .from("confirmations")
      .select("status")
      .eq("game_id", nextGame.id)
      .eq("status", "confirmed");
    confirmedCount = confs?.length ?? 0;

    const { data: pays } = await supabaseAdmin
      .from("payments")
      .select("amount, status")
      .eq("game_id", nextGame.id);
    for (const p of pays ?? []) {
      if (p.status === "paid") paidSum += Number(p.amount ?? 0);
      else if (p.status === "pending" || p.status === "late") pendingSum += Number(p.amount ?? 0);
    }
  }

  const { count: playersCount } = await supabaseAdmin
    .from("players")
    .select("id", { count: "exact", head: true })
    .eq("is_blocked", false);

  return {
    nextGame,
    confirmedCount,
    paidSum,
    pendingSum,
    playersCount: playersCount ?? 0,
    whatsapp_group_url: settings?.whatsapp_group_url ?? null,
  };
});

// ─────────────────────────────────────────────
// App Settings
// ─────────────────────────────────────────────
export const adminUpdateAppSettings = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        whatsapp_group_url: z.string().trim().max(500).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdminAccess();

    const url = data.whatsapp_group_url?.trim() ? data.whatsapp_group_url.trim() : null;
    if (url && !/^https:\/\/chat\.whatsapp\.com\//i.test(url)) {
      throw new Error("Link inválido. Use um link do tipo https://chat.whatsapp.com/...");
    }

    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert(
        {
          id: 1,
          whatsapp_group_url: url,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );

    if (error) throw new Error(error.message);
    return { ok: true };
  });