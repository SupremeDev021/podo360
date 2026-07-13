import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { buildCompanyAccessState, COMPANY_ACCESS_UNAVAILABLE_MESSAGE } from "./companyStatusService";
import type { CompanyAccessState, CompanyAccessStatus } from "./companyStatusService";

export type PlatformFeatureKey =
  | "dashboard"
  | "abertura_atendimento"
  | "atendimentos"
  | "pacientes"
  | "agenda_clinica"
  | "prontuario_evolucao"
  | "anamnese_completa"
  | "avaliacao_sensibilidade"
  | "pe_3d"
  | "itb_ihb"
  | "glicemia_eva"
  | "diagnostico_ungueal"
  | "curativo"
  | "evolucao_imagem"
  | "comparativo_evolucao"
  | "financeiro"
  | "estoque"
  | "relatorios"
  | "white_label"
  | "gerenciamento_atendimento"
  | "avisos_globais"
  | "suporte_prioritario"
  | "relatorio_ia";

export type PlatformPlanSummary = {
  id?: string;
  name?: string;
  slug?: string;
  isCustomPrice?: boolean;
};

export type PlatformFeatureAccess = {
  key: PlatformFeatureKey | string;
  enabled: boolean;
  limitValue?: number | string | null;
  source?: "plan" | "company_override" | "fallback";
};

export type PlatformAccessSnapshot = {
  companyId: string;
  access: CompanyAccessState;
  plan?: PlatformPlanSummary;
  maxUsers?: number | null;
  features: PlatformFeatureAccess[];
  loadedFromPlatform: boolean;
};

type CompanyPlatformAccessRow = {
  company_id: string;
  status: CompanyAccessStatus | "blocked" | "past_due" | string | null;
  plan_id: string | null;
  plan_name: string | null;
  plan_slug: string | null;
  is_custom_price: boolean | null;
  max_users?: number | null;
  features: Array<{
    key?: string;
    enabled?: boolean;
    limit_value?: number | string | null;
    source?: "plan" | "company_override";
  }> | null;
};

export function getFallbackPlatformAccess(companyId: string): PlatformAccessSnapshot {
  return {
    companyId,
    access: buildCompanyAccessState("inactive"),
    features: [],
    loadedFromPlatform: false
  };
}

export async function getPlatformAccessSnapshot(companyId: string): Promise<PlatformAccessSnapshot> {
  if (!companyId || !isSupabaseConfigured || !supabase) {
    return getFallbackPlatformAccess(companyId);
  }

  try {
    const { data, error } = await supabase
      .from("company_platform_access")
      .select("company_id,status,plan_id,plan_name,plan_slug,is_custom_price,features")
      .eq("company_id", companyId)
      .maybeSingle();

    if (error || !data) return getFallbackPlatformAccess(companyId);

    const row = data as CompanyPlatformAccessRow;
    const normalizedStatus = normalizePlatformStatus(row.status);
    return {
      companyId,
      access: {
        ...buildCompanyAccessState(normalizedStatus),
        message: ["active", "trial"].includes(normalizedStatus) ? undefined : COMPANY_ACCESS_UNAVAILABLE_MESSAGE
      },
      plan: {
        id: row.plan_id ?? undefined,
        name: row.plan_name ?? undefined,
        slug: row.plan_slug ?? undefined,
        isCustomPrice: Boolean(row.is_custom_price)
      },
      maxUsers: row.max_users == null ? null : Number(row.max_users),
      features: (row.features ?? [])
        .filter((feature) => feature.key)
        .map((feature) => ({
          key: String(feature.key),
          enabled: feature.enabled !== false,
          limitValue: feature.limit_value,
          source: feature.source ?? "plan"
        })),
      loadedFromPlatform: true
    };
  } catch {
    return getFallbackPlatformAccess(companyId);
  }
}

function normalizePlatformStatus(status?: string | null): CompanyAccessStatus {
  if (status === "active" || status === "trial" || status === "inactive" || status === "suspended" || status === "cancelled") return status;
  if (status === "blocked" || status === "past_due") return "suspended";
  return "inactive";
}
