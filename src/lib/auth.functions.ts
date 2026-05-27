import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveSessionPlayer, requirePlayer } from "./session.server";

const MAX_IMAGE_SIZE_BYTES = 6 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
let playersColumnsCache: Set<string> | null = null;

async function getPlayersColumns() {
  if (playersColumnsCache) return playersColumnsCache;
  const { data, error } = await supabaseAdmin
    .from("players")
    .select("*")
    .limit(1);
  if (error) throw new Error(error.message);

  const row = (data?.[0] ?? {}) as Record<string, unknown>;
  playersColumnsCache = new Set(Object.keys(row));
  return playersColumnsCache;
}

function randomToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Step 1: validate an invite code (does not create session yet)
export const validateInviteCode = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string }) => z.object({ code: z.string().min(1).max(64) }).parse(d))
  .handler(async ({ data }) => {
    const code = data.code.trim().toUpperCase();
    const { data: invite, error } = await supabaseAdmin
      .from("invite_codes")
      .select("id, code, status, is_admin, used_by")
      .eq("code", code)
      .maybeSingle();
    if (error) throw new Error(error.message);

    if (!invite) return { ok: false as const, reason: "Código inválido" };
    if (invite.status === "blocked") return { ok: false as const, reason: "Código bloqueado" };
    if (invite.status === "revoked") return { ok: false as const, reason: "Código revogado" };

    if (invite.status === "used" && invite.used_by) {
      const token = randomToken();
      const { error: sessionError } = await supabaseAdmin
        .from("player_sessions")
        .insert({ player_id: invite.used_by, token });
      if (sessionError) throw new Error(sessionError.message);
      return { ok: true as const, kind: "existing" as const, token, inviteId: invite.id };
    }

    return { ok: true as const, kind: "new" as const, inviteId: invite.id, isAdmin: invite.is_admin };
  });

// Step 2: create profile for a brand-new invite
export const createProfile = createServerFn({ method: "POST" })
  .inputValidator((d: {
    inviteId: string;
    name: string;
    position: string;
    jersey_number?: number | null;
    preferred_foot?: string;
    avatar_url?: string | null;
  }) =>
    z.object({
      inviteId: z.string().uuid(),
      name: z.string().min(1).max(80),
      position: z.string().min(1),
      jersey_number: z.number().min(1).max(99).nullable().optional(),
      preferred_foot: z.enum(["right", "left", "both"]).optional(),
      avatar_url: z.string().url().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("invite_codes")
      .select("id, status, is_admin")
      .eq("id", data.inviteId)
      .maybeSingle();
    if (inviteError) throw new Error(inviteError.message);

    if (!invite) throw new Error("Código não encontrado");
    if (invite.status !== "pending") throw new Error("Código indisponível");

    const { data: player, error: playerErr } = await supabaseAdmin
      .from("players")
      .insert({
        name: data.name.trim(),
        position: data.position as any,
        jersey_number: data.jersey_number ?? null,
        preferred_foot: data.preferred_foot ?? "right",
        avatar_url: data.avatar_url ?? null,
        invite_code_id: invite.id,
        is_admin: invite.is_admin,
      } as any)
      .select("id")
      .single();

    if (playerErr || !player) throw new Error(playerErr?.message ?? "Falha ao criar perfil");

    const { error: inviteUpdateError } = await supabaseAdmin
      .from("invite_codes")
      .update({ status: "used", used_by: player.id })
      .eq("id", invite.id);
    if (inviteUpdateError) throw new Error(inviteUpdateError.message);

    const token = randomToken();
    const { error: sessionError } = await supabaseAdmin
      .from("player_sessions")
      .insert({ player_id: player.id, token });
    if (sessionError) throw new Error(sessionError.message);

    return { token, playerId: player.id };
  });

export const getMe = createServerFn({ method: "GET" }).handler(async () => {
  const player = await resolveSessionPlayer();
  return player;
});

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  const token = getRequestHeader("x-fdv-token");
  if (token) {
    const { error } = await supabaseAdmin.from("player_sessions").delete().eq("token", token);
    if (error) throw new Error(error.message);
  }
  return { ok: true };
});

