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
    "settings:write"
  ],
  professional: ["patients:read", "attendances:write", "reports:write", "bodymap:write"],
  reception: ["patients:read", "patients:write", "schedule:write", "history:basic"],
  financial: ["financial:read", "financial:write", "reports:financial"]
};

export function can(role: Role, permission: string) {
  return permissions[role].includes("*") || permissions[role].includes(permission);
}

export function roleLabel(role: Role) {
  const labels: Record<Role, string> = {
    super_admin: "Super Admin",
    company_admin: "Admin da empresa",
    professional: "Podologo",
    reception: "Recepcao",
    financial: "Financeiro"
  };
  return labels[role];
}
