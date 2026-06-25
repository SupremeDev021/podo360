import { isSupabaseConfigured, supabase } from "../lib/supabase";

export type CompanyAccessStatus = "active" | "trial" | "inactive" | "suspended" | "cancelled";

export type CompanyAccessState = {
  status: CompanyAccessStatus;
  canAccess: boolean;
  message?: string;
};

export const COMPANY_ACCESS_UNAVAILABLE_MESSAGE =
  "O acesso da sua clínica está temporariamente indisponível. Entre em contato com o suporte Podo360.";

const allowedStatuses: CompanyAccessStatus[] = ["active", "trial"];

function normalizeCompanyStatus(input?: string | null, blockedAt?: string | null): CompanyAccessStatus {
  if (blockedAt) return "suspended";

  switch (input) {
    case "active":
      return "active";
    case "trial":
      return "trial";
    case "cancelled":
      return "cancelled";
    case "blocked":
    case "past_due":
      return "suspended";
    case "inactive":
    case "suspended":
      return input;
    default:
      return "active";
  }
}

export function buildCompanyAccessState(status: CompanyAccessStatus): CompanyAccessState {
  const canAccess = allowedStatuses.includes(status);
  return {
    status,
    canAccess,
    message: canAccess ? undefined : COMPANY_ACCESS_UNAVAILABLE_MESSAGE
  };
}

export async function getCompanyAccessState(companyId: string): Promise<CompanyAccessState> {
  if (!companyId || !isSupabaseConfigured || !supabase) {
    return buildCompanyAccessState("active");
  }

  const { data: platformAccess } = await supabase
    .from("company_platform_access")
    .select("status")
    .eq("company_id", companyId)
    .maybeSingle();

  if (platformAccess?.status) {
    return buildCompanyAccessState(normalizeCompanyStatus(platformAccess.status));
  }

  const { data, error } = await supabase
    .from("companies")
    .select("plan_status, blocked_at")
    .eq("id", companyId)
    .maybeSingle();

  if (error) throw error;

  return buildCompanyAccessState(normalizeCompanyStatus(data?.plan_status, data?.blocked_at));
}
