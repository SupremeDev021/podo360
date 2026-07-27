import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const inviteManagerRoles = new Set(["owner", "admin"]);
const defaultRegistrationUrl = "https://cadastro.podo360.supremetechdev.com";
const inviteDurationHours = 72;

type AdminClient = ReturnType<typeof createClient>;

class PublicError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function getRegistrationUrl() {
  const configured = Deno.env.get("CLIENT_REGISTRATION_URL")?.trim();
  if (configured && /^https:\/\//i.test(configured)) return trimTrailingSlash(configured);
  return defaultRegistrationUrl;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return bytesToHex(new Uint8Array(digest));
}

function createToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

async function requirePlatformAdmin(admin: AdminClient, authorization: string | null) {
  if (!authorization?.startsWith("Bearer ")) {
    throw new PublicError("admin_session_required", "Entre novamente no Admin Global para continuar.", 401);
  }

  const token = authorization.slice("Bearer ".length);
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) {
    throw new PublicError("admin_session_required", "Sua sessao administrativa expirou. Entre novamente.", 401);
  }

  const { data: platformAdmin, error } = await admin
    .from("platform_admin_users")
    .select("role, active")
    .eq("user_id", authData.user.id)
    .eq("active", true)
    .maybeSingle();

  if (error || !platformAdmin || !inviteManagerRoles.has(platformAdmin.role)) {
    throw new PublicError("admin_permission_denied", "Voce nao possui permissao para gerenciar convites.", 403);
  }

  return authData.user;
}

async function writeAudit(
  admin: AdminClient,
  action: string,
  details: {
    actorUserId?: string | null;
    entityId?: string | null;
    platformCompanyId?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  await admin.from("platform_admin_audit_logs").insert({
    actor_user_id: details.actorUserId ?? null,
    action,
    entity_type: "client_access_invite",
    entity_id: details.entityId ?? null,
    company_id: details.platformCompanyId ?? null,
    metadata: details.metadata ?? {}
  });
}

async function findAuthUserByEmail(admin: AdminClient, email: string) {
  const perPage = 1000;
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new PublicError("service_unavailable", "Nao foi possivel validar o acesso agora.", 503);
    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) return match;
    if (data.users.length < perPage) break;
  }
  return null;
}

