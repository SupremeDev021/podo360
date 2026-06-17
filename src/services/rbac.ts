import type { Role } from "../types";

const permissions: Record<Role, string[]> = {
  super_admin: ["*"],
  company_admin: [
    "company:manage",
    "users:manage",
    "patients:read",
    "patients:write",
    "attendances:write",
    "reports:read",
    "financial:read",
    "stock:read",
    "autoclave:write",
    "settings:write"
  ],
  professional: ["patients:read", "attendances:write", "reports:write", "bodymap:write", "autoclave:write"],
  reception: ["patients:read", "patients:write", "schedule:write", "history:basic"],
  financial: ["financial:read", "financial:write", "reports:financial"],
  stock: ["stock:read", "stock:write", "autoclave:write"],
  schedule: ["schedule:write", "patients:read"],
  reports: ["reports:read"],
  custom: []
};

export function can(role: Role, permission: string) {
  return permissions[role].includes("*") || permissions[role].includes(permission);
}

export function roleLabel(role: Role) {
  const labels: Record<Role, string> = {
    super_admin: "Dono da Clínica",
    company_admin: "Administrador da empresa",
    professional: "Profissional / Podólogo",
    reception: "Recepção",
    financial: "Financeiro",
    stock: "Estoque",
    schedule: "Agenda",
    reports: "Relatórios",
    custom: "Usuário personalizado"
  };
  return labels[role];
}
