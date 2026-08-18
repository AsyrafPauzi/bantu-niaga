export type GoogleCallbackTarget =
  | { kind: "continue"; nextPath: string }
  | { kind: "complete" }
  | { kind: "email_taken" };

export function resolveGoogleCallbackTarget(opts: {
  authUserId: string;
  profileId: string | null;
  emailOwnerId: string | null;
  nextPath: string;
}): GoogleCallbackTarget {
  if (opts.profileId) {
    return { kind: "continue", nextPath: opts.nextPath };
  }
  if (opts.emailOwnerId && opts.emailOwnerId !== opts.authUserId) {
    return { kind: "email_taken" };
  }
  return { kind: "complete" };
}
