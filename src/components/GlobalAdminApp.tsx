import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  CreditCard,
  FileClock,
  Layers3,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Search,
  Settings,
  ShieldCheck,
  UserCog,
  Users
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import {
  loadGlobalAdminSnapshot,
  savePlatformAnnouncement,
  savePlatformPlan,
  updateLeadStatus,
  updatePlatformAdminUser,
  updatePlatformCompanyStatus,
  type GlobalAdminSnapshot,
  type PlatformAdminRole,
  type PlatformAdminUser,
  type PlatformAnnouncement,
  type PlatformCompany,
  type PlatformLead,
  type PlatformPlan
} from "../services/globalAdminService";
import { SUPPORT_WHATSAPP_NUMBER, SUPPORT_WHATSAPP_URL, SUPREME_TECH_SITE_URL } from "../config/support";

type AdminRoute = "dashboard" | "empresas" | "planos" | "assinaturas" | "leads" | "usuarios" | "avisos" | "auditoria" | "configuracoes";
type AdminStatus = "checking" | "login" | "authorized" | "denied";
type AdminNotice = { title: string; message: string; tone: "success" | "info" | "warning" | "danger" };

const ADMIN_DENIED_MESSAGE = "Seu usuario nao possui permissao para acessar o Admin Global Podo360.";
const ADMIN_INACTIVE_MESSAGE = "Seu acesso administrativo esta inativo. Entre em contato com o responsavel pela plataforma.";
const ADMIN_CONNECTION_UNAVAILABLE_MESSAGE = "Nao foi possivel carregar o painel administrativo. Tente atualizar a pagina ou entre em contato com o suporte.";
const ADMIN_AUTH_UNAVAILABLE_MESSAGE = "Nao foi possivel conectar ao servico no momento. Tente novamente em instantes ou entre em contato com o suporte.";
const platformAdminRoles: PlatformAdminRole[] = ["owner", "admin", "support", "commercial"];

const adminRoutes: Array<{ key: AdminRoute; label: string; icon: typeof LayoutDashboard }> = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "empresas", label: "Empresas", icon: Building2 },
  { key: "planos", label: "Planos", icon: Layers3 },
  { key: "assinaturas", label: "Assinaturas", icon: CreditCard },
  { key: "leads", label: "Leads", icon: Users },
  { key: "usuarios", label: "Usuarios Admin", icon: UserCog },
  { key: "avisos", label: "Avisos Globais", icon: Megaphone },
  { key: "auditoria", label: "Auditoria", icon: FileClock },
  { key: "configuracoes", label: "Configuracoes", icon: Settings }
];

function routeFromPath(): AdminRoute {
  const segment = window.location.pathname.split("/").filter(Boolean)[1] ?? "dashboard";
  if (segment === "admin" || segment === "login" || segment === "setup") return "dashboard";
  return adminRoutes.some((route) => route.key === segment) ? segment as AdminRoute : "dashboard";
}

function formatMoney(value?: number | null) {
  if (value == null) return "Sob consulta";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: value.includes("T") ? "short" : undefined }).format(new Date(value));
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    active: "Ativo",
    trial: "Trial",
    inactive: "Inativo",
    suspended: "Suspenso",
    cancelled: "Cancelado",
    past_due: "Em atraso",
    new: "Novo",
    contacted: "Contactado",
    qualified: "Qualificado",
    converted: "Convertido",
    lost: "Perdido",
    spam: "Spam"
  };
  return labels[status] ?? status;
}

function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="admin-empty-state">
      <ShieldCheck size={26} />
      <strong>{title}</strong>
      {children && <span>{children}</span>}
    </div>
  );
}

function AdminMetric({ label, value, detail, icon: Icon }: { label: string; value: string | number; detail: string; icon: typeof LayoutDashboard }) {
  return (
    <article className="admin-metric-card">
      <span><Icon size={20} /></span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <em>{detail}</em>
      </div>
    </article>
  );
}

