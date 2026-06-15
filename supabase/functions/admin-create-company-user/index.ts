import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) throw new Error("Sessao obrigatoria.");

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceRoleKey);
    const token = authorization.replace("Bearer ", "");
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) throw new Error("Sessao invalida.");

    const { data: caller, error: callerError } = await admin.from("profiles").select("role, company_id").eq("id", authData.user.id).single();
    if (callerError || !caller || !["super_admin", "company_admin"].includes(caller.role)) throw new Error("Sem permissao para criar usuarios.");

    const body = await request.json();
    if (caller.role !== "super_admin" && caller.company_id !== body.companyId) throw new Error("Admin da empresa so pode criar usuarios na propria empresa.");

    const { data: invite, error: inviteError } = await admin.auth.admin.inviteUserByEmail(body.email, {
      data: { full_name: body.fullName, company_id: body.companyId, role: body.role }
    });
    if (inviteError || !invite.user) throw inviteError ?? new Error("Nao foi possivel convidar o usuario.");

    const { error: profileError } = await admin.from("profiles").upsert({
      id: invite.user.id,
      company_id: body.companyId,
      full_name: body.fullName,
      email: body.email,
      role: body.role,
      active: body.active
    });
    if (profileError) throw profileError;

    const permissions = (body.modules as string[]).map((moduleKey) => ({
      user_id: invite.user.id,
      company_id: body.companyId,
      module_key: moduleKey,
      can_view: true,
      can_create: true,
      can_edit: true,
      can_delete: false
    }));
    if (permissions.length) {
      const { error: permissionError } = await admin.from("user_module_permissions").upsert(permissions, { onConflict: "user_id,company_id,module_key" });
      if (permissionError) throw permissionError;
    }

    return new Response(JSON.stringify({ userId: invite.user.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro inesperado." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
