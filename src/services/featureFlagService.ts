import { getPlatformAccessSnapshot } from "./platformAccessService";
import type { PlatformFeatureAccess, PlatformFeatureKey } from "./platformAccessService";

export async function listCompanyFeatureFlags(companyId: string): Promise<PlatformFeatureAccess[]> {
  const snapshot = await getPlatformAccessSnapshot(companyId);
  return snapshot.features;
}

export async function isCompanyFeatureEnabled(companyId: string, featureKey: PlatformFeatureKey | string): Promise<boolean> {
  const features = await listCompanyFeatureFlags(companyId);
  const feature = features.find((item) => item.key === featureKey);

  // Fase atual: ainda não bloquear módulos por plano. Ausência da feature significa liberado.
  return feature ? feature.enabled : true;
}
