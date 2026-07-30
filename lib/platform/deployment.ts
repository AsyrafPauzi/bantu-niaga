export type DeploymentMode = "saas" | "standalone";

/**
 * Parse deployment mode from env. Defaults to multi-tenant SaaS.
 * Set `DEPLOYMENT_MODE=standalone` (server) and mirror with
 * `NEXT_PUBLIC_DEPLOYMENT_MODE=standalone` for client UI toggles.
 */
export function parseDeploymentMode(raw?: string | null): DeploymentMode {
  const value = raw?.trim().toLowerCase();
  return value === "standalone" ? "standalone" : "saas";
}

export function getDeploymentMode(): DeploymentMode {
  return parseDeploymentMode(
    process.env.DEPLOYMENT_MODE ?? process.env.NEXT_PUBLIC_DEPLOYMENT_MODE,
  );
}

export function isStandaloneDeployment(): boolean {
  return getDeploymentMode() === "standalone";
}

export function isSaasDeployment(): boolean {
  return !isStandaloneDeployment();
}

/** Owned-business cap — standalone installs are single-tenant per login. */
export function maxOwnedBusinessesPerUser(): number {
  return isStandaloneDeployment() ? 1 : 5;
}

/** Client components — reads public env only. */
export function getPublicDeploymentMode(): DeploymentMode {
  return parseDeploymentMode(process.env.NEXT_PUBLIC_DEPLOYMENT_MODE);
}

export function isPublicStandaloneDeployment(): boolean {
  return getPublicDeploymentMode() === "standalone";
}
