import { isSupabaseConfigured, supabase } from "../lib/supabase";

export type PlatformAdminRole = "owner" | "admin" | "support" | "finance" | "operations" | "commercial";

export type PlatformAdminUser = {
  id: string;
  userId: string;
  role: PlatformAdminRole;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
  email?: string;
  fullName?: string;
};

export type PlatformPlan = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  monthlyPrice?: number | null;
  setupFee?: number | null;
  isCustomPrice: boolean;
  maxUsers?: number | null;
  maxProfessionals?: number | null;
  maxPatients?: number | null;
  maxStorageMb?: number | null;
  features: Record<string, unknown>;
  active: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt?: string;
};

export type PlatformCompany = {
  id: string;
  clinicCompanyId?: string | null;
  companyName: string;
  tradingName?: string | null;
  cnpj?: string | null;
  responsibleName?: string | null;
  responsibleEmail?: string | null;
  responsiblePhone?: string | null;
  status: "active" | "trial" | "inactive" | "suspended" | "cancelled";
  planId?: string | null;
  createdAt: string;
  updatedAt?: string;
  activatedAt?: string | null;
  suspendedAt?: string | null;
  cancelledAt?: string | null;
};

export type PlatformSubscription = {
  id: string;
  companyId: string;
  planId?: string | null;
  status: "trial" | "active" | "past_due" | "suspended" | "cancelled";
  monthlyPrice?: number | null;
  setupFee?: number | null;
  startsAt?: string | null;
  trialEndsAt?: string | null;
  renewsAt?: string | null;
  cancelledAt?: string | null;
  contractMinMonths: number;
  notes?: string | null;
  createdAt: string;
  updatedAt?: string;
};

export type PlatformLead = {
  id: string;
  name: string;
  clinicName?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  source?: string | null;
  message?: string | null;
  status: string;
  createdAt: string;
  updatedAt?: string;
};

export type PlatformFeature = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  active: boolean;
};

export type PlatformAnnouncement = {
  id: string;
  title?: string | null;
  message: string;
  severity: "info" | "warning" | "maintenance" | "critical";
  active: boolean;
  dismissible: boolean;
  targetScope: "all" | "specific_companies";
  startsAt?: string | null;
  endsAt?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt?: string;
};

export type PlatformAuditLog = {
  id: string;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  companyId?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type GlobalAdminSnapshot = {
  admin: PlatformAdminUser;
  companies: PlatformCompany[];
  plans: PlatformPlan[];
  subscriptions: PlatformSubscription[];
  leads: PlatformLead[];
  features: PlatformFeature[];
  announcements: PlatformAnnouncement[];
  auditLogs: PlatformAuditLog[];
  adminUsers: PlatformAdminUser[];
};

function assertSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("supabase_not_configured");
  }
  return supabase;
}

function mapAdminUser(row: Record<string, unknown>): PlatformAdminUser {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    role: String(row.role) as PlatformAdminRole,
    active: Boolean(row.active),
    createdAt: String(row.created_at),
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
    email: typeof row.email === "string" ? row.email : undefined,
    fullName: typeof row.full_name === "string" ? row.full_name : undefined
  };
}

function mapPlan(row: Record<string, unknown>): PlatformPlan {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    description: row.description ? String(row.description) : undefined,
    monthlyPrice: row.monthly_price == null ? null : Number(row.monthly_price),
    setupFee: row.setup_fee == null ? null : Number(row.setup_fee),
    isCustomPrice: Boolean(row.is_custom_price),
    maxUsers: row.max_users == null ? null : Number(row.max_users),
    maxProfessionals: row.max_professionals == null ? null : Number(row.max_professionals),
    maxPatients: row.max_patients == null ? null : Number(row.max_patients),
    maxStorageMb: row.max_storage_mb == null ? null : Number(row.max_storage_mb),
    features: typeof row.features === "object" && row.features ? row.features as Record<string, unknown> : {},
    active: Boolean(row.active),
    displayOrder: Number(row.display_order ?? 0),
    createdAt: String(row.created_at),
    updatedAt: row.updated_at ? String(row.updated_at) : undefined
  };
}

