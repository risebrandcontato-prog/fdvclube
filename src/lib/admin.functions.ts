import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdminAccess } from "./session.server";

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

function getAdminId(
  auth: Awaited<ReturnType<typeof requireAdminAccess>>
): string | null {
  return auth.type === "player" ? auth.player.id : null;
}

// ─────────────────────────────────────────────
// Codes
// ─────────────────────────────────────────────
export const adminListCodes = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdminAccess();
  const { data, error } = await supabaseAdmin
    .from("invite_codes")
    .select("*, players!invite_codes_used_by_fk(id, name, avatar_url, is_blocked)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
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

// ─────────────────────────────────────────────
// Locations
// ─────────────────────────────────────────────
export const adminListLocations = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdminAccess();
  const { data, error } = await supabaseAdmin
    .from("locations")
    .select("*")
    .order("name", { ascending: true });
  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null as string | null };
});

// Schema base para campos (reutilizado)
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
    // Remove campos undefined/vazios antes de inserir
    const cleanData: Record<string, any> = { name: data.name };
    if (data.address) cleanData.address = data.address;
    if (data.maps_url && data.maps_url !== "") cleanData.maps_url = data.maps_url;
    if (data.photo_url && data.photo_url !== "") cleanData.photo_url = data.photo_url;
    if (data.phone) cleanData.phone = data.phone;
    if (data.price_per_hour != null) cleanData.price_per_hour = data.price_per_hour;
    if (data.opening_hours) cleanData.opening_hours = data.opening_hours;
    if (data.rating != null) cleanData.rating = data.rating;
    if (data.notes) cleanData.notes = data.notes;

    const { error } = await supabaseAdmin.from("locations").insert(cleanData);
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
    const { error } = await supabaseAdmin.from("locations").update(rest).eq("id", id);
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

  const gameList = (games ?? []) as any[];

  const locationIds = [...new Set(gameList.map((g) => g.location_id).filter(Boolean))];
  let locationsMap: Record<string, any> = {};
  if (locationIds.length > 0) {
    const { data: locs, error: locsError } = await supabaseAdmin
      .from("locations")
      .select("id, name, address, maps_url, photo_url")
      .in("id", locationIds);
    if (locsError) throw new Error(locsError.message);
    if (locs) {
      for (const loc of locs) locationsMap[loc.id] = loc;
    }
  }

  const enrichedGames = gameList.map((game) => ({
    ...game,
    locations: locationsMap[game.location_id] ?? null,
  }));

  const gameIds = enrichedGames.map((g) => g.id);
  let resultsMap: Record<string, any> = {};
  if (gameIds.length > 0) {
    const { data: results, error: resultsError } = await supabaseAdmin
      .from("game_results")
      .select("*")
      .in("game_id", gameIds);
    if (resultsError) throw new Error(resultsError.message);
    for (const result of results ?? []) {
      resultsMap[result.game_id] = result;
    }
  }

  const { data: confirmations, error: confsError } = await supabaseAdmin
    .from("confirmations")
    .select("game_id, player_id, status");
  if (confsError) throw new Error(confsError.message);

  return {
    games: enrichedGames.map((g) => ({ ...g, result: resultsMap[g.id] ?? null })),
    confirmations: confirmations ?? [],
  };
});

