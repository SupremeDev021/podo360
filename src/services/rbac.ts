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
    super_admin: "Administrador da clinica",
    company_admin: "Administrador da empresa",
    professional: "Profissional / Podologo",
    reception: "Recepcao",
    financial: "Financeiro",
    stock: "Estoque",
    schedule: "Agenda",
    reports: "Relatorios",
    custom: "Usuario personalizado"
  };
  return labels[role];
}
