import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdminAccess } from "./session.server";

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
  const { data } = await supabaseAdmin
    .from("invite_codes")
    .select("*, players!invite_codes_used_by_fk(id, name, avatar_url, is_blocked)")
    .order("created_at", { ascending: false });
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
    await supabaseAdmin.from("invite_codes").update({ status: "revoked" }).eq("id", data.id);
    return { ok: true };
  });

// ─────────────────────────────────────────────
// Players
// ─────────────────────────────────────────────
export const adminListPlayers = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdminAccess();
  const { data } = await supabaseAdmin.from("players").select("*").order("name");
  return data ?? [];
});

export const adminSetPlayerBlocked = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ playerId: z.string().uuid(), blocked: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdminAccess();
    await supabaseAdmin.from("players").update({ is_blocked: data.blocked }).eq("id", data.playerId);
    if (data.blocked) {
      await supabaseAdmin.from("player_sessions").delete().eq("player_id", data.playerId);
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
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const adminCreateLocation = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      name: z.string().min(1).max(120),
      address: z.string().max(255).optional().or(z.literal("")),
      maps_url: z.string().url().optional().or(z.literal("")),
      photo_url: z.string().url().optional().or(z.literal("")),
      phone: z.string().max(20).optional().or(z.literal("")),
      price_per_hour: z.number().min(0).optional(),
      opening_hours: z.string().max(100).optional().or(z.literal("")),
      rating: z.number().min(0).max(5).optional(),
      notes: z.string().max(500).optional().or(z.literal("")),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdminAccess();
    const { error } = await supabaseAdmin.from("locations").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdateLocation = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(120).optional(),
      address: z.string().max(255).optional().or(z.literal("")),
      maps_url: z.string().url().optional().or(z.literal("")),
      photo_url: z.string().url().optional().or(z.literal("")),
      phone: z.string().max(20).optional().or(z.literal("")),
      price_per_hour: z.number().min(0).optional(),
      opening_hours: z.string().max(100).optional().or(z.literal("")),
      rating: z.number().min(0).max(5).optional(),
      notes: z.string().max(500).optional().or(z.literal("")),
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
    await supabaseAdmin.from("locations").delete().eq("id", data.id);
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
    const { data: locs } = await supabaseAdmin
      .from("locations")
      .select("id, name, address, maps_url, photo_url")
      .in("id", locationIds);
    if (locs) {
      for (const loc of locs) locationsMap[loc.id] = loc;
    }
  }

  const enrichedGames = gameList.map((game) => ({
    ...game,
    locations: locationsMap[game.location_id] ?? null,
  }));

  const { data: confirmations } = await supabaseAdmin
    .from("confirmations")
    .select("game_id, player_id, status");

  return { games: enrichedGames, confirmations: confirmations ?? [] };
});

export const adminDeleteGame = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdminAccess();
    await supabaseAdmin.from("payments").delete().eq("game_id", data.id);
    await supabaseAdmin.from("confirmations").delete().eq("game_id", data.id);
    await supabaseAdmin.from("games").delete().eq("id", data.id);
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
      notes: z.string().max(500).optional().or(z.literal("")),
      has_ball: z.boolean().optional(),
      vests: z.enum(["none", "orange", "black", "both"]).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdminAccess();
    const { data: game, error } = await supabaseAdmin
      .from("games")
      .insert(data)
      .select("id")
      .single();
    if (error || !game) throw new Error(error?.message ?? "Falha ao criar jogo");

    const { data: players } = await supabaseAdmin
      .from("players")
      .select("id")
      .eq("is_blocked", false);
    if (players && players.length) {
      await supabaseAdmin.from("payments").insert(
        players.map((p) => ({
          game_id: game.id,
          player_id: p.id,
          amount: data.contribution_amount,
          status: "pending" as const,
        })),
      );
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
      notes: z.string().max(500).optional().or(z.literal("")),
      status: z.enum(["scheduled", "cancelled", "done"]).optional(),
      has_ball: z.boolean().optional(),
      vests: z.enum(["none", "orange", "black", "both"]).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdminAccess();
    const { id, ...rest } = data;
    const { error } = await supabaseAdmin.from("games").update(rest).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminGameDetail = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdminAccess();

    const { data: game } = await supabaseAdmin
      .from("games")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();

    if (!game) return { game: null, location: null, players: [], confirmations: [], payments: [] };

    const { data: location } = game.location_id
      ? await supabaseAdmin
          .from("locations")
          .select("*")
          .eq("id", game.location_id)
          .maybeSingle()
      : { data: null };

    const { data: players } = await supabaseAdmin
      .from("players")
      .select("id, name, avatar_url, position, jersey_number, preferred_foot, is_blocked")
      .order("name");

    const { data: confs } = await supabaseAdmin
      .from("confirmations")
      .select("*")
      .eq("game_id", data.id);

    const { data: payments } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("game_id", data.id);

    return {
      game,
      location: location ?? null,
      players: players ?? [],
      confirmations: confs ?? [],
      payments: payments ?? [],
    };
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
      notes: z.string().max(255).optional().or(z.literal("")),
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

    const { data: session } = await supabaseAdmin
      .from("player_sessions")
      .select("player_id")
      .eq("token", token)
      .maybeSingle();

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

    const { data: session } = await supabaseAdmin
      .from("player_sessions")
      .select("player_id")
      .eq("token", token)
      .maybeSingle();

    if (!session) throw new Error("Sessão inválida");

    const { data: conf } = await supabaseAdmin
      .from("confirmations")
      .select("status")
      .eq("game_id", data.gameId)
      .eq("player_id", session.player_id)
      .maybeSingle();

    const { data: pay } = await supabaseAdmin
      .from("payments")
      .select("status, amount")
      .eq("game_id", data.gameId)
      .eq("player_id", session.player_id)
      .maybeSingle();

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
    const base64Data = data.fileBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

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