export const adminDeleteGame = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdminAccess();
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

    const { data: game, error } = await supabaseAdmin
      .from("games")
      .insert(data)
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
    const { error } = await supabaseAdmin.from("games").update(rest).eq("id", id);
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
      .select("id, name, avatar_url, position, jersey_number, preferred_foot, is_blocked")
      .order("name");
    if (playersError) throw new Error(playersError.message);

    const { data: confs, error: confsError } = await supabaseAdmin
      .from("confirmations")
      .select("*")
      .eq("game_id", data.id);
    if (confsError) throw new Error(confsError.message);

    const { data: payments, error: paymentsError } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("game_id", data.id);
    if (paymentsError) throw new Error(paymentsError.message);

    const { data: stats, error: statsError } = await supabaseAdmin
      .from("game_player_stats")
      .select("*")
      .eq("game_id", data.id);
    if (statsError) throw new Error(statsError.message);

    const { data: result, error: resultError } = await supabaseAdmin
      .from("game_results")
      .select("*")
      .eq("game_id", data.id)
      .maybeSingle();
    if (resultError) throw new Error(resultError.message);

    const { data: teams, error: teamsError } = await supabaseAdmin
      .from("game_teams")
      .select("id, game_id, team_name, color")
      .eq("game_id", data.id);
    if (teamsError) throw new Error(teamsError.message);

    return {
      game,
      location: location ?? null,
      players: players ?? [],
      confirmations: confs ?? [],
      payments: payments ?? [],
      stats: stats ?? [],
      result: result ?? null,
      teams: teams ?? [],
    };
  });

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

    const payload = data.stats.map((s) => ({
      game_id: data.gameId,
      player_id: s.playerId,
      goals: s.goals,
      assists: s.assists,
      own_goals: s.own_goals,
      yellow_cards: s.yellow_cards,
      red_cards: s.red_cards,
      rating: s.rating ?? null,
      notes: s.notes ?? null,
      updated_at: new Date().toISOString(),
    }));

    const { error: upsertError } = await supabaseAdmin
      .from("game_player_stats")
      .upsert(payload, { onConflict: "game_id,player_id" });
    if (upsertError) throw new Error(upsertError.message);

    const { data: teams, error: teamsError } = await supabaseAdmin
      .from("game_teams")
      .select("id, team_name")
      .eq("game_id", data.gameId)
      .order("created_at", { ascending: true });
    if (teamsError) throw new Error(teamsError.message);

    let scoreA = 0;
    let scoreB = 0;
    let teamAId: string | null = null;
    let teamBId: string | null = null;

    if ((teams ?? []).length >= 2) {
      const [teamA, teamB] = teams as Array<{ id: string; team_name: string }>;
      teamAId = teamA.id;
      teamBId = teamB.id;

      const { data: teamPlayers, error: teamPlayersError } = await supabaseAdmin
        .from("game_team_players")
        .select("team_id, player_id")
        .in("team_id", [teamA.id, teamB.id]);
      if (teamPlayersError) throw new Error(teamPlayersError.message);

      const teamAPlayers = new Set((teamPlayers ?? []).filter((tp) => tp.team_id === teamA.id).map((tp) => tp.player_id));
      const teamBPlayers = new Set((teamPlayers ?? []).filter((tp) => tp.team_id === teamB.id).map((tp) => tp.player_id));

      for (const stat of payload) {
        const totalGoals = Number(stat.goals ?? 0);
        const ownGoals = Number(stat.own_goals ?? 0);
        if (teamAPlayers.has(stat.player_id)) {
          scoreA += totalGoals;
          scoreB += ownGoals;
        } else if (teamBPlayers.has(stat.player_id)) {
          scoreB += totalGoals;
          scoreA += ownGoals;
        }
      }
    } else {
      scoreA = payload.reduce((sum, row) => sum + Number(row.goals ?? 0), 0);
      scoreB = 0;
    }

    const sortedByGoals = [...payload].sort((a, b) => b.goals - a.goals);
    const topScorer = sortedByGoals[0];
    const sortedByRating = [...payload]
      .filter((row) => row.rating !== null && row.rating !== undefined)
      .sort((a, b) => Number(b.rating) - Number(a.rating));
    const mvp = sortedByRating[0];

    const notes = [
      topScorer && topScorer.goals > 0 ? `Artilheiro do jogo: ${topScorer.goals} gol(s)` : null,
    ]
      .filter(Boolean)
      .join(" | ");

    const { error: resultError } = await supabaseAdmin
      .from("game_results")
      .upsert(
        {
          game_id: data.gameId,
          team_a_id: teamAId,
          team_b_id: teamBId,
          score_a: scoreA,
          score_b: scoreB,
          status: "finished",
          mvp_player_id: mvp?.player_id ?? null,
          notes: notes || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "game_id" },
      );
    if (resultError) throw new Error(resultError.message);

    return { success: true, error: null as string | null };
  });

export const adminSetConfirmation = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      gameId: z.string().uuid(),
      playerId: z.string().uuid(),
      status: z.enum(["confirmed", "cancelled", "pending"]),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdminAccess();
    const { error } = await supabaseAdmin
      .from("confirmations")
      .upsert(
        { game_id: data.gameId, player_id: data.playerId, status: data.status },
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
    const patch: Record<string, unknown> = { status: data.status };
    if (data.amount !== undefined) patch.amount = data.amount;
    if (data.notes !== undefined) patch.notes = data.notes;
    if (data.status === "paid") patch.paid_at = new Date().toISOString();
    else patch.paid_at = null;

    const { error } = await supabaseAdmin
      .from("payments")
      .upsert(
        { game_id: data.gameId, player_id: data.playerId, ...patch },
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

    const { error } = await supabaseAdmin
      .from("confirmations")
      .upsert(
        { game_id: data.gameId, player_id: session.player_id, status: data.status },
        { onConflict: "game_id, player_id" },
      );
    if (error) throw new Error(error.message);
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
// Dashboard
// ─────────────────────────────────────────────
export const adminDashboard = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdminAccess();
  const today = new Date().toISOString().slice(0, 10);
  const { data: nextGame } = await supabaseAdmin
    .from("games")
    .select("*, locations(name)")
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

  return { nextGame, confirmedCount, paidSum, pendingSum, playersCount: playersCount ?? 0 };
});