export const updateMyProfile = createServerFn({ method: "POST" })
  .inputValidator((d: {
    name: string;
    position: string;
    jersey_number?: number | null;
    preferred_foot?: string;
    avatar_url?: string | null;
  }) =>
    z.object({
      name: z.string().min(1).max(80),
      position: z.string().min(1),
      jersey_number: z.number().min(1).max(99).nullable().optional(),
      preferred_foot: z.enum(["right", "left", "both"]).optional(),
      avatar_url: z.string().url().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const me = await requirePlayer();
    const { error } = await supabaseAdmin
      .from("players")
      .update({
        name: data.name.trim(),
        position: data.position as any,
        jersey_number: data.jersey_number ?? null,
        preferred_foot: data.preferred_foot ?? "right",
        avatar_url: data.avatar_url ?? null,
      } as any)
      .eq("id", me.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyProfile = createServerFn({ method: "GET" }).handler(async () => {
  const me = await requirePlayer();
  const { data, error } = await supabaseAdmin.from("players").select("*").eq("id", me.id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Perfil não encontrado.");

  const row = data as Record<string, any>;
  return {
    id: row.id,
    name: row.name ?? "",
    avatar_url: row.avatar_url ?? null,
    position: row.position ?? null,
    nickname: row.nickname ?? null,
    phone: row.phone ?? null,
    birth_date: row.birth_date ?? null,
    preferred_position: row.preferred_position ?? row.position ?? null,
    secondary_position: row.secondary_position ?? null,
    strong_foot: row.strong_foot ?? row.preferred_foot ?? null,
  };
});

export const updatePlayerProfile = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().min(1).max(80),
        nickname: z.string().max(80).nullable().optional(),
        phone: z.string().max(30).nullable().optional(),
        birth_date: z.string().nullable().optional(),
        preferred_position: z.string().max(50).nullable().optional(),
        secondary_position: z.string().max(50).nullable().optional(),
        strong_foot: z.enum(["left", "right", "both"]).nullable().optional(),
        avatar_url: z.string().url().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const me = await requirePlayer();
    const columns = await getPlayersColumns();
    const patch: Record<string, unknown> = {
      name: data.name.trim(),
      avatar_url: data.avatar_url ?? null,
    };

    if (columns.has("nickname")) patch.nickname = data.nickname ?? null;
    if (columns.has("phone")) patch.phone = data.phone ?? null;
    if (columns.has("birth_date")) patch.birth_date = data.birth_date || null;
    if (columns.has("preferred_position")) patch.preferred_position = data.preferred_position ?? null;
    if (columns.has("secondary_position")) patch.secondary_position = data.secondary_position ?? null;
    if (columns.has("strong_foot")) patch.strong_foot = data.strong_foot ?? null;

    if (columns.has("position")) {
      const fallbackPosition = (data.preferred_position?.trim() || "meio") as any;
      patch.position = fallbackPosition;
    }

    if (columns.has("preferred_foot")) {
      patch.preferred_foot = data.strong_foot ?? "right";
    }

    const { error } = await supabaseAdmin.from("players").update(patch as any).eq("id", me.id);
    if (error) throw new Error(error.message);
    return { success: true, error: null as string | null };
  });

// Upload de avatar via server (mais confiável que client-side)
export const uploadAvatar = createServerFn({ method: "POST" })
  .inputValidator((d: {
    fileBase64: string;
    fileName: string;
    contentType: string;
  }) =>
    z.object({
      fileBase64: z.string().min(1),
      fileName: z.string().min(1),
      contentType: z.string().min(1),
    }).parse(d),
  )
  .handler(async ({ data }) => {
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
    const path = `players/${timestamp}-${randomStr}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("avatars")
      .upload(path, buffer, {
        contentType: data.contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error("[uploadAvatar] Erro:", uploadError);
      throw new Error(`Falha no upload: ${uploadError.message}`);
    }

    const { data: urlData } = supabaseAdmin.storage
      .from("avatars")
      .getPublicUrl(path);

    return { url: urlData.publicUrl, path };
  });