import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "./session.server";

function newCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  const arr = new Uint8Array(4);
  crypto.getRandomValues(arr);
  for (const b of arr) s += alphabet[b % alphabet.length];
  return `FDV-${s}`;
}

// ---- Codes ----
export const adminListCodes = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { data } = await supabaseAdmin
    .from("invite_codes")
    .select("*, players:used_by(id, name, avatar_url, is_blocked)")
    .order("created_at", { ascending: false });
  return data ?? [];
});

export const adminGenerateCode = createServerFn({ method: "POST" }).handler(async () => {
  const me = await requireAdmin();
  // Try a few times in case of collision
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    const { data, error } = await supabaseAdmin
      .from("invite_codes")
      .insert({ code, created_by: me.id })
      .select("*")
      .maybeSingle();
    if (!error && data) return data;
  }
  throw new Error("Não foi possível gerar código");
});

export const adminRevokeCode = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    await supabaseAdmin.from("invite_codes").update({ status: "revoked" }).eq("id", data.id);
    return { ok: true };
  });

// ---- Players ----
export const adminListPlayers = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { data } = await supabaseAdmin
    .from("players")
    .select("*")
    .order("name");
  return data ?? [];
});

export const adminSetPlayerBlocked = createServerFn({ method: "POST" })
  .inputValidator((d: { playerId: string; blocked: boolean }) =>
    z.object({ playerId: z.string().uuid(), blocked: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    await supabaseAdmin.from("players").update({ is_blocked: data.blocked }).eq("id", data.playerId);
    if (data.blocked) {
      await supabaseAdmin.from("player_sessions").delete().eq("player_id", data.playerId);
    }
    return { ok: true };
  });

// ---- Locations ----
export const adminCreateLocation = createServerFn({ method: "POST" })
  .inputValidator((d: { name: string; address?: string; maps_url?: string; photo_url?: string }) =>
    z.object({
      name: z.string().min(1).max(120),
      address: z.string().max(255).optional(),
      maps_url: z.string().url().optional(),
      photo_url: z.string().url().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin.from("locations").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteLocation = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    await supabaseAdmin.from("locations").delete().eq("id", data.id);
    return { ok: true };
  });

// ---- Games ----
export const adminCreateGame = createServerFn({ method: "POST" })
  .inputValidator((d: {
    title: string;
    date: string;
    time: string;
    location_id?: string | null;
    max_players: number;
    contribution_amount: number;
    notes?: string;
  }) =>
    z.object({
      title: z.string().min(1).max(120),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
      location_id: z.string().uuid().nullable().optional(),
      max_players: z.number().int().min(1).max(50),
      contribution_amount: z.number().min(0).max(10000),
      notes: z.string().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { data: game, error } = await supabaseAdmin
      .from("games")
      .insert(data)
      .select("id")
      .single();
    if (error || !game) throw new Error(error?.message ?? "Falha ao criar jogo");
    // Pre-create pending payments for all active players
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
  .inputValidator((d: {
    id: string;
    title?: string;
    date?: string;
    time?: string;
    location_id?: string | null;
    max_players?: number;
    notes?: string;
    status?: "scheduled" | "cancelled" | "done";
  }) =>
    z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(120).optional(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
      location_id: z.string().uuid().nullable().optional(),
      max_players: z.number().int().min(1).max(50).optional(),
      notes: z.string().max(500).optional(),
      status: z.enum(["scheduled", "cancelled", "done"]).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { id, ...rest } = data;
    const { error } = await supabaseAdmin.from("games").update(rest).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminGameDetail = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { data: game } = await supabaseAdmin
      .from("games")
      .select("*, locations(*)")
      .eq("id", data.id)
      .maybeSingle();
    const { data: players } = await supabaseAdmin
      .from("players")
      .select("id, name, avatar_url, position, is_blocked")
      .order("name");
    const { data: confs } = await supabaseAdmin
      .from("confirmations")
      .select("*")
      .eq("game_id", data.id);
    const { data: payments } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("game_id", data.id);
    return { game, players: players ?? [], confirmations: confs ?? [], payments: payments ?? [] };
  });

export const adminSetConfirmation = createServerFn({ method: "POST" })
  .inputValidator((d: { gameId: string; playerId: string; status: "confirmed" | "cancelled" }) =>
    z.object({
      gameId: z.string().uuid(),
      playerId: z.string().uuid(),
      status: z.enum(["confirmed", "cancelled"]),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin
      .from("confirmations")
      .upsert(
        { game_id: data.gameId, player_id: data.playerId, status: data.status },
        { onConflict: "game_id,player_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Payments ----
export const adminSetPayment = createServerFn({ method: "POST" })
  .inputValidator((d: {
    gameId: string;
    playerId: string;
    status: "paid" | "pending" | "late" | "exempt";
    amount?: number;
    notes?: string;
  }) =>
    z.object({
      gameId: z.string().uuid(),
      playerId: z.string().uuid(),
      status: z.enum(["paid", "pending", "late", "exempt"]),
      amount: z.number().min(0).max(10000).optional(),
      notes: z.string().max(255).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const patch: Record<string, unknown> = { status: data.status };
    if (data.amount !== undefined) patch.amount = data.amount;
    if (data.notes !== undefined) patch.notes = data.notes;
    if (data.status === "paid") patch.paid_at = new Date().toISOString();
    else patch.paid_at = null;

    const { error } = await supabaseAdmin
      .from("payments")
      .upsert(
        { game_id: data.gameId, player_id: data.playerId, ...patch },
        { onConflict: "game_id,player_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDashboard = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
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