function AdminLogin({ message, onSuccess }: { message?: string; onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(message || "Use seu usuario administrativo Podo360.");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) {
      setFeedback("Informe seu e-mail administrativo.");
      return;
    }
    if (!password) {
      setFeedback("Informe sua senha.");
      return;
    }
    if (!isSupabaseConfigured || !supabase) {
      setFeedback(import.meta.env.DEV ? "Ambiente de autenticacao nao configurado. Verifique VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY." : ADMIN_AUTH_UNAVAILABLE_MESSAGE);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error || !data.session || !data.user) {
        setFeedback("E-mail ou senha invalidos.");
        return;
      }
      onSuccess();
    } catch {
      setFeedback(ADMIN_AUTH_UNAVAILABLE_MESSAGE);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="global-admin-login">
      <section className="global-admin-login__panel">
        <span className="admin-brand"><ShieldCheck size={22} /> Podo360 Admin Global</span>
        <h1>Gestao segura da plataforma.</h1>
        <p>Empresas, planos, assinaturas, avisos e auditoria em um ambiente separado do sistema clinico.</p>
      </section>
      <form className="global-admin-login__card" onSubmit={submit} noValidate>
        <span className="login-card__eyebrow"><ShieldCheck size={15} /> Acesso administrativo</span>
        <h2>Entrar no Admin Global</h2>
        <p>Somente usuarios cadastrados em `platform_admin_users` podem acessar.</p>
        <div className="login-feedback login-feedback--info" role="status">{feedback}</div>
        <label>E-mail<input autoComplete="email" onChange={(event) => setEmail(event.target.value)} type="email" value={email} /></label>
        <label>Senha<input autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} type="password" value={password} /></label>
        <button className="primary-button" disabled={loading} type="submit">{loading ? "Validando..." : "Entrar"}</button>
      </form>
    </main>
  );
}

