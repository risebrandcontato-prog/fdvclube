import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRequestHeader } from "@tanstack/react-start/server";

function randomToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ─────────────────────────────────────────────
// Valida senha do admin e retorna token
// ─────────────────────────────────────────────
export const validateAdminPassword = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) =>
    z.object({ password: z.string().min(1) }).parse(d)
  )
  .handler(async ({ data }) => {
    const { data: config, error: configError } = await supabaseAdmin
      .from("admin_password")
      .select("password_hash")
      .eq("id", 1)
      .maybeSingle();

    if (configError) {
      console.error("[AdminAuth] Erro ao buscar config:", configError);
      return { ok: false as const, reason: "Erro ao buscar configuração" };
    }

    if (!config) {
      return { ok: false as const, reason: "Configuração não encontrada" };
    }

    const { data: isValid, error: rpcError } = await supabaseAdmin.rpc(
      "check_admin_password",
      { input_password: data.password }
    );

    if (rpcError) {
      console.error("[AdminAuth] Erro RPC:", rpcError);
      return { ok: false as const, reason: "Erro ao validar senha" };
    }

    if (!isValid) {
      return { ok: false as const, reason: "Senha incorreta" };
    }

    const token = randomToken();

    const { error: insertError } = await supabaseAdmin
      .from("admin_sessions")
      .insert({ token });

    if (insertError) {
      console.error("[AdminAuth] Erro ao salvar sessão:", insertError);
      return { ok: false as const, reason: "Erro ao criar sessão" };
    }

    return { ok: true as const, token };
  });

// ─────────────────────────────────────────────
// Verifica se token admin é válido (reusa x-fdv-token header)
// ─────────────────────────────────────────────
export const checkAdminToken = createServerFn({ method: "GET" }).handler(
  async () => {
    const token = getRequestHeader("x-fdv-token");
    if (!token) return { valid: false };

    const { data: session, error } = await supabaseAdmin
      .from("admin_sessions")
      .select("id")
      .eq("token", token)
      .maybeSingle();

    if (error) {
      console.error("[AdminAuth] Erro ao verificar token:", error);
      return { valid: false };
    }

    return { valid: !!session };
  }
);