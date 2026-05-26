import { createServerFn } from "@tanstack/react-start";

export const adminLoginAction = createServerFn({ method: "POST" })
  .handler(async (ctx: any) => {
    const request = ctx.request || ctx.req;
    
    if (!request) {
      throw new Error("Request não disponível");
    }
    
    const { password } = await request.json();
    
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Configuração incompleta");
    }

    const checkRes = await fetch(`${supabaseUrl}/rest/v1/rpc/check_admin_password`, {
      method: "POST",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input_password: password }),
    });

    const isValid = await checkRes.json();
    
    if (!isValid) {
      return { success: false, error: "Senha incorreta" };
    }

    const tokenRes = await fetch(`${supabaseUrl}/rest/v1/rpc/generate_admin_token`, {
      method: "POST",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
      },
    });

    const token = (await tokenRes.text()).replace(/"/g, "");

    await fetch(`${supabaseUrl}/rest/v1/admin_sessions`, {
      method: "POST",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({ token }),
    });

    return { success: true, token };
  });