function mapCompany(row: Record<string, unknown>): PlatformCompany {
  return {
    id: String(row.id),
    clinicCompanyId: row.clinic_company_id ? String(row.clinic_company_id) : null,
    companyName: String(row.company_name),
    tradingName: row.trading_name ? String(row.trading_name) : null,
    cnpj: row.cnpj ? String(row.cnpj) : null,
    responsibleName: row.responsible_name ? String(row.responsible_name) : null,
    responsibleEmail: row.responsible_email ? String(row.responsible_email) : null,
    responsiblePhone: row.responsible_phone ? String(row.responsible_phone) : null,
    status: String(row.status) as PlatformCompany["status"],
    planId: row.plan_id ? String(row.plan_id) : null,
    createdAt: String(row.created_at),
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
    activatedAt: row.activated_at ? String(row.activated_at) : null,
    suspendedAt: row.suspended_at ? String(row.suspended_at) : null,
    cancelledAt: row.cancelled_at ? String(row.cancelled_at) : null
  };
}

function mapSubscription(row: Record<string, unknown>): PlatformSubscription {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    planId: row.plan_id ? String(row.plan_id) : null,
    status: String(row.status) as PlatformSubscription["status"],
    monthlyPrice: row.monthly_price == null ? null : Number(row.monthly_price),
    setupFee: row.setup_fee == null ? null : Number(row.setup_fee),
    startsAt: row.starts_at ? String(row.starts_at) : null,
    trialEndsAt: row.trial_ends_at ? String(row.trial_ends_at) : null,
    renewsAt: row.renews_at ? String(row.renews_at) : null,
    cancelledAt: row.cancelled_at ? String(row.cancelled_at) : null,
    contractMinMonths: Number(row.contract_min_months ?? 3),
    notes: row.notes ? String(row.notes) : null,
    createdAt: String(row.created_at),
    updatedAt: row.updated_at ? String(row.updated_at) : undefined
  };
}

function mapLead(row: Record<string, unknown>): PlatformLead {
  return {
    id: String(row.id),
    name: String(row.name),
    clinicName: row.clinic_name ? String(row.clinic_name) : null,
    email: row.email ? String(row.email) : null,
    phone: row.phone ? String(row.phone) : null,
    city: row.city ? String(row.city) : null,
    source: row.source ? String(row.source) : null,
    message: row.message ? String(row.message) : null,
    status: String(row.status),
    createdAt: String(row.created_at),
    updatedAt: row.updated_at ? String(row.updated_at) : undefined
  };
}

function mapFeature(row: Record<string, unknown>): PlatformFeature {
  return {
    id: String(row.id),
    key: String(row.key),
    name: String(row.name),
    description: row.description ? String(row.description) : null,
    active: Boolean(row.active)
  };
}

function mapAnnouncement(row: Record<string, unknown>): PlatformAnnouncement {
  return {
    id: String(row.id),
    title: row.title ? String(row.title) : null,
    message: String(row.message),
    severity: String(row.severity) as PlatformAnnouncement["severity"],
    active: Boolean(row.active),
    dismissible: Boolean(row.dismissible),
    targetScope: String(row.target_scope) as PlatformAnnouncement["targetScope"],
    startsAt: row.starts_at ? String(row.starts_at) : null,
    endsAt: row.ends_at ? String(row.ends_at) : null,
    createdBy: row.created_by ? String(row.created_by) : null,
    createdAt: String(row.created_at),
    updatedAt: row.updated_at ? String(row.updated_at) : undefined
  };
}