async function getInviteContext(admin: AdminClient, rawToken: unknown) {
  const token = typeof rawToken === "string" ? rawToken.trim() : "";
  if (token.length < 32) {
    throw new PublicError("invalid_token", "Este link nao e valido. Solicite um novo acesso ao suporte Podo360.");
  }

  const tokenHash = await hashToken(token);
  const { data: invite, error } = await admin
    .from("client_access_invites")
    .select("id,registration_request_id,company_id,platform_company_id,email,name,role,status,expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !invite) {
    throw new PublicError("invalid_token", "Este link nao e valido. Solicite um novo acesso ao suporte Podo360.");
  }

  if (invite.status === "used") {
    throw new PublicError("used_token", "Este acesso ja foi criado. Faca login para continuar.");
  }
  if (invite.status === "cancelled") {
    throw new PublicError("cancelled_token", "Este link foi cancelado. Solicite um novo acesso ao suporte Podo360.");
  }
  if (invite.status === "processing") {
    throw new PublicError("invite_processing", "A criacao deste acesso ja esta em andamento. Aguarde alguns instantes.");
  }
  if (invite.status === "expired" || new Date(invite.expires_at).getTime() <= Date.now()) {
    if (invite.status !== "expired") {
      await admin.from("client_access_invites").update({ status: "expired" }).eq("id", invite.id).eq("status", "pending");
    }
    throw new PublicError("expired_token", "Este link expirou. Solicite um novo acesso ao suporte Podo360.");
  }

  const [{ data: registration }, { data: company }, { data: platformCompany }, { data: subscription }] = await Promise.all([
    admin
      .from("platform_client_registration_requests")
      .select("id,status,approved_company_id,approved_platform_company_id")
      .eq("id", invite.registration_request_id)
      .maybeSingle(),
    admin.from("companies").select("id,name,plan_status").eq("id", invite.company_id).maybeSingle(),
    admin.from("platform_companies").select("id,clinic_company_id,status,plan_id").eq("id", invite.platform_company_id).maybeSingle(),
    admin
      .from("platform_company_subscriptions")
      .select("id,status,plan_id,max_users")
      .eq("company_id", invite.platform_company_id)
      .in("status", ["active", "trial"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  const registrationApproved =
    registration &&
    ["approved", "converted"].includes(registration.status) &&
    registration.approved_company_id === invite.company_id &&
    registration.approved_platform_company_id === invite.platform_company_id;
  if (!registrationApproved) {
    throw new PublicError("registration_not_approved", "Seu cadastro ainda esta em analise. Aguarde a liberacao da equipe Podo360.");
  }

  if (
    !company ||
    !platformCompany ||
    platformCompany.clinic_company_id !== invite.company_id ||
    !["active", "trial"].includes(platformCompany.status)
  ) {
    throw new PublicError("company_unavailable", "O acesso da sua clinica ainda nao esta liberado.");
  }
  if (!subscription || !subscription.plan_id || !["active", "trial"].includes(subscription.status)) {
    throw new PublicError("subscription_unavailable", "O plano da sua clinica ainda nao esta pronto para liberacao.");
  }

  return { invite, company, platformCompany, subscription };
}

async function getMaxUsers(admin: AdminClient, platformCompany: { plan_id: string | null }, subscription: { max_users: number | null }) {
  if (subscription.max_users != null) return Number(subscription.max_users);
  if (!platformCompany.plan_id) return null;
  const { data: plan } = await admin.from("platform_plans").select("max_users").eq("id", platformCompany.plan_id).maybeSingle();
  return plan?.max_users == null ? null : Number(plan.max_users);
}

async function assertUserCapacity(
  admin: AdminClient,
  companyId: string,
  platformCompany: { plan_id: string | null },
  subscription: { max_users: number | null }
) {
  const maxUsers = await getMaxUsers(admin, platformCompany, subscription);
  if (maxUsers == null) return;
  const { count, error } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("active", true);
  if (error) throw new PublicError("service_unavailable", "Nao foi possivel validar o limite de usuarios agora.", 503);
  if ((count ?? 0) >= maxUsers) {
    throw new PublicError("user_limit_reached", "Limite de usuarios atingido para esta clinica. Entre em contato com o suporte Podo360.");
  }
}

async function generateInvite(admin: AdminClient, authorization: string | null, requestId: unknown) {
  const actor = await requirePlatformAdmin(admin, authorization);
  if (typeof requestId !== "string" || !requestId) {
    throw new PublicError("invalid_request", "Selecione uma solicitacao valida.");
  }

  const { data: registration, error } = await admin
    .from("platform_client_registration_requests")
    .select("id,status,desired_admin_email,desired_admin_name,responsible_email,responsible_name,approved_company_id,approved_platform_company_id")
    .eq("id", requestId)
    .maybeSingle();

  if (error || !registration) throw new PublicError("invalid_request", "Solicitacao de cadastro nao encontrada.", 404);
  if (
    !["approved", "converted"].includes(registration.status) ||
    !registration.approved_company_id ||
    !registration.approved_platform_company_id
  ) {
    throw new PublicError("registration_not_approved", "Converta e aprove a clinica antes de gerar o acesso.");
  }

  const email = normalizeEmail(registration.desired_admin_email || registration.responsible_email);
  const name = String(registration.desired_admin_name || registration.responsible_name || "").trim();
  if (!email) throw new PublicError("invalid_email", "A solicitacao nao possui um e-mail de administrador valido.");

  await getInviteContextForAdmin(admin, registration);

  await admin
    .from("client_access_invites")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("registration_request_id", registration.id)
    .eq("email", email)
    .in("status", ["pending", "processing"]);

  const rawToken = createToken();
  const tokenHash = await hashToken(rawToken);
  const expiresAt = new Date(Date.now() + inviteDurationHours * 60 * 60 * 1000).toISOString();
  const { data: invite, error: insertError } = await admin
    .from("client_access_invites")
    .insert({
      token_hash: tokenHash,
      registration_request_id: registration.id,
      company_id: registration.approved_company_id,
      platform_company_id: registration.approved_platform_company_id,
      email,
      name: name || null,
      role: "company_admin",
      status: "pending",
      expires_at: expiresAt,
      created_by: actor.id
    })
    .select("id")
    .single();

  if (insertError || !invite) {
    throw new PublicError("service_unavailable", "Nao foi possivel gerar o link de acesso agora.", 503);
  }

  await writeAudit(admin, "client_access_invite_generated", {
    actorUserId: actor.id,
    entityId: invite.id,
    platformCompanyId: registration.approved_platform_company_id,
    metadata: { registrationRequestId: registration.id, email, expiresAt }
  });

  return respond({
    inviteId: invite.id,
    accessUrl: `${getRegistrationUrl()}/criar-acesso#token=${encodeURIComponent(rawToken)}`,
    expiresAt
  });
}

async function getInviteContextForAdmin(
  admin: AdminClient,
  registration: { approved_company_id: string; approved_platform_company_id: string }
) {
  const [{ data: platformCompany }, { data: subscription }] = await Promise.all([
    admin
      .from("platform_companies")
      .select("id,clinic_company_id,status,plan_id")
      .eq("id", registration.approved_platform_company_id)
      .maybeSingle(),
    admin
      .from("platform_company_subscriptions")
      .select("id,status,plan_id")
      .eq("company_id", registration.approved_platform_company_id)
      .in("status", ["active", "trial"])
      .limit(1)
      .maybeSingle()
  ]);
  if (
    !platformCompany ||
    platformCompany.clinic_company_id !== registration.approved_company_id ||
    !["active", "trial"].includes(platformCompany.status)
  ) {
    throw new PublicError("company_unavailable", "Ative ou coloque a clinica em periodo de teste antes de gerar o acesso.");
  }
  if (!subscription?.plan_id) {
    throw new PublicError("subscription_unavailable", "Configure um plano e uma assinatura ativa antes de gerar o acesso.");
  }
}

async function cancelInvite(admin: AdminClient, authorization: string | null, inviteId: unknown) {
  const actor = await requirePlatformAdmin(admin, authorization);
  if (typeof inviteId !== "string" || !inviteId) throw new PublicError("invalid_request", "Convite invalido.");

  const { data: invite } = await admin
    .from("client_access_invites")
    .select("id,status,platform_company_id,registration_request_id,email")
    .eq("id", inviteId)
    .maybeSingle();
  if (!invite) throw new PublicError("invalid_request", "Convite nao encontrado.", 404);
  if (!["pending", "processing"].includes(invite.status)) {
    throw new PublicError("invite_not_pending", "Somente convites pendentes podem ser cancelados.");
  }

  const { error } = await admin
    .from("client_access_invites")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", invite.id)
    .in("status", ["pending", "processing"]);
  if (error) throw new PublicError("service_unavailable", "Nao foi possivel cancelar o convite agora.", 503);

  await writeAudit(admin, "client_access_invite_cancelled", {
    actorUserId: actor.id,
    entityId: invite.id,
    platformCompanyId: invite.platform_company_id,
    metadata: { registrationRequestId: invite.registration_request_id, email: invite.email }
  });
  return respond({ cancelled: true });
}

async function validateInvite(admin: AdminClient, rawToken: unknown) {
  const context = await getInviteContext(admin, rawToken);
  const existingUser = await findAuthUserByEmail(admin, context.invite.email);
  if (existingUser) {
    const { data: profile } = await admin
      .from("profiles")
      .select("company_id,active")
      .eq("id", existingUser.id)
      .maybeSingle();
    if (profile?.company_id === context.invite.company_id) {
      throw new PublicError("user_already_exists", "Este e-mail ja possui acesso ao Podo360. Faca login para continuar.");
    }
    throw new PublicError("email_conflict", "Este e-mail ja esta vinculado a outro cadastro. Entre em contato com o suporte Podo360.");
  }

  return respond({
    valid: true,
    clinicName: context.company.name,
    email: context.invite.email,
    name: context.invite.name ?? "",
    expiresAt: context.invite.expires_at
  });
}

async function completeInvite(admin: AdminClient, body: Record<string, unknown>) {
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!fullName) throw new PublicError("invalid_name", "Informe seu nome completo.");
  if (password.length < 8) throw new PublicError("weak_password", "Sua senha precisa ter pelo menos 8 caracteres.");
  if (body.acceptedTerms !== true) throw new PublicError("terms_required", "Aceite os termos para criar seu acesso.");

  const context = await getInviteContext(admin, body.token);
  try {
    await assertUserCapacity(admin, context.invite.company_id, context.platformCompany, context.subscription);
  } catch (error) {
    if (error instanceof PublicError && error.code === "user_limit_reached") {
      await writeAudit(admin, "client_access_invite_blocked_by_user_limit", {
        entityId: context.invite.id,
        platformCompanyId: context.invite.platform_company_id,
        metadata: {
          registrationRequestId: context.invite.registration_request_id,
          email: context.invite.email
        }
      });
    }
    throw error;
  }

  const existingUser = await findAuthUserByEmail(admin, context.invite.email);
  if (existingUser) {
    const { data: profile } = await admin.from("profiles").select("company_id,active").eq("id", existingUser.id).maybeSingle();
    if (profile?.company_id === context.invite.company_id) {
      await admin.from("client_access_invites").update({
        status: "used",
        used_at: new Date().toISOString(),
        used_by: existingUser.id
      }).eq("id", context.invite.id).eq("status", "pending");
      throw new PublicError("user_already_exists", "Este e-mail ja possui acesso ao Podo360. Faca login para continuar.");
    }
    throw new PublicError("email_conflict", "Este e-mail ja esta vinculado a outro cadastro. Entre em contato com o suporte Podo360.");
  }

  const { data: claimedInvite, error: claimError } = await admin
    .from("client_access_invites")
    .update({ status: "processing" })
    .eq("id", context.invite.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (claimError || !claimedInvite) {
    throw new PublicError("invite_processing", "A criacao deste acesso ja esta em andamento. Aguarde alguns instantes.");
  }

  let authUserId: string | null = null;
  try {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: context.invite.email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        company_id: context.invite.company_id,
        role: context.invite.role
      }
    });
    if (createError || !created.user) {
      throw new PublicError("account_creation_failed", "Nao foi possivel criar seu acesso agora. Tente novamente em instantes.", 503);
    }
    authUserId = created.user.id;

    const { error: profileError } = await admin.from("profiles").insert({
      id: authUserId,
      company_id: context.invite.company_id,
      full_name: fullName,
      email: context.invite.email,
      role: context.invite.role,
      active: true
    });
    if (profileError) {
      await admin.auth.admin.deleteUser(authUserId);
      authUserId = null;
      throw new PublicError("profile_creation_failed", "Nao foi possivel concluir seu acesso agora. Tente novamente em instantes.", 503);
    }

    const usedAt = new Date().toISOString();
    const { error: usedError } = await admin.from("client_access_invites").update({
      status: "used",
      used_at: usedAt,
      used_by: authUserId
    }).eq("id", context.invite.id).eq("status", "processing");
    if (usedError) {
      await admin.from("profiles").delete().eq("id", authUserId);
      await admin.auth.admin.deleteUser(authUserId);
      authUserId = null;
      throw new PublicError("invite_completion_failed", "Nao foi possivel concluir seu acesso agora. Tente novamente em instantes.", 503);
    }

    await writeAudit(admin, "client_access_user_created", {
      actorUserId: authUserId,
      entityId: context.invite.id,
      platformCompanyId: context.invite.platform_company_id,
      metadata: {
        registrationRequestId: context.invite.registration_request_id,
        companyId: context.invite.company_id,
        role: context.invite.role,
        email: context.invite.email
      }
    });

    return respond({ created: true });
  } catch (error) {
    if (authUserId) {
      await admin.from("profiles").delete().eq("id", authUserId);
      await admin.auth.admin.deleteUser(authUserId);
    }
    await admin.from("client_access_invites").update({ status: "pending" }).eq("id", context.invite.id).eq("status", "processing");
    throw error;
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return respond({ code: "method_not_allowed", message: "Metodo nao permitido." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) return respond({ code: "service_unavailable", message: "Servico indisponivel." }, 503);
  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    const body = await request.json() as Record<string, unknown>;
    switch (body.action) {
      case "generate":
      case "resend":
        return await generateInvite(admin, request.headers.get("Authorization"), body.requestId);
      case "cancel":
        return await cancelInvite(admin, request.headers.get("Authorization"), body.inviteId);
      case "validate":
        return await validateInvite(admin, body.token);
      case "complete":
        return await completeInvite(admin, body);
      default:
        throw new PublicError("invalid_action", "Acao invalida.");
    }
  } catch (error) {
    const publicError = error instanceof PublicError
      ? error
      : new PublicError("unexpected_error", "Nao foi possivel concluir esta acao. Tente novamente.", 500);
    return respond({ code: publicError.code, message: publicError.message }, publicError.status);
  }
});