export function GlobalAdminApp() {
  const [route, setRoute] = useState<AdminRoute>(routeFromPath);
  const [status, setStatus] = useState<AdminStatus>("checking");
  const [message, setMessage] = useState("Validando acesso administrativo...");
  const [snapshot, setSnapshot] = useState<GlobalAdminSnapshot | null>(null);
  const [notice, setNotice] = useState<AdminNotice | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setStatus("login");
      setMessage(import.meta.env.DEV ? "Ambiente de autenticacao nao configurado. Verifique VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY." : ADMIN_CONNECTION_UNAVAILABLE_MESSAGE);
      return;
    }
    setStatus("checking");
    setMessage("Validando acesso administrativo...");
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) {
      setSnapshot(null);
      setStatus("login");
      setMessage("");
      return;
    }
    try {
      const nextSnapshot = await loadGlobalAdminSnapshot();
      if (!nextSnapshot.admin.active) {
        await supabase.auth.signOut();
        setStatus("denied");
        setMessage(ADMIN_INACTIVE_MESSAGE);
        return;
      }
      setSnapshot(nextSnapshot);
      setStatus("authorized");
      setMessage("");
    } catch (error) {
      await supabase.auth.signOut();
      setSnapshot(null);
      setStatus("denied");
      setMessage(error instanceof Error && error.message === "platform_admin_inactive" ? ADMIN_INACTIVE_MESSAGE : ADMIN_DENIED_MESSAGE);
    }
  }, []);

  useEffect(() => {
    void load();
    if (!supabase) return undefined;
    const { data } = supabase.auth.onAuthStateChange(() => void load());
    return () => data.subscription.unsubscribe();
  }, [load]);

  useEffect(() => {
    const onPopState = () => setRoute(routeFromPath());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function navigate(nextRoute: AdminRoute) {
    const path = nextRoute === "dashboard" ? "/admin" : `/admin/${nextRoute}`;
    window.history.pushState({}, "", path);
    setRoute(nextRoute);
    setQuery("");
  }

  async function logout() {
    await supabase?.auth.signOut();
    setSnapshot(null);
    setStatus("login");
    window.history.pushState({}, "", "/admin/login");
  }

  function notify(title: string, message: string, tone: AdminNotice["tone"] = "success") {
    setNotice({ title, message, tone });
    window.setTimeout(() => setNotice(null), 4500);
  }

  if (status === "checking") {
    return <main className="admin-loading"><ShieldCheck size={26} /><strong>{message}</strong></main>;
  }

  if (status === "login" || (status !== "authorized" && window.location.pathname.includes("/admin/login"))) {
    return <AdminLogin message={message} onSuccess={() => { window.history.pushState({}, "", "/admin"); setRoute("dashboard"); void load(); }} />;
  }

  if (status === "denied") {
    return (
      <main className="admin-loading admin-loading--denied">
        <AlertTriangle size={28} />
        <strong>Acesso negado</strong>
        <p>{message}</p>
        <button className="primary-button" onClick={() => { setStatus("login"); window.history.pushState({}, "", "/admin/login"); }} type="button">Voltar ao login</button>
      </main>
    );
  }

  if (!snapshot) return null;

  return (
    <main className="global-admin-shell">
      <aside className="global-admin-sidebar">
        <div className="admin-brand"><ShieldCheck size={21} /> <span>Podo360 Admin</span></div>
        <nav aria-label="Admin Global">
          {adminRoutes.map(({ key, label, icon: Icon }) => (
            <button className={route === key ? "active" : ""} key={key} onClick={() => navigate(key)} type="button">
              <Icon size={17} /> {label}
            </button>
          ))}
        </nav>
      </aside>
      <section className="global-admin-main">
        <header className="global-admin-topbar">
          <div>
            <span className="eyebrow">Admin Global Podo360</span>
            <h1>{adminRoutes.find((item) => item.key === route)?.label ?? "Dashboard"}</h1>
          </div>
          <div className="global-admin-topbar__actions">
            <span>{snapshot.admin.email || "Admin"} · {snapshot.admin.role}</span>
            <button className="ghost-action" onClick={logout} type="button"><LogOut size={16} /> Sair</button>
          </div>
        </header>
        {notice && <div className={`admin-notice admin-notice--${notice.tone}`}><strong>{notice.title}</strong><span>{notice.message}</span></div>}
        <AdminRouteContent query={query} route={route} setQuery={setQuery} snapshot={snapshot} onReload={load} onNotify={notify} />
      </section>
    </main>
  );
}

function AdminRouteContent({ route, snapshot, query, setQuery, onReload, onNotify }: { route: AdminRoute; snapshot: GlobalAdminSnapshot; query: string; setQuery: (value: string) => void; onReload: () => Promise<void>; onNotify: (title: string, message: string, tone?: AdminNotice["tone"]) => void }) {
  if (route === "dashboard") return <AdminDashboard snapshot={snapshot} />;
  if (route === "empresas") return <AdminCompanies query={query} setQuery={setQuery} snapshot={snapshot} onReload={onReload} onNotify={onNotify} />;
  if (route === "planos") return <AdminPlans snapshot={snapshot} onReload={onReload} onNotify={onNotify} />;
  if (route === "assinaturas") return <AdminSubscriptions query={query} setQuery={setQuery} snapshot={snapshot} />;
  if (route === "leads") return <AdminLeads query={query} setQuery={setQuery} snapshot={snapshot} onReload={onReload} onNotify={onNotify} />;
  if (route === "usuarios") return <AdminUsers snapshot={snapshot} onReload={onReload} onNotify={onNotify} />;
  if (route === "avisos") return <AdminAnnouncements snapshot={snapshot} onReload={onReload} onNotify={onNotify} />;
  if (route === "auditoria") return <AdminAudit query={query} setQuery={setQuery} snapshot={snapshot} />;
  return <AdminSettings />;
}

function AdminDashboard({ snapshot }: { snapshot: GlobalAdminSnapshot }) {
  const activeAnnouncements = snapshot.announcements.filter((item) => item.active).length;
  return (
    <div className="admin-page-stack">
      <div className="admin-metrics-grid">
        <AdminMetric icon={Building2} label="Total de empresas" value={snapshot.companies.length} detail="Base real Supabase" />
        <AdminMetric icon={CheckCircle2} label="Empresas ativas" value={snapshot.companies.filter((item) => item.status === "active").length} detail="Com acesso liberado" />
        <AdminMetric icon={AlertTriangle} label="Suspensas" value={snapshot.companies.filter((item) => item.status === "suspended").length} detail="Bloqueadas na clinica" />
        <AdminMetric icon={Users} label="Leads" value={snapshot.leads.length} detail="Pipeline comercial" />
        <AdminMetric icon={Layers3} label="Planos ativos" value={snapshot.plans.filter((item) => item.active).length} detail="Catalogo comercial" />
        <AdminMetric icon={CreditCard} label="Assinaturas ativas" value={snapshot.subscriptions.filter((item) => item.status === "active").length} detail="Contratos vigentes" />
        <AdminMetric icon={Megaphone} label="Avisos ativos" value={activeAnnouncements} detail="Visiveis conforme periodo" />
        <AdminMetric icon={FileClock} label="Auditoria" value={snapshot.auditLogs.length} detail="Ultimos eventos" />
      </div>
    </div>
  );
}

function AdminToolbar({ query, setQuery, placeholder }: { query: string; setQuery: (value: string) => void; placeholder: string }) {
  return (
    <div className="admin-toolbar">
      <span><Search size={16} /><input onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} value={query} /></span>
    </div>
  );
}

