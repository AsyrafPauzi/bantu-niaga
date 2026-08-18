export function buildAuthVerifyUrl(opts: {
  supabaseUrl: string;
  tokenHash: string;
  emailActionType: string;
  redirectTo: string;
}): string {
  const base = opts.supabaseUrl.replace(/\/$/, "");
  const params = new URLSearchParams({
    token: opts.tokenHash,
    type: opts.emailActionType,
    redirect_to: opts.redirectTo,
  });
  return `${base}/auth/v1/verify?${params.toString()}`;
}
