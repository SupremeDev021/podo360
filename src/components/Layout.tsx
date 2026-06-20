import {
  Activity,
  Boxes,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardPlus,
  CreditCard,
  FileText,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Stethoscope,
  Users,
  X
} from "lucide-react";
import { useEffect, useState } from "react";
import { SUPPORT_WHATSAPP_URL } from "../config/support";
import type { Company, Profile } from "../types";
import { roleLabel } from "../services/rbac";
import { SystemNoticeBanner } from "./SystemNoticeBanner";

export type ViewKey =
  | "dashboard"
  | "ba-opening"
  | "patients"
  | "patient-profile"
  | "attendances"
  | "attendance-management"
  | "schedule"
  | "financial"
  | "stock"
  | "autoclave"
  | "reports"
  | "hci"
  | "settings"
  | "super-admin"
  | "plans";

type LayoutProps = {
  company: Company;
  profile: Profile;
  activeView: ViewKey;
  onViewChange: (view: ViewKey) => void;
  onLogout: () => Promise<void>;
  allowedViews?: ViewKey[];
  children: React.ReactNode;
};

const navItems: Array<{ key: ViewKey; label: string; icon: React.ReactNode }> = [
  { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { key: "ba-opening", label: "Abertura de BA", icon: <ClipboardPlus size={18} /> },
  { key: "patients", label: "Pacientes", icon: <Users size={18} /> },
  { key: "attendances", label: "Atendimentos", icon: <Stethoscope size={18} /> },
  { key: "attendance-management", label: "Gerenciamento de Atendimento", icon: <ShieldCheck size={18} /> },
  { key: "schedule", label: "Agenda Clínica", icon: <CalendarDays size={18} /> },
  { key: "financial", label: "Financeiro", icon: <CreditCard size={18} /> },
  { key: "stock", label: "Estoque", icon: <Boxes size={18} /> },
  { key: "autoclave", label: "Registro de Autoclave", icon: <SlidersHorizontal size={18} /> },
  { key: "reports", label: "Relatorios", icon: <FileText size={18} /> },
  { key: "hci", label: "HCI", icon: <HeartPulse size={18} /> },
  { key: "settings", label: "Identidade", icon: <Settings size={18} /> },
  { key: "super-admin", label: "Administração da Clínica", icon: <ShieldCheck size={18} /> }
];

export function Layout({ company, profile, activeView, onViewChange, onLogout, allowedViews, children }: LayoutProps) {
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("podo360-sidebar-collapsed") === "true";
  });
  const visibleItems = navItems.filter((item) => {
    if (item.key === "super-admin") return profile.role === "super_admin";
    if (item.key === "attendance-management") return profile.role === "super_admin" || profile.role === "company_admin" || Boolean(allowedViews?.includes("attendance-management"));
    return profile.role === "super_admin" || !allowedViews || allowedViews.includes(item.key);
  });

  useEffect(() => {
    window.localStorage.setItem("podo360-sidebar-collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  function navigate(view: ViewKey) {
    if (view === "attendance-management" && profile.role !== "super_admin" && profile.role !== "company_admin" && !allowedViews?.includes("attendance-management")) return;
    if (profile.role !== "super_admin" && allowedViews && !allowedViews.includes(view)) return;
    onViewChange(view);
    setMobileMenuOpen(false);
  }

  async function confirmLogout() {
    setLoggingOut(true);
    setLogoutError("");
    try {
      await onLogout();
    } catch {
      setLogoutError("Nao foi possivel sair da conta. Tente novamente.");
      setLoggingOut(false);
    }
  }

  return (
    <div className={`app-shell ${sidebarCollapsed ? "is-sidebar-collapsed" : ""}`}>
      {mobileMenuOpen && <button aria-label="Fechar menu" className="mobile-menu-backdrop" onClick={() => setMobileMenuOpen(false)} type="button" />}
      <aside className={`sidebar ${mobileMenuOpen ? "is-open" : ""} ${sidebarCollapsed ? "is-collapsed" : ""}`}>
        <div className="sidebar__mobile-heading">
          <span>Menu principal</span>
          <button aria-label="Fechar menu" className="icon-button" onClick={() => setMobileMenuOpen(false)} type="button"><X size={18} /></button>
        </div>
        <button className="brand" onClick={() => navigate("dashboard")} type="button">
          <span className="brand__mark">{company.logoUrl ? <img src={company.logoUrl} alt="" /> : <Activity size={24} />}</span>
          <span>
            <strong>Podo360</strong>
            <small>{company.displayName}</small>
          </span>
        </button>

        <nav className="sidebar__nav" aria-label="Principal">
          {visibleItems.map((item) => (
            <button
              className={activeView === item.key ? "is-active" : ""}
              key={item.key}
              onClick={() => navigate(item.key)}
              type="button"
              title={item.label}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <button
          aria-label={sidebarCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
          aria-pressed={sidebarCollapsed}
          className="sidebar__collapse"
          onClick={() => setSidebarCollapsed((current) => !current)}
          type="button"
          title={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
        >
          {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          <span>{sidebarCollapsed ? "Expandir" : "Recolher"}</span>
        </button>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <button aria-label="Abrir menu" className="mobile-menu-pill" onClick={() => setMobileMenuOpen(true)} type="button"><Menu size={18} /><span>Menu</span></button>
          <div>
            <strong>{company.displayName}</strong>
            <small>Ambiente clínico seguro</small>
          </div>
          <div className="topbar__actions">
            <span className="status-dot">Sistema conectado</span>
            <a className="support-topbar-link" href={SUPPORT_WHATSAPP_URL} rel="noreferrer" target="_blank">
              <MessageCircle size={16} />
              <span>Suporte</span>
            </a>
            <div className="user-chip">
              <span>{profile.fullName.slice(0, 2).toUpperCase()}</span>
              <div>
                <strong>{profile.fullName}</strong>
                <small>{roleLabel(profile.role)}</small>
              </div>
            </div>
            <button className="icon-button" onClick={() => setLogoutOpen(true)} type="button" title="Sair da conta">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main className="content">
          <SystemNoticeBanner />
          {children}
        </main>
      </div>
      {logoutOpen && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={() => !loggingOut && setLogoutOpen(false)}>
          <section aria-labelledby="logout-title" aria-modal="true" className="dialog-card" onMouseDown={(event) => event.stopPropagation()} role="dialog">
            <span className="dialog-card__icon"><LogOut size={22} /></span>
            <div><h2 id="logout-title">Deseja realmente sair da conta?</h2><p>Sua sessao sera encerrada e voce voltara para a tela de login.</p></div>
            {logoutError && <div className="inline-error">{logoutError}</div>}
            <div className="dialog-card__actions">
              <button className="ghost-action" disabled={loggingOut} onClick={() => setLogoutOpen(false)} type="button">Cancelar</button>
              <button className="danger-button" disabled={loggingOut} onClick={confirmLogout} type="button">{loggingOut ? "Saindo..." : "Sair da conta"}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
