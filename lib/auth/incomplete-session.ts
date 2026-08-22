export type IncompleteSessionDecision =
  | "allow"
  | "redirect_complete"
  | "forbidden_api";

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function isPublicAuthPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  return (
    path === "/sign-in" ||
    path === "/sign-up" ||
    path === "/sign-up/complete" ||
    path === "/auth/callback" ||
    path === "/accept-invite" ||
    path.startsWith("/legal/")
  );
}

export function incompleteSessionDecision(opts: {
  pathname: string;
  hasProfile: boolean;
}): IncompleteSessionDecision {
  if (opts.hasProfile) return "allow";
  const path = normalizePath(opts.pathname);
  if (
    path === "/sign-up/complete" ||
    path === "/api/auth/complete-google-signup" ||
    path === "/auth/callback" ||
    path === "/accept-invite" ||
    path.startsWith("/legal/")
  ) {
    return "allow";
  }
  if (path.startsWith("/api/")) return "forbidden_api";
  return "redirect_complete";
}
