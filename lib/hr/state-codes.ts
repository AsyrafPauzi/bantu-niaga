/**
 * Maps business `state_code` (3-letter) to MyCal API state aliases.
 * @see https://mycal-web.pages.dev/
 */
export const STATE_CODE_TO_MYCAL: Record<string, string> = {
  JHR: "johor",
  KDH: "kedah",
  KTN: "kelantan",
  KUL: "kl",
  LBN: "labuan",
  MLK: "melaka",
  NSN: "negeri-sembilan",
  PHG: "pahang",
  PRK: "perak",
  PLS: "perlis",
  PNG: "penang",
  SBH: "sabah",
  SWK: "sarawak",
  SGR: "selangor",
  TRG: "terengganu",
  PJY: "putrajaya",
};

export function resolveMycalStateAlias(stateCode: string | null | undefined): string | null {
  if (!stateCode) return null;
  const normalized = stateCode.trim().toUpperCase();
  return STATE_CODE_TO_MYCAL[normalized] ?? null;
}

export const STATE_LABELS: Record<string, string> = {
  JHR: "Johor",
  KDH: "Kedah",
  KTN: "Kelantan",
  KUL: "Kuala Lumpur",
  LBN: "Labuan",
  MLK: "Melaka",
  NSN: "Negeri Sembilan",
  PHG: "Pahang",
  PRK: "Perak",
  PLS: "Perlis",
  PNG: "Penang",
  SBH: "Sabah",
  SWK: "Sarawak",
  SGR: "Selangor",
  TRG: "Terengganu",
  PJY: "Putrajaya",
};
