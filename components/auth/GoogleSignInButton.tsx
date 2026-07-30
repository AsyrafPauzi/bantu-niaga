"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { buildOAuthCallbackUrl } from "@/lib/auth/social-login";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface GoogleSignInButtonProps {
  nextPath?: string;
  onError?: (message: string) => void;
  label?: string;
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.7 4.7-6.2 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 5.1 29.3 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 5.1 29.3 3 24 3 16.2 3 9.4 7.5 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 45c5.3 0 10-2 13.5-5.3l-6.2-5.2C29.3 36.1 26.8 37 24 37c-5.1 0-9.5-3.2-11.2-7.7l-6.5 5C9.4 40.4 16.2 45 24 45z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4 5.8l6.2 5.2C40.9 35.6 44 30.2 44 24c0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}

export function GoogleSignInButton({
  nextPath = "/home",
  onError,
  label = "Continue with Google",
}: GoogleSignInButtonProps) {
  const [busy, setBusy] = useState(false);

  async function handleGoogleSignIn() {
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: buildOAuthCallbackUrl(nextPath),
          queryParams: {
            access_type: "online",
            prompt: "select_account",
          },
        },
      });
      if (error) {
        onError?.(error.message);
        setBusy(false);
      }
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "Google sign-in failed.");
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleGoogleSignIn}
      disabled={busy}
      className="flex w-full items-center justify-center gap-3 rounded-lg border border-cream-300 bg-white px-4 py-3 text-sm font-semibold text-ink shadow-card transition-colors hover:bg-cream-100 disabled:cursor-not-allowed disabled:opacity-70 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark/60"
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
      ) : (
        <GoogleIcon className="h-4 w-4" />
      )}
      {busy ? "Redirecting to Google…" : label}
    </button>
  );
}
