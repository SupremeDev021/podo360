import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const clinicRoles = new Set(["company_admin", "professional", "reception", "financial", "stock", "schedule", "reports", "custom"]);
const platformRoles = new Set(["owner", "admin", "support", "commercial"]);

function assertClinicRole(role: unknown) {
  if (typeof role !== "string" || !clinicRoles.has(role)) {
    throw new Error("Perfil clinico invalido.");
  }
}

function getSafeErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error.trim();
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const message = record.message ?? record.error_description ?? record.error ?? record.details;
    if (typeof message === "string" && message.trim()) return message.trim();
    try {
      return JSON.stringify(record);
    } catch {
      return "Erro inesperado.";
    }
  }
  return "Erro inesperado.";
}

function throwStep(step: string, error: unknown) {
  throw new Error(`${step}: ${getSafeErrorMessage(error)}`);
}

async function getCompanyUserLimit(admin: ReturnType<typeof createClient>, companyId: string) {
  const { data: platformCompany, error: companyError } = await admin
    .from("platform_companies")
    .select("id, plan_id")
    .eq("clinic_company_id", companyId)
    .maybeSingle();

  if (companyError) throwStep("Falha ao buscar empresa comercial", companyError);
  if (!platformCompany) return null;

  const { data: subscription, error: subscriptionError } = await admin
    .from("platform_company_subscriptions")
    .select("max_users")
    .eq("company_id", platformCompany.id)
    .in("status", ["active", "trial"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subscriptionError) throwStep("Falha ao buscar assinatura da empresa", subscriptionError);
  if (subscription?.max_users != null) return Number(subscription.max_users);

  if (!platformCompany.plan_id) return null;

  const { data: plan, error: planError } = await admin
    .from("platform_plans")
    .select("max_users")
    .eq("id", platformCompany.plan_id)
    .maybeSingle();

  if (planError) throwStep("Falha ao buscar limite do plano", planError);
  if (plan?.max_users == null) return null;
  return Number(plan.max_users);
}

async function getActiveCompanyUserCount(admin: ReturnType<typeof createClient>, companyId: string) {
  const { count, error } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("active", true);

  if (error) throwStep("Falha ao salvar operacao", error);
  return count ?? 0;
}

async function assertCompanyUserLimit(admin: ReturnType<typeof createClient>, companyId: string, userIdBeingReactivated?: string) {
  const maxUsers = await getCompanyUserLimit(admin, companyId);
  if (maxUsers == null) return;

  let activeUsers = await getActiveCompanyUserCount(admin, companyId);
  if (userIdBeingReactivated) {
    const { data: target, error } = await admin
      .from("profiles")
      .select("active")
      .eq("id", userIdBeingReactivated)
      .single();

    if (error) throwStep("Falha ao salvar operacao", error);
    if (target?.active === false) activeUsers += 1;
  } else {
    activeUsers += 1;
  }

  if (activeUsers > maxUsers) {
    throw new Error("Limite de usuarios atingido para sua clinica. Entre em contato com o suporte Podo360 para aumentar o limite.");
  }
}

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
    if (authError || !authData.user) throwStep("Sessao invalida", authError ?? "Usuario nao encontrado");

    const { data: caller } = await admin.from("profiles").select("role, company_id").eq("id", authData.user.id).maybeSingle();
    const { data: platformAdmin, error: platformAdminError } = await admin
      .from("platform_admin_users")
      .select("role, active")
      .eq("user_id", authData.user.id)
      .eq("active", true)
      .maybeSingle();
    if (platformAdminError) throwStep("Falha ao validar Admin Global", platformAdminError);

    const isPlatformAdmin = Boolean(platformAdmin?.active && platformRoles.has(platformAdmin.role));
    const isClinicAdmin = Boolean(caller && ["super_admin", "company_admin"].includes(caller.role));
    if (!isPlatformAdmin && !isClinicAdmin) throw new Error("Sem permissao para criar usuarios.");

    const body = await request.json();
    if (!isPlatformAdmin && caller?.role !== "super_admin" && caller?.company_id !== body.companyId) {
      throw new Error("Admin da empresa so pode criar usuarios na propria empresa.");
    }

    if (body.action) {
      const { data: target, error: targetError } = await admin.from("profiles").select("id, email, company_id, full_name, role, active").eq("id", body.userId).single();
      if (targetError || !target) throwStep("Usuario nao encontrado", targetError ?? "Registro ausente em profiles");
      if (!isPlatformAdmin && caller?.role !== "super_admin" && target.company_id !== caller?.company_id) throw new Error("Admin da empresa so pode gerenciar usuarios da propria empresa.");
      if (!isPlatformAdmin && caller?.role !== "super_admin" && target.role === "super_admin") throw new Error("Admin da empresa nao pode gerenciar Super Admin.");

      if (body.action === "reset_password") {
        const { error } = await admin.auth.resetPasswordForEmail(target.email);
        if (error) throwStep("Falha ao salvar operacao", error);
        return new Response(JSON.stringify({ resetSent: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (body.action === "update") assertClinicRole(body.role);
      const active = body.action === "deactivate" ? false : body.action === "reactivate" ? true : body.active;
      const nextCompanyId = isPlatformAdmin || caller?.role === "super_admin" ? body.companyId : target.company_id;
      if (active === true && target.active === false) {
        await assertCompanyUserLimit(admin, nextCompanyId, body.userId);
      }

      const authUpdates: { email?: string; password?: string; user_metadata?: Record<string, unknown> } = {};
      if (typeof body.email === "string" && body.email.trim() && body.email.trim().toLowerCase() !== target.email.toLowerCase()) {
        authUpdates.email = body.email.trim();
      }
      if (typeof body.temporaryPassword === "string" && body.temporaryPassword.trim()) {
        if (body.temporaryPassword.trim().length < 6) throw new Error("A senha temporaria deve ter pelo menos 6 caracteres.");
        authUpdates.password = body.temporaryPassword.trim();
      }
      if (Object.keys(authUpdates).length) {
        authUpdates.user_metadata = { full_name: body.fullName ?? target.full_name, company_id: nextCompanyId, role: body.action === "update" ? body.role : target.role };
        const { error } = await admin.auth.admin.updateUserById(body.userId, authUpdates);
        if (error) throwStep("Falha ao salvar operacao", error);
      }

      const { error: updateError } = await admin.from("profiles").update({
        company_id: nextCompanyId,
        full_name: body.fullName ?? target.full_name,
        email: body.email ?? target.email,
        role: body.action === "update" ? body.role : target.role,
        active,
        disabled_at: active === false ? new Date().toISOString() : null,
        disabled_by: active === false ? authData.user.id : null
      }).eq("id", body.userId);
      if (updateError) throwStep("Falha ao atualizar profile", updateError);

      if (Array.isArray(body.modules)) {
        await admin.from("user_module_permissions").delete().eq("user_id", body.userId).eq("company_id", body.companyId);
        const permissions = body.modules.map((moduleKey: string) => ({ user_id: body.userId, company_id: body.companyId, module_key: moduleKey, can_view: true, can_create: true, can_edit: true, can_delete: false }));
        if (permissions.length) {
          const { error } = await admin.from("user_module_permissions").insert(permissions);
          if (error) throwStep("Falha ao salvar operacao", error);
        }
      }
      return new Response(JSON.stringify({ updated: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    assertClinicRole(body.role);
    if (body.active !== false) {
      await assertCompanyUserLimit(admin, body.companyId);
    }

    const temporaryPassword = typeof body.temporaryPassword === "string" ? body.temporaryPassword.trim() : "";
    if (temporaryPassword && temporaryPassword.length < 6) throw new Error("A senha temporaria deve ter pelo menos 6 caracteres.");

    const { data: invite, error: inviteError } = temporaryPassword
      ? await admin.auth.admin.createUser({
        email: body.email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: { full_name: body.fullName, company_id: body.companyId, role: body.role }
      })
      : await admin.auth.admin.inviteUserByEmail(body.email, {
        data: { full_name: body.fullName, company_id: body.companyId, role: body.role }
      });
    if (inviteError || !invite.user) throwStep("Falha ao criar usuario no Auth", inviteError ?? "Usuario Auth nao retornado");

    const { error: profileError } = await admin.from("profiles").upsert({
      id: invite.user.id,
      company_id: body.companyId,
      full_name: body.fullName,
      email: body.email,
      role: body.role,
      active: body.active
    });
    if (profileError) throwStep("Falha ao criar profile", profileError);

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
    return new Response(JSON.stringify({ error: getSafeErrorMessage(error) }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
