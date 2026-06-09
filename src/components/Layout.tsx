import {
  Activity,
  Boxes,
  Building2,
  CalendarDays,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  Stethoscope,
  Users
} from "lucide-react";
import type { Company, Profile } from "../types";
import { roleLabel } from "../services/rbac";

export type ViewKey =
  | "dashboard"
  | "patients"
  | "patient-profile"
  | "attendances"
  | "schedule"
  | "financial"
  | "stock"
  | "reports"
  | "settings"
  | "super-admin"
  | "plans";

type LayoutProps = {
  company: Company;
  profile: Profile;
  activeView: ViewKey;
  onViewChange: (view: ViewKey) => void;
  children: React.ReactNode;
};

const navItems: Array<{ key: ViewKey; label: string; icon: React.ReactNode }> = [
  { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { key: "patients", label: "Pacientes", icon: <Users size={18} /> },
  { key: "attendances", label: "Atendimentos", icon: <Stethoscope size={18} /> },
  { key: "schedule", label: "Agenda", icon: <CalendarDays size={18} /> },
  { key: "financial", label: "Financeiro", icon: <CreditCard size={18} /> },
  { key: "stock", label: "Estoque", icon: <Boxes size={18} /> },
  { key: "reports", label: "Relatorios", icon: <FileText size={18} /> },
  { key: "settings", label: "White label", icon: <Settings size={18} /> },
  { key: "super-admin", label: "Super Admin", icon: <ShieldCheck size={18} /> },
  { key: "plans", label: "Planos", icon: <Building2 size={18} /> }
];

export function Layout({ company, profile, activeView, onViewChange, children }: LayoutProps) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => onViewChange("dashboard")}>
          <span className="brand__mark">{company.logoUrl ? <img src={company.logoUrl} alt="" /> : <Activity size={24} />}</span>
          <span>
            <strong>Podo360</strong>
            <small>{company.displayName}</small>
          </span>
        </button>

        <nav className="sidebar__nav" aria-label="Principal">
          {navItems.map((item) => (
            <button
              className={activeView === item.key ? "is-active" : ""}
              key={item.key}
              onClick={() => onViewChange(item.key)}
              type="button"
              title={item.label}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div>
            <strong>{company.displayName}</strong>
            <small>{company.planName} · {company.planStatus}</small>
          </div>
          <div className="topbar__actions">
            <span className="status-dot">Supabase ready</span>
            <div className="user-chip">
              <span>{profile.fullName.slice(0, 2).toUpperCase()}</span>
              <div>
                <strong>{profile.fullName}</strong>
                <small>{roleLabel(profile.role)}</small>
              </div>
            </div>
            <button className="icon-button" type="button" title="Sair">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main className="content">{children}</main>
      </div>
    </div>
  );
}
