const BLOCKED_SHARE_CATEGORIES = new Set(["hr_doc"]);

export function canShareAdminFileCategory(
  category: string | null | undefined,
): boolean {
  if (!category) return true;
  return !BLOCKED_SHARE_CATEGORIES.has(category);
}

export function adminFileSharePath(idcompany: string, shareHash: string): string {
  return `/${idcompany}/file-${shareHash}`;
}

export function adminFileShareUrl(
  appUrl: string,
  idcompany: string,
  shareHash: string,
): string {
  const base = appUrl.replace(/\/$/, "");
  return `${base}${adminFileSharePath(idcompany, shareHash)}`;
}
