import { getPlatformAccessSnapshot } from "./platformAccessService";
import type { PlatformAccessSnapshot, PlatformPlanSummary } from "./platformAccessService";

export type CompanyPlanSnapshot = {
  companyId: string;
  plan?: PlatformPlanSummary;
  status: PlatformAccessSnapshot["access"]["status"];
  canAccess: boolean;
  loadedFromPlatform: boolean;
};

export async function getCompanyPlanSnapshot(companyId: string): Promise<CompanyPlanSnapshot> {
  const snapshot = await getPlatformAccessSnapshot(companyId);
  return {
    companyId,
    plan: snapshot.plan,
    status: snapshot.access.status,
    canAccess: snapshot.access.canAccess,
    loadedFromPlatform: snapshot.loadedFromPlatform
  };
}