function AdminCompanies({ snapshot, query, setQuery, onReload, onNotify }: { snapshot: GlobalAdminSnapshot; query: string; setQuery: (value: string) => void; onReload: () => Promise<void>; onNotify: (title: string, message: string, tone?: AdminNotice["tone"]) => void }) {
  const [reasonById, setReasonById] = useState<Record<string, string>>({});
  const plansById = new Map(snapshot.plans.map((plan) => [plan.id, plan]));
  const companies = snapshot.companies.filter((item) => `${item.companyName} ${item.responsibleEmail ?? ""} ${item.status}`.toLowerCase().includes(query.toLowerCase()));

  async function changeStatus(company: PlatformCompany, status: PlatformCompany["status"]) {
    const reason = reasonById[company.id] || `Alteracao administrativa para ${statusLabel(status)}`;
    await updatePlatformCompanyStatus(company, status, reason);
    onNotify("Status atualizado", `${company.companyName} agora esta ${statusLabel(status)}.`, "success");
    await onReload();
  }

  return (
    <div className="admin-page-stack">
      <AdminToolbar query={query} setQuery={setQuery} placeholder="Buscar empresa, responsavel ou status" />
      {!companies.length ? <EmptyState title="Nenhuma empresa cadastrada ainda." /> : (
        <div className="admin-card-grid">
          {companies.map((company) => (
            <article className="admin-data-card" key={company.id}>
              <header><strong>{company.companyName}</strong><span className={`status-pill status-pill--${company.status}`}>{statusLabel(company.status)}</span></header>
              <p>{company.responsibleName || "Responsavel nao informado"} · {company.responsibleEmail || "sem e-mail"}</p>
              <dl>
                <div><dt>company_id</dt><dd>{company.clinicCompanyId || "-"}</dd></div>
                <div><dt>Plano</dt><dd>{company.planId ? plansById.get(company.planId)?.name ?? "Plano removido" : "Sem plano"}</dd></div>
                <div><dt>CNPJ</dt><dd>{company.cnpj || "-"}</dd></div>
              </dl>
              <label>Motivo da alteracao<input onChange={(event) => setReasonById((current) => ({ ...current, [company.id]: event.target.value }))} placeholder="Ex.: inadimplencia, reativacao comercial..." value={reasonById[company.id] ?? ""} /></label>
              <div className="admin-inline-actions">
                {(["active", "trial", "inactive", "suspended", "cancelled"] as const).map((status) => (
                  <button className={company.status === status ? "primary-button" : "ghost-action"} disabled={company.status === status} key={status} onClick={() => void changeStatus(company, status)} type="button">{statusLabel(status)}</button>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminPlans({ snapshot, onReload, onNotify }: { snapshot: GlobalAdminSnapshot; onReload: () => Promise<void>; onNotify: (title: string, message: string, tone?: AdminNotice["tone"]) => void }) {
  const [editing, setEditing] = useState<PlatformPlan | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const slug = String(form.get("slug") || "").trim().toLowerCase();
    if (!name || !slug) return;
    await savePlatformPlan({
      id: editing?.id,
      name,
      slug,
      description: String(form.get("description") || ""),
      monthlyPrice: Number(form.get("monthlyPrice") || 0) || null,
      setupFee: Number(form.get("setupFee") || 0) || null,
      isCustomPrice: form.get("isCustomPrice") === "on",
      active: form.get("active") === "on",
      displayOrder: Number(form.get("displayOrder") || 0)
    });
    setEditing(null);
    onNotify("Plano salvo", "Catalogo comercial atualizado.", "success");
    await onReload();
  }

  return (
    <div className="admin-page-stack">
      <form className="admin-editor-card" onSubmit={submit}>
        <h2>{editing ? "Editar plano" : "Criar plano"}</h2>
        <div className="form-grid form-grid--three">
          <label>Nome<input defaultValue={editing?.name ?? ""} name="name" required /></label>
          <label>Slug<input defaultValue={editing?.slug ?? ""} name="slug" required /></label>
          <label>Ordem<input defaultValue={editing?.displayOrder ?? 0} name="displayOrder" type="number" /></label>
          <label>Mensalidade<input defaultValue={editing?.monthlyPrice ?? ""} name="monthlyPrice" step="0.01" type="number" /></label>
          <label>Setup<input defaultValue={editing?.setupFee ?? ""} name="setupFee" step="0.01" type="number" /></label>
          <label className="toggle-row"><input defaultChecked={editing?.active ?? true} name="active" type="checkbox" /> Ativo</label>
          <label className="toggle-row"><input defaultChecked={editing?.isCustomPrice ?? false} name="isCustomPrice" type="checkbox" /> Sob consulta / a partir de</label>
        </div>
        <label>Descricao<textarea defaultValue={editing?.description ?? ""} name="description" /></label>
        <div className="dialog-card__actions"><button className="primary-button" type="submit">Salvar plano</button>{editing && <button className="ghost-action" onClick={() => setEditing(null)} type="button">Cancelar edicao</button>}</div>
      </form>
      {!snapshot.plans.length ? <EmptyState title="Nenhum plano ativo cadastrado." /> : (
        <div className="admin-table-wrap"><table><thead><tr><th>Plano</th><th>Mensalidade</th><th>Setup</th><th>Status</th><th /></tr></thead><tbody>{snapshot.plans.map((plan) => <tr key={plan.id}><td><strong>{plan.name}</strong><small>{plan.slug}</small></td><td>{formatMoney(plan.monthlyPrice)}</td><td>{formatMoney(plan.setupFee)}</td><td>{plan.active ? "Ativo" : "Inativo"}</td><td><button className="ghost-action" onClick={() => setEditing(plan)} type="button">Editar</button></td></tr>)}</tbody></table></div>
      )}
    </div>
  );
}

function AdminSubscriptions({ snapshot, query, setQuery }: { snapshot: GlobalAdminSnapshot; query: string; setQuery: (value: string) => void }) {
  const companiesById = new Map(snapshot.companies.map((company) => [company.id, company]));
  const plansById = new Map(snapshot.plans.map((plan) => [plan.id, plan]));
  const subscriptions = snapshot.subscriptions.filter((item) => `${companiesById.get(item.companyId)?.companyName ?? ""} ${item.status}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="admin-page-stack">
      <AdminToolbar query={query} setQuery={setQuery} placeholder="Buscar assinatura por empresa ou status" />
      {!subscriptions.length ? <EmptyState title="Nenhuma assinatura encontrada." /> : (
        <div className="admin-table-wrap"><table><thead><tr><th>Empresa</th><th>Plano</th><th>Status</th><th>Mensal</th><th>Renova</th><th>Observacoes</th></tr></thead><tbody>{subscriptions.map((item) => <tr key={item.id}><td>{companiesById.get(item.companyId)?.companyName ?? item.companyId}</td><td>{item.planId ? plansById.get(item.planId)?.name ?? "-" : "-"}</td><td>{statusLabel(item.status)}</td><td>{formatMoney(item.monthlyPrice)}</td><td>{formatDate(item.renewsAt)}</td><td>{item.notes || "-"}</td></tr>)}</tbody></table></div>
      )}
    </div>
  );
}

function AdminLeads({ snapshot, query, setQuery, onReload, onNotify }: { snapshot: GlobalAdminSnapshot; query: string; setQuery: (value: string) => void; onReload: () => Promise<void>; onNotify: (title: string, message: string, tone?: AdminNotice["tone"]) => void }) {
  const leads = snapshot.leads.filter((lead) => `${lead.name} ${lead.clinicName ?? ""} ${lead.email ?? ""} ${lead.status}`.toLowerCase().includes(query.toLowerCase()));
  async function changeStatus(lead: PlatformLead, status: string) {
    await updateLeadStatus(lead, status);
    onNotify("Lead atualizado", `${lead.name} agora esta como ${statusLabel(status)}.`, "success");
    await onReload();
  }
  return (
    <div className="admin-page-stack">
      <AdminToolbar query={query} setQuery={setQuery} placeholder="Buscar lead, clinica, e-mail ou status" />
      {!leads.length ? <EmptyState title="Nenhum lead encontrado." /> : (
        <div className="admin-card-grid">{leads.map((lead) => <article className="admin-data-card" key={lead.id}><header><strong>{lead.name}</strong><span className="status-pill">{statusLabel(lead.status)}</span></header><p>{lead.clinicName || "Clinica nao informada"} · {lead.email || "sem e-mail"} · {lead.phone || "sem telefone"}</p><small>{lead.message || "Sem mensagem"}</small><div className="admin-inline-actions">{["new", "contacted", "qualified", "converted", "lost", "spam"].map((status) => <button className={lead.status === status ? "primary-button" : "ghost-action"} disabled={lead.status === status} key={status} onClick={() => void changeStatus(lead, status)} type="button">{statusLabel(status)}</button>)}</div></article>)}</div>
      )}
    </div>
  );
}

function AdminUsers({ snapshot, onReload, onNotify }: { snapshot: GlobalAdminSnapshot; onReload: () => Promise<void>; onNotify: (title: string, message: string, tone?: AdminNotice["tone"]) => void }) {
  async function update(user: PlatformAdminUser, role: PlatformAdminRole, active: boolean) {
    await updatePlatformAdminUser(user, { role, active });
    onNotify("Usuario admin atualizado", "Permissao administrativa atualizada com auditoria.", "success");
    await onReload();
  }
  return (
    <div className="admin-page-stack">
      <div className="inline-info"><ShieldCheck size={18} /> Novos admins globais devem ser criados por convite/painel seguro do Supabase Auth ou Edge Function administrativa. Nenhuma senha e criada no frontend.</div>
      {!snapshot.adminUsers.length ? <EmptyState title="Nenhum admin global encontrado." /> : (
        <div className="admin-table-wrap"><table><thead><tr><th>Usuario</th><th>Role</th><th>Status</th><th>Acoes</th></tr></thead><tbody>{snapshot.adminUsers.map((user) => <tr key={user.id}><td><strong>{user.fullName || user.email || user.userId}</strong><small>{user.email || user.userId}</small></td><td><select defaultValue={user.role} onChange={(event) => void update(user, event.target.value as PlatformAdminRole, user.active)}>{platformAdminRoles.map((role) => <option key={role} value={role}>{role}</option>)}</select></td><td>{user.active ? "Ativo" : "Inativo"}</td><td><button className={user.active ? "danger-button" : "primary-button"} onClick={() => void update(user, user.role, !user.active)} type="button">{user.active ? "Inativar" : "Ativar"}</button></td></tr>)}</tbody></table></div>
      )}
    </div>
  );
}

function AdminAnnouncements({ snapshot, onReload, onNotify }: { snapshot: GlobalAdminSnapshot; onReload: () => Promise<void>; onNotify: (title: string, message: string, tone?: AdminNotice["tone"]) => void }) {
  const [editing, setEditing] = useState<PlatformAnnouncement | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const message = String(form.get("message") || "").trim();
    if (!message) return;
    await savePlatformAnnouncement({
      id: editing?.id,
      title: String(form.get("title") || ""),
      message,
      severity: String(form.get("severity") || "info") as PlatformAnnouncement["severity"],
      active: form.get("active") === "on",
      dismissible: form.get("dismissible") === "on",
      targetScope: "all",
      startsAt: String(form.get("startsAt") || ""),
      endsAt: String(form.get("endsAt") || "")
    });
    setEditing(null);
    onNotify("Aviso salvo", "Aviso global atualizado para consumo do sistema clinico.", "success");
    await onReload();
  }
  return (
    <div className="admin-page-stack">
      <form className="admin-editor-card" onSubmit={submit}>
        <h2>{editing ? "Editar aviso global" : "Criar aviso global"}</h2>
        <div className="form-grid form-grid--two">
          <label>Titulo<input defaultValue={editing?.title ?? ""} name="title" /></label>
          <label>Severidade<select defaultValue={editing?.severity ?? "info"} name="severity"><option value="info">Info</option><option value="warning">Alerta</option><option value="maintenance">Manutencao</option><option value="critical">Critico</option></select></label>
          <label>Inicio<input defaultValue={editing?.startsAt?.slice(0, 16) ?? ""} name="startsAt" type="datetime-local" /></label>
          <label>Fim<input defaultValue={editing?.endsAt?.slice(0, 16) ?? ""} name="endsAt" type="datetime-local" /></label>
          <label className="toggle-row"><input defaultChecked={editing?.active ?? false} name="active" type="checkbox" /> Ativo</label>
          <label className="toggle-row"><input defaultChecked={editing?.dismissible ?? false} name="dismissible" type="checkbox" /> Fechavel</label>
        </div>
        <label>Mensagem<textarea defaultValue={editing?.message ?? ""} name="message" required /></label>
        <div className="dialog-card__actions"><button className="primary-button" type="submit">Salvar aviso</button>{editing && <button className="ghost-action" onClick={() => setEditing(null)} type="button">Cancelar edicao</button>}</div>
      </form>
      {!snapshot.announcements.length ? <EmptyState title="Nenhum aviso global criado." /> : (
        <div className="admin-card-grid">{snapshot.announcements.map((item) => <article className="admin-data-card" key={item.id}><header><strong>{item.title || "Aviso sem titulo"}</strong><span className={`status-pill status-pill--${item.active ? "active" : "inactive"}`}>{item.active ? "Ativo" : "Inativo"}</span></header><p>{item.message}</p><small>{item.severity} · {formatDate(item.startsAt)} ate {formatDate(item.endsAt)}</small><button className="ghost-action" onClick={() => setEditing(item)} type="button">Editar</button></article>)}</div>
      )}
    </div>
  );
}

function AdminAudit({ snapshot, query, setQuery }: { snapshot: GlobalAdminSnapshot; query: string; setQuery: (value: string) => void }) {
  const logs = snapshot.auditLogs.filter((log) => `${log.action} ${log.entityType} ${JSON.stringify(log.metadata)}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="admin-page-stack">
      <AdminToolbar query={query} setQuery={setQuery} placeholder="Filtrar por acao, entidade ou detalhes" />
      {!logs.length ? <EmptyState title="Nenhum log de auditoria encontrado." /> : (
        <div className="admin-table-wrap"><table><thead><tr><th>Data</th><th>Acao</th><th>Entidade</th><th>Detalhes</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id}><td>{formatDate(log.createdAt)}</td><td>{log.action}</td><td>{log.entityType}</td><td><code>{JSON.stringify(log.metadata)}</code></td></tr>)}</tbody></table></div>
      )}
    </div>
  );
}

function AdminSettings() {
  return (
    <div className="admin-page-stack">
      <section className="admin-editor-card">
        <h2>Configuracoes da plataforma</h2>
        <div className="definition-grid definition-grid--three">
          <div><span>Nome</span><strong>Podo360</strong></div>
          <div><span>Site oficial</span><strong>{SUPREME_TECH_SITE_URL}</strong></div>
          <div><span>WhatsApp suporte</span><strong>{SUPPORT_WHATSAPP_NUMBER}</strong></div>
        </div>
        <p>Configuracoes globais editaveis devem ser persistidas em tabela propria antes de expor alteracao no painel. Esta tela nao usa mock: mostra apenas a configuracao versionada atualmente consumida pelo sistema.</p>
        <a className="primary-button" href={SUPPORT_WHATSAPP_URL} rel="noreferrer" target="_blank">Testar suporte</a>
      </section>
    </div>
  );
}
