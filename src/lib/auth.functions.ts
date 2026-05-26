import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveSessionPlayer, requirePlayer } from "./session.server";

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
    const { data: invite } = await supabaseAdmin
      .from("invite_codes")
      .select("id, code, status, is_admin, used_by")
      .eq("code", code)
      .maybeSingle();

    if (!invite) return { ok: false as const, reason: "Código inválido" };
    if (invite.status === "blocked") return { ok: false as const, reason: "Código bloqueado" };
    if (invite.status === "revoked") return { ok: false as const, reason: "Código revogado" };

    if (invite.status === "used" && invite.used_by) {
      const token = randomToken();
      await supabaseAdmin
        .from("player_sessions")
        .insert({ player_id: invite.used_by, token });
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
    const { data: invite } = await supabaseAdmin
      .from("invite_codes")
      .select("id, status, is_admin")
      .eq("id", data.inviteId)
      .maybeSingle();

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

    await supabaseAdmin
      .from("invite_codes")
      .update({ status: "used", used_by: player.id })
      .eq("id", invite.id);

    const token = randomToken();
    await supabaseAdmin.from("player_sessions").insert({ player_id: player.id, token });

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
    await supabaseAdmin.from("player_sessions").delete().eq("token", token);
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
    const base64Data = data.fileBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

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