function mapAuditLog(row: Record<string, unknown>): PlatformAuditLog {
  return {
    id: String(row.id),
    actorUserId: row.actor_user_id ? String(row.actor_user_id) : null,
    action: String(row.action),
    entityType: String(row.entity_type),
    entityId: row.entity_id ? String(row.entity_id) : null,
    companyId: row.company_id ? String(row.company_id) : null,
    metadata: typeof row.metadata === "object" && row.metadata ? row.metadata as Record<string, unknown> : {},
    createdAt: String(row.created_at)
  };
}

export async function getCurrentPlatformAdmin() {
  const client = assertSupabase();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  const user = sessionData.session?.user;
  if (sessionError || !user) return null;

  const { data, error } = await client
    .from("platform_admin_users")
    .select("id,user_id,role,active,created_at,updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return mapAdminUser({ ...data, email: user.email ?? "" });
}

export async function loadGlobalAdminSnapshot(): Promise<GlobalAdminSnapshot> {
  const client = assertSupabase();
  const admin = await getCurrentPlatformAdmin();
  if (!admin) throw new Error("platform_admin_missing");
  if (!admin.active) throw new Error("platform_admin_inactive");

  const [companies, plans, subscriptions, leads, features, announcements, auditLogs, adminUsers, profiles] = await Promise.all([
    client.from("platform_companies").select("*").order("created_at", { ascending: false }),
    client.from("platform_plans").select("*").order("display_order", { ascending: true }),
    client.from("platform_company_subscriptions").select("*").order("created_at", { ascending: false }),
    client.from("platform_leads").select("*").order("created_at", { ascending: false }),
    client.from("platform_features").select("*").order("key", { ascending: true }),
    client.from("platform_announcements").select("*").order("created_at", { ascending: false }),
    client.from("platform_admin_audit_logs").select("*").order("created_at", { ascending: false }).limit(100),
    client.from("platform_admin_users").select("*").order("created_at", { ascending: false }),
    client.from("profiles").select("id,full_name,email")
  ]);

  for (const result of [companies, plans, subscriptions, leads, features, announcements, auditLogs, adminUsers, profiles]) {
    if (result.error) throw result.error;
  }

  const profileById = new Map((profiles.data ?? []).map((profile) => [profile.id, profile]));
  return {
    admin,
    companies: (companies.data ?? []).map((row) => mapCompany(row)),
    plans: (plans.data ?? []).map((row) => mapPlan(row)),
    subscriptions: (subscriptions.data ?? []).map((row) => mapSubscription(row)),
    leads: (leads.data ?? []).map((row) => mapLead(row)),
    features: (features.data ?? []).map((row) => mapFeature(row)),
    announcements: (announcements.data ?? []).map((row) => mapAnnouncement(row)),
    auditLogs: (auditLogs.data ?? []).map((row) => mapAuditLog(row)),
    adminUsers: (adminUsers.data ?? []).map((row) => {
      const profile = profileById.get(row.user_id);
      return mapAdminUser({ ...row, email: profile?.email, full_name: profile?.full_name });
    })
  };
}

export async function recordPlatformAudit(input: {
  action: string;
  entityType: string;
  entityId?: string | null;
  companyId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const client = assertSupabase();
  const { data: sessionData } = await client.auth.getSession();
  const { error } = await client.from("platform_admin_audit_logs").insert({
    actor_user_id: sessionData.session?.user.id ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    company_id: input.companyId ?? null,
    metadata: input.metadata ?? {}
  });
  if (error) throw error;
}

export async function updatePlatformCompanyStatus(company: PlatformCompany, nextStatus: PlatformCompany["status"], reason: string) {
  const client = assertSupabase();
  const { data: sessionData } = await client.auth.getSession();
  const timestampColumn =
    nextStatus === "active" ? { activated_at: new Date().toISOString(), suspended_at: null, cancelled_at: null } :
    nextStatus === "suspended" ? { suspended_at: new Date().toISOString() } :
    nextStatus === "cancelled" ? { cancelled_at: new Date().toISOString() } :
    {};

  const { error } = await client
    .from("platform_companies")
    .update({ status: nextStatus, updated_at: new Date().toISOString(), ...timestampColumn })
    .eq("id", company.id);
  if (error) throw error;

  const { error: statusLogError } = await client.from("platform_company_status_logs").insert({
    company_id: company.id,
    previous_status: company.status,
    new_status: nextStatus,
    reason,
    changed_by: sessionData.session?.user.id ?? null
  });
  if (statusLogError) throw statusLogError;

  await recordPlatformAudit({
    action: "company_status_updated",
    entityType: "platform_company",
    entityId: company.id,
    companyId: company.id,
    metadata: { previousStatus: company.status, newStatus: nextStatus, reason }
  });
}

export async function savePlatformPlan(plan: Partial<PlatformPlan> & { name: string; slug: string }) {
  const client = assertSupabase();
  const payload = {
    name: plan.name,
    slug: plan.slug,
    description: plan.description || null,
    monthly_price: plan.monthlyPrice ?? null,
    setup_fee: plan.setupFee ?? null,
    is_custom_price: Boolean(plan.isCustomPrice),
    max_users: plan.maxUsers ?? null,
    max_professionals: plan.maxProfessionals ?? null,
    max_patients: plan.maxPatients ?? null,
    max_storage_mb: plan.maxStorageMb ?? null,
    active: plan.active ?? true,
    display_order: plan.displayOrder ?? 0,
    updated_at: new Date().toISOString()
  };
  const query = plan.id
    ? client.from("platform_plans").update(payload).eq("id", plan.id).select().single()
    : client.from("platform_plans").insert(payload).select().single();
  const { data, error } = await query;
  if (error) throw error;
  await recordPlatformAudit({ action: plan.id ? "plan_updated" : "plan_created", entityType: "platform_plan", entityId: data.id, metadata: { slug: plan.slug } });
  return mapPlan(data);
}

export async function updateLeadStatus(lead: PlatformLead, status: string) {
  const client = assertSupabase();
  const { error } = await client.from("platform_leads").update({ status, updated_at: new Date().toISOString() }).eq("id", lead.id);
  if (error) throw error;
  await recordPlatformAudit({ action: "lead_status_updated", entityType: "platform_lead", entityId: lead.id, metadata: { previousStatus: lead.status, status } });
}

export async function savePlatformAnnouncement(input: Partial<PlatformAnnouncement> & { message: string }) {
  const client = assertSupabase();
  const { data: sessionData } = await client.auth.getSession();
  const payload = {
    title: input.title || null,
    message: input.message,
    severity: input.severity ?? "info",
    active: input.active ?? false,
    dismissible: input.dismissible ?? false,
    target_scope: input.targetScope ?? "all",
    starts_at: input.startsAt || null,
    ends_at: input.endsAt || null,
    created_by: input.createdBy ?? sessionData.session?.user.id ?? null,
    updated_at: new Date().toISOString()
  };
  const query = input.id
    ? client.from("platform_announcements").update(payload).eq("id", input.id).select().single()
    : client.from("platform_announcements").insert(payload).select().single();
  const { data, error } = await query;
  if (error) throw error;
  await recordPlatformAudit({ action: input.id ? "announcement_updated" : "announcement_created", entityType: "platform_announcement", entityId: data.id, metadata: { active: payload.active, severity: payload.severity } });
  return mapAnnouncement(data);
}

export async function updatePlatformAdminUser(user: PlatformAdminUser, updates: Pick<PlatformAdminUser, "role" | "active">) {
  const client = assertSupabase();
  const { error } = await client
    .from("platform_admin_users")
    .update({ role: updates.role, active: updates.active, updated_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) throw error;
  await recordPlatformAudit({ action: "platform_admin_user_updated", entityType: "platform_admin_user", entityId: user.id, metadata: { role: updates.role, active: updates.active } });
}
