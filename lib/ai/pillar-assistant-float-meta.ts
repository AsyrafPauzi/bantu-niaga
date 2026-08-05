export type PillarAssistantFloatKey =
  | "admin"
  | "finance"
  | "operations"
  | "marketing"
  | "sales"
  | "hr";

export interface PillarAssistantFloatMeta {
  pillar: PillarAssistantFloatKey;
  agentSlug: string;
  queryParam: string;
  roleTitle: string;
  defaultName: string;
  basePath: string;
}

export const PILLAR_ASSISTANT_FLOAT_META: Record<
  PillarAssistantFloatKey,
  PillarAssistantFloatMeta
> = {
  admin: {
    pillar: "admin",
    agentSlug: "admin",
    queryParam: "amir",
    roleTitle: "Admin AI",
    defaultName: "Amir",
    basePath: "/admin",
  },
  finance: {
    pillar: "finance",
    agentSlug: "finance",
    queryParam: "fayza",
    roleTitle: "Finance AI",
    defaultName: "Fayza",
    basePath: "/finance",
  },
  operations: {
    pillar: "operations",
    agentSlug: "operations",
    queryParam: "aiman",
    roleTitle: "Operations AI",
    defaultName: "Aiman",
    basePath: "/operations",
  },
  marketing: {
    pillar: "marketing",
    agentSlug: "marketing",
    queryParam: "maya",
    roleTitle: "Marketing AI",
    defaultName: "Maya",
    basePath: "/marketing",
  },
  sales: {
    pillar: "sales",
    agentSlug: "sales",
    queryParam: "sufi",
    roleTitle: "Sales AI",
    defaultName: "Sufi",
    basePath: "/sales",
  },
  hr: {
    pillar: "hr",
    agentSlug: "hr",
    queryParam: "hana",
    roleTitle: "HR AI",
    defaultName: "Hana",
    basePath: "/hr",
  },
};

export function pillarAssistantOpenQuery(
  pillar: PillarAssistantFloatKey,
  seed?: string,
): string {
  const config = PILLAR_ASSISTANT_FLOAT_META[pillar];
  const params = new URLSearchParams({ [config.queryParam]: "open" });
  if (seed?.trim()) {
    params.set("seed", seed.trim().slice(0, 2000));
  }
  return `${config.basePath}?${params.toString()}`;
}
